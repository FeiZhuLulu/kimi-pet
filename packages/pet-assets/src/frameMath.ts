import type { PetPackManifest, PetState } from "@kimi-pet/shared-types";

export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getFrameRect(
  manifest: PetPackManifest,
  state: PetState,
  frameIndex: number
): FrameRect {
  const anim = manifest.animations[state];
  if (!anim) throw new Error(`Unknown animation: ${state}`);

  const safeFrame = Math.max(0, Math.min(frameIndex, anim.frames - 1));
  return {
    x: safeFrame * manifest.asset.cellWidth,
    y: anim.row * manifest.asset.cellHeight,
    width: manifest.asset.cellWidth,
    height: manifest.asset.cellHeight,
  };
}
