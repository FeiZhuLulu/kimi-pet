import fs from "node:fs/promises";
import path from "node:path";
import type { PetPackManifest, PetState } from "@kimi-pet/shared-types";
import { DEFAULT_PET_PACK } from "./schema.js";

export const ROW_ORDER: PetState[] = [
  "idle",
  "thinking",
  "tool_use",
  "editing",
  "terminal",
  "waiting_approval",
  "success",
  "error",
];

export interface ComposeOptions {
  sourceDir: string;
  outDir: string;
  manifest?: PetPackManifest;
  lossless?: boolean;
}

export async function composeRows(options: ComposeOptions): Promise<void> {
  const { sourceDir, outDir, manifest = DEFAULT_PET_PACK, lossless = true } = options;

  await fs.mkdir(outDir, { recursive: true });

  // Validate source files
  for (const name of ROW_ORDER) {
    const file = path.join(sourceDir, `${name}.png`);
    try {
      await fs.access(file);
    } catch {
      throw new Error(`Missing row strip: ${file}`);
    }
  }

  const sharpModule = await import("sharp").catch(() => null);
  if (!sharpModule) {
    throw new Error("sharp is required for image composition");
  }
  const sharp = sharpModule.default;

  const composites = ROW_ORDER.map((name, index) => ({
    input: path.join(sourceDir, `${name}.png`),
    left: 0,
    top: index * manifest.asset.cellHeight,
  }));

  const outputPath = path.join(outDir, manifest.asset.path);
  await sharp({
    create: {
      width: manifest.asset.cellWidth * manifest.asset.columns,
      height: manifest.asset.cellHeight * manifest.asset.rows,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .webp({ lossless })
    .toFile(outputPath);

  await fs.writeFile(
    path.join(outDir, "pet.json"),
    JSON.stringify(manifest, null, 2)
  );
}
