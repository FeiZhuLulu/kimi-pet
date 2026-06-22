#!/usr/bin/env python3
"""
Build Kimi Pet v0 standard spritesheet from source PNGs.
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path("E:/项目库/桌宠项目")
SRC_DIR = ROOT
NORM_DIR = ROOT / "assets/kimi-robot/source-normalized"
DIST_DIR = ROOT / "assets/kimi-robot/dist"

FRAME_W = 256
FRAME_H = 256
COLS = 8
ROWS = 8
SHEET_W = FRAME_W * COLS
SHEET_H = FRAME_H * ROWS
TARGET_HEIGHT = 210
BOTTOM_MARGIN = 20
MIN_COMPONENT_AREA = 3000

# (source filename, state id, expected frame count)
STATES = [
    ("ide.png", "idle", 6),
    ("thinking.png", "thinking", 6),
    ("tool.png", "tool_use", 8),
    ("editing.png", "editing", 8),
    ("terminal.png", "terminal", 8),
    ("waiting approval.png", "waiting_approval", 6),
    ("success.png", "success", 6),
    ("error.png", "error", 6),
]


def green_key(arr):
    """Return alpha mask: True = keep, False = green background."""
    r = arr[:, :, 0].astype(np.float32)
    g = arr[:, :, 1].astype(np.float32)
    b = arr[:, :, 2].astype(np.float32)
    return ~((g > 180) & (g > r * 1.8) & (g > b * 1.8))


def clean_fringe(rgba):
    """Zero RGB for fully transparent pixels to avoid colored halos."""
    arr = np.array(rgba)
    arr[arr[:, :, 3] == 0] = [0, 0, 0, 0]
    return Image.fromarray(arr)


def apply_green_key(img):
    """Apply the green-screen key to an RGBA image, in-place."""
    arr = np.array(img)
    keep = green_key(arr)
    arr[:, :, 3] = np.where(keep, arr[:, :, 3], 0)

    # Desaturate any remaining green tint on visible pixels (edge halos).
    alpha = arr[:, :, 3]
    visible = alpha > 0
    r = arr[:, :, 0].astype(np.float32)
    g = arr[:, :, 1].astype(np.float32)
    b = arr[:, :, 2].astype(np.float32)
    green_fringe = visible & (g > r + 12) & (g > b + 12)
    if np.any(green_fringe):
        avg = ((r + b) / 2).astype(np.uint8)
        arr[green_fringe, 1] = avg[green_fringe]

    arr[arr[:, :, 3] == 0] = [0, 0, 0, 0]
    return Image.fromarray(arr)


def find_robots(rgba, expected):
    """Find robot-shaped connected components, left-to-right."""
    arr = np.array(rgba)
    alpha = arr[:, :, 3]
    labels, n = ndimage.label(alpha > 0)
    if n == 0:
        return []

    component_ids = np.arange(1, n + 1)
    areas = ndimage.sum(alpha > 0, labels, component_ids)

    comps = []
    for idx in range(1, n + 1):
        area = int(areas[idx - 1])
        if area < MIN_COMPONENT_AREA:
            continue
        mask = labels == idx
        rows, cols = np.where(mask)
        if len(rows) == 0:
            continue
        bbox = (int(rows.min()), int(cols.min()), int(rows.max()), int(cols.max()))
        # "foot" baseline: lowest non-transparent pixel in this component.
        foot_y = int(rows.max())
        cx = (bbox[1] + bbox[3]) / 2
        comps.append({
            "label": idx,
            "area": area,
            "bbox": bbox,
            "foot_y": foot_y,
            "cx": cx,
        })

    # Sort left-to-right.
    comps.sort(key=lambda c: c["cx"])

    # If we found more than 8, keep the 8 largest (shouldn't normally happen).
    if len(comps) > 8:
        print(f"  WARNING: found {len(comps)} components, keeping largest 8", file=sys.stderr)
        comps = sorted(comps, key=lambda c: c["area"], reverse=True)[:8]
        comps.sort(key=lambda c: c["cx"])

    return comps


def build_row(rgba, comps, state_name):
    """Build a 2048x256 normalized row strip."""
    row = Image.new("RGBA", (SHEET_W, FRAME_H), (0, 0, 0, 0))
    for i, comp in enumerate(comps):
        rmin, cmin, rmax, cmax = comp["bbox"]
        # Small padding to avoid clipping antialiased edges.
        pad = 4
        rmin = max(0, rmin - pad)
        cmin = max(0, cmin - pad)
        rmax = min(rgba.height - 1, rmax + pad)
        cmax = min(rgba.width - 1, cmax + pad)

        robot = rgba.crop((cmin, rmin, cmax + 1, rmax + 1))
        rob_w, rob_h = robot.size

        # Scale to target height, keep aspect ratio.
        scale = TARGET_HEIGHT / rob_h
        new_w = int(round(rob_w * scale))
        new_h = TARGET_HEIGHT
        scaled = robot.resize((new_w, new_h), Image.LANCZOS)

        # Horizontal center in the cell.
        x = i * FRAME_W + (FRAME_W - new_w) // 2

        # Align foot baseline: foot_y relative to crop top -> scaled distance.
        foot_from_top = comp["foot_y"] - rmin
        scaled_foot = int(round(foot_from_top * scale))
        target_foot_y = FRAME_H - BOTTOM_MARGIN
        y = target_foot_y - scaled_foot

        row.paste(scaled, (x, y), scaled)
        print(f"  frame {i}: bbox={comp['bbox']} area={comp['area']} paste=({x},{y}) size=({new_w},{new_h})")

    # Re-apply green-key after scaling to remove any green that bled into edges
    # from the transparent background during Lanczos resampling.
    return apply_green_key(row)


def validate_green_pixels(img):
    """Count visible pixels matching the green-key threshold."""
    arr = np.array(img.convert("RGBA"))
    visible = arr[:, :, 3] > 0
    r = arr[:, :, 0].astype(np.float32)
    g = arr[:, :, 1].astype(np.float32)
    b = arr[:, :, 2].astype(np.float32)
    greenish = (g > 180) & (g > r * 1.8) & (g > b * 1.8)
    return int(np.logical_and(visible, greenish).sum())


def process_state(src_name, state_name, expected_frames):
    src_path = SRC_DIR / src_name
    print(f"\nProcessing {state_name} from {src_name} ...")
    img = Image.open(src_path).convert("RGBA")
    print(f"  source size: {img.size}")

    arr = np.array(img)
    keep = green_key(arr)
    arr[:, :, 3] = np.where(keep, 255, 0)
    rgba = clean_fringe(Image.fromarray(arr))

    comps = find_robots(rgba, expected_frames)
    found = len(comps)
    print(f"  found {found} robot(s)")
    if found != expected_frames:
        print(f"  WARNING: expected {expected_frames} robots, found {found}", file=sys.stderr)

    row = build_row(rgba, comps, state_name)

    # Validate green residue.
    bad = validate_green_pixels(row)
    if bad:
        print(f"  WARNING: {bad} visible green pixels remain in normalized row", file=sys.stderr)
    else:
        print(f"  green-key validation OK")

    # Save normalized row.
    NORM_DIR.mkdir(parents=True, exist_ok=True)
    norm_path = NORM_DIR / f"{state_name}.png"
    row.save(norm_path, "PNG")
    print(f"  saved {norm_path}")

    return row, found


def compose_spritesheet(rows):
    """Compose 8 rows into 2048x2048 spritesheet."""
    sheet = Image.new("RGBA", (SHEET_W, SHEET_H), (0, 0, 0, 0))
    for i, row in enumerate(rows):
        sheet.paste(row, (0, i * FRAME_H))
    # Final green-key pass on the whole atlas.
    return apply_green_key(sheet)


def make_contact_sheet(sheet):
    """Create a contact sheet with grid lines and labels for visual QA."""
    # Make a white-backed version so transparent cells are visible.
    contact = Image.new("RGBA", (SHEET_W, SHEET_H + 40), (255, 255, 255, 255))
    contact.paste(sheet, (0, 40), sheet)

    # Add labels.
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(contact)
    try:
        font = ImageFont.truetype("arial.ttf", 20)
    except Exception:
        font = ImageFont.load_default()

    for i, (_, state_name, _) in enumerate(STATES):
        y = 40 + i * FRAME_H
        draw.line([(0, y), (SHEET_W, y)], fill=(255, 0, 0, 128), width=1)
        draw.text((10, y + 5), f"{i}: {state_name}", fill=(0, 0, 0, 255), font=font)

    for i in range(COLS + 1):
        x = i * FRAME_W
        draw.line([(x, 40), (x, SHEET_H + 40)], fill=(255, 0, 0, 128), width=1)

    return contact


def build_pet_json(actual_frames):
    """Generate pet.json with actual per-state frame counts."""
    animations = {}
    for i, (state_name, expected) in enumerate(actual_frames):
        cfg = {
            "row": i,
            "frames": expected,
            "fps": 8,
            "loop": True,
        }
        if state_name in ("success", "error"):
            cfg["loop"] = False
            cfg["next"] = "idle"
            cfg["fps"] = 8 if state_name == "success" else 6
        elif state_name in ("idle", "waiting_approval"):
            cfg["fps"] = 6
        elif state_name == "editing":
            cfg["fps"] = 10
        animations[state_name] = cfg

    return {
        "schemaVersion": "kimi-pet.v0",
        "id": "kimi-robot",
        "displayName": "Kimi Robot",
        "asset": {
            "type": "spritesheet",
            "path": "spritesheet.webp",
            "cellWidth": FRAME_W,
            "cellHeight": FRAME_H,
            "columns": COLS,
            "rows": ROWS,
        },
        "animations": animations,
    }


def main():
    rows = []
    actual_frames = []

    for src_name, state_name, expected in STATES:
        row, found = process_state(src_name, state_name, expected)
        rows.append(row)
        actual_frames.append((state_name, found))

    # Compose final spritesheet.
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    sheet = compose_spritesheet(rows)
    sheet_path = DIST_DIR / "spritesheet.png"
    sheet.save(sheet_path, "PNG")
    print(f"\nSaved {sheet_path} ({sheet.size})")

    # WebP version.
    webp_path = DIST_DIR / "spritesheet.webp"
    sheet.save(webp_path, "WEBP", lossless=True)
    print(f"Saved {webp_path}")

    # Contact sheet.
    contact = make_contact_sheet(sheet)
    contact_path = DIST_DIR / "contact-sheet.png"
    contact.save(contact_path, "PNG")
    print(f"Saved {contact_path}")

    # pet.json.
    pet = build_pet_json(actual_frames)
    pet_path = DIST_DIR / "pet.json"
    pet_path.write_text(json.dumps(pet, indent=2), encoding="utf-8")
    print(f"Saved {pet_path}")

    # Final validation.
    bad = validate_green_pixels(sheet)
    if bad:
        print(f"\nERROR: {bad} visible green pixels remain in final spritesheet", file=sys.stderr)
        sys.exit(1)
    print("\nFinal validation OK: no visible green pixels in spritesheet.")

    print("\nActual frame counts used:")
    for state_name, found in actual_frames:
        print(f"  {state_name}: {found} frames")


if __name__ == "__main__":
    main()
