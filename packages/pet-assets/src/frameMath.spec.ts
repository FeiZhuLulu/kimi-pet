import { describe, it, expect } from "vitest";
import { getFrameRect } from "./frameMath.js";
import { DEFAULT_PET_PACK } from "./schema.js";
import type { PetState } from "@kimi-pet/shared-types";

describe("getFrameRect", () => {
  it("returns correct rect for idle frame 0", () => {
    const rect = getFrameRect(DEFAULT_PET_PACK, "idle", 0);
    expect(rect).toEqual({ x: 0, y: 0, width: 256, height: 256 });
  });

  it("returns correct rect for thinking frame 2", () => {
    const rect = getFrameRect(DEFAULT_PET_PACK, "thinking", 2);
    expect(rect).toEqual({ x: 512, y: 256, width: 256, height: 256 });
  });

  it("clamps frame index", () => {
    const rect = getFrameRect(DEFAULT_PET_PACK, "idle" as PetState, 100);
    expect(rect.x).toBe(1280); // (6-1) * 256
  });
});
