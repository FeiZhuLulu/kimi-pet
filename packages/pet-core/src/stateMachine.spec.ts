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

  it("epoch increments on each transition", () => {
    const sm = new PetStateMachine();
    expect(sm.getEpoch()).toBe(0);
    sm.transition(event("UserPromptSubmit"));
    expect(sm.getEpoch()).toBe(1);
    sm.transition(event("PreToolUse", { toolName: "Shell" }));
    expect(sm.getEpoch()).toBe(2);
    sm.transition(event("Stop"));
    expect(sm.getEpoch()).toBe(3);
  });

  it("autoNext for error (StopFailure)", () => {
    const sm = new PetStateMachine();
    const result = sm.transition(event("StopFailure"));
    expect(result.snapshot.state).toBe("error");
    expect(result.autoNext).toEqual({ state: "idle", delayMs: 2500 });
    expect(result.epoch).toBe(1);
  });

  it("PostToolUseFailure overrides autoNext to thinking", () => {
    const sm = new PetStateMachine();
    const result = sm.transition(event("PostToolUseFailure"));
    expect(result.snapshot.state).toBe("error");
    expect(result.autoNext).toEqual({ state: "thinking", delayMs: 2500 });
    expect(result.epoch).toBe(1);
  });

  it("sets currentTool on PreToolUse, clears on PostToolUse", () => {
    const sm = new PetStateMachine();
    sm.transition(event("PreToolUse", { toolName: "Shell", toolInput: { command: "ls" } }));
    expect(sm.getSnapshot().currentTool).toEqual({ name: "Shell", input: { command: "ls" } });
    sm.transition(event("PostToolUse", { toolName: "Shell" }));
    expect(sm.getSnapshot().currentTool).toBeUndefined();
  });

  it("clears currentTool on Stop and Interrupt", () => {
    const sm = new PetStateMachine();
    sm.transition(event("PreToolUse", { toolName: "Write" }));
    expect(sm.getSnapshot().currentTool).toBeDefined();
    sm.transition(event("Stop"));
    expect(sm.getSnapshot().currentTool).toBeUndefined();

    sm.transition(event("PreToolUse", { toolName: "Shell" }));
    expect(sm.getSnapshot().currentTool).toBeDefined();
    sm.transition(event("Interrupt"));
    expect(sm.getSnapshot().currentTool).toBeUndefined();
  });
});
