import fs from "node:fs/promises";
import path from "node:path";
import type { LoadedPetPack, PetPackManifest } from "@kimi-pet/shared-types";
import { isPetPackManifest } from "./schema.js";

export async function loadPetPack(petDir: string): Promise<LoadedPetPack> {
  const manifestPath = path.join(petDir, "pet.json");
  const manifestRaw = await fs.readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw) as PetPackManifest;

  if (!isPetPackManifest(manifest)) {
    throw new Error(`Invalid pet.json at ${manifestPath}`);
  }

  const absoluteSpritesheetPath = path.resolve(
    petDir,
    manifest.asset.path
  );

  return { manifest, absoluteSpritesheetPath };
}
