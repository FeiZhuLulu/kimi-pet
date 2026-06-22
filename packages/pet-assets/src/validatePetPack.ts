import fs from "node:fs/promises";
import type { PetPackManifest, PetState } from "@kimi-pet/shared-types";
import { V0_PET_STATES } from "./schema.js";

export interface ValidationError {
  code: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  pet?: string;
  spritesheet?: { width: number; height: number };
  cell?: { width: number; height: number };
  errors: ValidationError[];
  warnings: ValidationError[];
}

export async function validatePetPack(petDir: string): Promise<ValidationResult> {
  const result: ValidationResult = { ok: false, errors: [], warnings: [] };

  const manifestPath = `${petDir}/pet.json`;
  let manifest: PetPackManifest;
  try {
    const raw = await fs.readFile(manifestPath, "utf-8");
    manifest = JSON.parse(raw) as PetPackManifest;
  } catch (e) {
    result.errors.push({ code: "missing_manifest", message: `Cannot read ${manifestPath}: ${e}` });
    return result;
  }

  result.pet = manifest.id;

  // Spritesheet existence
  const spritesheetPath = `${petDir}/${manifest.asset.path}`;
  let stats;
  try {
    stats = await fs.stat(spritesheetPath);
  } catch {
    result.errors.push({ code: "missing_spritesheet", message: `Spritesheet not found: ${spritesheetPath}` });
    return result;
  }

  // Try to use sharp for image dimensions
  let width = 0;
  let height = 0;
  try {
    const sharp = await import("sharp");
    const meta = await sharp.default(spritesheetPath).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    result.warnings.push({ code: "sharp_unavailable", message: "Cannot load sharp for image validation" });
  }

  result.spritesheet = { width, height };
  result.cell = { width: manifest.asset.cellWidth, height: manifest.asset.cellHeight };

  const expectedWidth = manifest.asset.cellWidth * manifest.asset.columns;
  const expectedHeight = manifest.asset.cellHeight * manifest.asset.rows;

  if (width && width !== expectedWidth) {
    result.errors.push({
      code: "invalid_width",
      message: `Spritesheet width ${width} != expected ${expectedWidth}`,
    });
  }
  if (height && height !== expectedHeight) {
    result.errors.push({
      code: "invalid_height",
      message: `Spritesheet height ${height} != expected ${expectedHeight}`,
    });
  }

  for (const state of V0_PET_STATES) {
    const anim = manifest.animations[state as PetState];
    if (!anim) {
      result.errors.push({ code: "missing_animation", message: `Missing animation: ${state}` });
      continue;
    }
    if (anim.row < 0 || anim.row >= manifest.asset.rows) {
      result.errors.push({
        code: "row_out_of_range",
        message: `${state}: row ${anim.row} out of range [0, ${manifest.asset.rows})`,
      });
    }
    if (anim.frames < 1 || anim.frames > manifest.asset.columns) {
      result.errors.push({
        code: "frames_out_of_range",
        message: `${state}: frames ${anim.frames} out of range [1, ${manifest.asset.columns}]`,
      });
    }
    if (anim.fps <= 0) {
      result.errors.push({ code: "invalid_fps", message: `${state}: fps ${anim.fps} must be > 0` });
    }
    if (anim.next && !(anim.next in manifest.animations)) {
      result.errors.push({
        code: "invalid_next",
        message: `${state}: next "${anim.next}" is not a defined animation`,
      });
    }
  }

  result.ok = result.errors.length === 0;
  return result;
}
