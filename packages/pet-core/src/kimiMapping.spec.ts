import { describe, it, expect } from "vitest";
import { mapKimiEventToState, mapToolNameToState } from "./kimiMapping.js";
import type { PetEvent } from "@kimi-pet/shared-types";

function event(type: string, extras: Partial<PetEvent> = {}): PetEvent {
  return {
    id: "1",
    ts: new Date().toISOString(),
    source: "kimi-hooks",
    type,
    ...extras,
  };
}

describe("mapToolNameToState", () => {
  it("maps Shell to terminal", () => {
    expect(mapToolNameToState("Shell")).toBe("terminal");
  });

  it("maps WriteFile to editing", () => {
    expect(mapToolNameToState("WriteFile")).toBe("editing");
  });

  it("maps ReadFile to tool_use", () => {
    expect(mapToolNameToState("ReadFile")).toBe("tool_use");
  });
});

describe("mapKimiEventToState", () => {
  it("SessionStart -> idle", () => {
    expect(mapKimiEventToState(event("SessionStart"))).toBe("idle");
  });

  it("UserPromptSubmit -> thinking", () => {
    expect(mapKimiEventToState(event("UserPromptSubmit"))).toBe("thinking");
  });

  it("PreToolUse Shell -> terminal", () => {
    expect(mapKimiEventToState(event("PreToolUse", { toolName: "Shell" }))).toBe("terminal");
  });

  it("PostToolUse success -> thinking", () => {
    expect(mapKimiEventToState(event("PostToolUse", { toolName: "Shell" }))).toBe("thinking");
  });

  it("PostToolUse failure -> error", () => {
    expect(
      mapKimiEventToState(
        event("PostToolUse", { toolName: "Shell", toolInput: { toolOutput: "is_error=True" } })
      )
    ).toBe("error");
  });

  it("Stop -> success", () => {
    expect(mapKimiEventToState(event("Stop"))).toBe("success");
  });

  it("PermissionRequest -> waiting_approval", () => {
    expect(mapKimiEventToState(event("PermissionRequest"))).toBe("waiting_approval");
  });

  it("PermissionResult -> thinking", () => {
    expect(mapKimiEventToState(event("PermissionResult"))).toBe("thinking");
  });

  it("Interrupt -> error", () => {
    expect(mapKimiEventToState(event("Interrupt"))).toBe("error");
  });

  it("explicit event.state wins", () => {
    expect(mapKimiEventToState(event("unknown", { state: "error" }))).toBe("error");
  });
});
