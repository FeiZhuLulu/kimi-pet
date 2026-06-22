#!/usr/bin/env python3
"""
Convert ide.png into a standard idle row strip.
Output: assets/kimi-robot/source/idle.png
"""

import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = Path("E:/项目库/桌宠项目/ide.png")
DST = Path("E:/项目库/桌宠项目/assets/kimi-robot/source/idle.png")

FRAME_W = 256
FRAME_H = 256
SHEET_W = 2048
SHEET_H = 256
TARGET_HEIGHT = 210
BOTTOM_MARGIN = 20
NUM_FRAMES = 8
EXPECTED_ROBOTS = 6


def green_key_mask(arr):
    """Return boolean mask where True == keep pixel, False == green background."""
    r = arr[:, :, 0].astype(np.float32)
    g = arr[:, :, 1].astype(np.float32)
    b = arr[:, :, 2].astype(np.float32)
    return ~((g > 180) & (g > r * 1.8) & (g > b * 1.8))


def largest_components(mask, n):
    """Find the n largest connected components in a binary mask.

    Returns list of (label_value, bbox, area) sorted by bbox center x.
    """
    labeled, num_features = ndimage.label(mask)
    if num_features == 0:
        return []

    component_ids = np.arange(1, num_features + 1)
    areas = ndimage.sum(mask, labeled, component_ids)

    # Keep the n largest components by area.
    keep_indices = np.argsort(areas)[::-1][:n]
    keep_labels = component_ids[keep_indices]

    results = []
    for label_val in keep_labels:
        component_mask = labeled == label_val
        rows, cols = np.where(component_mask)
        if len(rows) == 0:
            continue
        bbox = (rows.min(), cols.min(), rows.max(), cols.max())
        results.append({
            "label": int(label_val),
            "area": int(areas[label_val - 1]),
            "bbox": bbox,
            "cx": (bbox[1] + bbox[3]) / 2,
        })

    # Sort left-to-right by center x.
    results.sort(key=lambda d: d["cx"])
    return results


def remove_green_fringe(rgba):
    """For fully transparent pixels, zero out RGB to avoid green halos."""
    arr = np.array(rgba)
    alpha = arr[:, :, 3]
    arr[alpha == 0] = [0, 0, 0, 0]
    return Image.fromarray(arr)


def validate_no_green(path):
    """Check that no visible pixels are green-ish."""
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    alpha = arr[:, :, 3]
    visible = alpha > 0
    r = arr[:, :, 0].astype(np.float32)
    g = arr[:, :, 1].astype(np.float32)
    b = arr[:, :, 2].astype(np.float32)
    greenish = (g > 180) & (g > r * 1.8) & (g > b * 1.8)
    offenders = np.logical_and(visible, greenish).sum()
    return int(offenders)


def main():
    print(f"Loading {SRC} ...")
    img = Image.open(SRC).convert("RGBA")
    arr = np.array(img)
    print(f"Source size: {img.size}")

    # 1. Green-screen removal.
    keep = green_key_mask(arr)
    arr[:, :, 3] = np.where(keep, arr[:, :, 3], 0)
    rgba = Image.fromarray(arr)
    rgba = remove_green_fringe(rgba)

    # 2. Identify 6 robots.
    alpha_arr = np.array(rgba)[:, :, 3]
    components = largest_components(alpha_arr > 0, EXPECTED_ROBOTS)
    if len(components) < EXPECTED_ROBOTS:
        print(f"ERROR: found {len(components)} robots, expected {EXPECTED_ROBOTS}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(components)} robots (left-to-right):")
    for c in components:
        print(f"  area={c['area']}, bbox={c['bbox']}, cx={c['cx']:.1f}")

    # 3. Build the spritesheet.
    sheet = Image.new("RGBA", (SHEET_W, SHEET_H), (0, 0, 0, 0))

    for i, comp in enumerate(components):
        rmin, cmin, rmax, cmax = comp["bbox"]
        # Slight padding around the bbox to avoid clipping.
        pad = 4
        rmin = max(0, rmin - pad)
        cmin = max(0, cmin - pad)
        rmax = min(img.height - 1, rmax + pad)
        cmax = min(img.width - 1, cmax + pad)

        robot = rgba.crop((cmin, rmin, cmax + 1, rmax + 1))
        rob_w, rob_h = robot.size

        # Scale so height ~= TARGET_HEIGHT, keep aspect ratio.
        scale = TARGET_HEIGHT / rob_h
        new_w = int(round(rob_w * scale))
        new_h = TARGET_HEIGHT
        robot_scaled = robot.resize((new_w, new_h), Image.LANCZOS)

        # Center horizontally, align bottom to a common baseline.
        x = i * FRAME_W + (FRAME_W - new_w) // 2
        y = FRAME_H - BOTTOM_MARGIN - new_h
        sheet.paste(robot_scaled, (x, y), robot_scaled)
        print(f"  frame {i}: pasted at ({x}, {y}), size ({new_w}, {new_h})")

    # 4. Save.
    DST.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(DST, "PNG")
    print(f"Saved {DST}")

    # 5. Validate.
    offenders = validate_no_green(DST)
    if offenders:
        print(f"ERROR: {offenders} visible green-ish pixels remain", file=sys.stderr)
        sys.exit(1)
    print("Validation OK: no visible green pixels remain.")


if __name__ == "__main__":
    main()
