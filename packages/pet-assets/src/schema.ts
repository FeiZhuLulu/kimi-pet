import type { PetPackManifest } from "@kimi-pet/shared-types";

export const V0_PET_STATES = [
  "idle",
  "thinking",
  "tool_use",
  "editing",
  "terminal",
  "waiting_approval",
  "success",
  "error",
] as const;

export const DEFAULT_PET_PACK: PetPackManifest = {
  schemaVersion: "kimi-pet.v0",
  id: "kimi-robot",
  displayName: "Kimi Robot",
  description: "A Kimi Code desktop pet for coding-agent status feedback.",
  asset: {
    type: "spritesheet",
    path: "spritesheet.webp",
    cellWidth: 256,
    cellHeight: 256,
    columns: 8,
    rows: 8,
  },
  animations: {
    idle: { row: 0, frames: 6, fps: 6, loop: true },
    thinking: { row: 1, frames: 6, fps: 8, loop: true },
    tool_use: { row: 2, frames: 8, fps: 8, loop: true },
    editing: { row: 3, frames: 8, fps: 10, loop: true },
    terminal: { row: 4, frames: 8, fps: 8, loop: true },
    waiting_approval: { row: 5, frames: 6, fps: 6, loop: true },
    success: { row: 6, frames: 6, fps: 8, loop: false, next: "idle" },
    error: { row: 7, frames: 6, fps: 6, loop: false, next: "idle" },
  },
};

export function isPetPackManifest(obj: unknown): obj is PetPackManifest {
  if (typeof obj !== "object" || obj === null) return false;
  const m = obj as Record<string, unknown>;
  if (m.schemaVersion !== "kimi-pet.v0") return false;
  if (typeof m.id !== "string") return false;
  if (typeof m.displayName !== "string") return false;
  if (typeof m.asset !== "object" || m.asset === null) return false;
  if (typeof m.animations !== "object" || m.animations === null) return false;
  return true;
}
