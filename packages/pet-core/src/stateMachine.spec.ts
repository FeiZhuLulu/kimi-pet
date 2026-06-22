import { describe, it, expect, vi } from "vitest";
import { PetStateMachine } from "./stateMachine.js";
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

describe("PetStateMachine", () => {
  it("starts idle", () => {
    const sm = new PetStateMachine();
    expect(sm.getSnapshot().state).toBe("idle");
  });

  it("transitions to thinking on UserPromptSubmit", () => {
    const sm = new PetStateMachine();
    const result = sm.transition(event("UserPromptSubmit"));
    expect(result.snapshot.state).toBe("thinking");
    expect(result.snapshot.previousState).toBe("idle");
  });

  it("autoNext for success", () => {
    const sm = new PetStateMachine();
    const result = sm.transition(event("Stop"));
    expect(result.snapshot.state).toBe("success");
    expect(result.autoNext).toEqual({ state: "idle", delayMs: 2000 });
  });

  it("setState updates snapshot", () => {
    const sm = new PetStateMachine();
    sm.setState("terminal", "running bash");
    const snapshot = sm.getSnapshot();
    expect(snapshot.state).toBe("terminal");
    expect(snapshot.message).toBe("running bash");
  });
});
