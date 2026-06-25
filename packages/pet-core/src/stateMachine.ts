import type { PetEvent, PetState, PetStateSnapshot } from "@kimi-pet/shared-types";
import { mapKimiEventToState } from "./kimiMapping.js";

export interface StateTransitionResult {
  snapshot: PetStateSnapshot;
  autoNext?: {
    state: PetState;
    delayMs: number;
  };
  epoch?: number;
}

const AUTO_NEXT_DELAYS: Partial<Record<PetState, { state: PetState; delayMs: number }>> = {
  success: { state: "idle", delayMs: 2000 },
  error: { state: "idle", delayMs: 2500 },
};

/** Event types whose result should clear currentTool. */
const TOOL_CLEAR_EVENTS = new Set([
  "PostToolUse",
  "PostToolUseFailure",
  "Stop",
  "StopFailure",
  "Interrupt",
  "PermissionRequest",
]);

export class PetStateMachine {
  private current: PetStateSnapshot;
  private epoch = 0;

  constructor(initial: PetState = "idle") {
    this.current = {
      state: initial,
      since: new Date().toISOString(),
    };
  }

  getSnapshot(): PetStateSnapshot {
    return { ...this.current };
  }

  getEpoch(): number {
    return this.epoch;
  }

  transition(event: PetEvent): StateTransitionResult {
    const newState = mapKimiEventToState(event);
    const previousState = this.current.state;
    this.epoch++;

    // Default: set currentTool on PreToolUse, clear on completion/error events
    let currentTool = this.current.currentTool;
    if (event.toolName && event.type === "PreToolUse") {
      currentTool = { name: event.toolName, input: event.toolInput };
    } else if (TOOL_CLEAR_EVENTS.has(event.type)) {
      currentTool = undefined;
    }

    this.current = {
      state: newState,
      previousState,
      since: new Date().toISOString(),
      sessionId: event.sessionId ?? this.current.sessionId,
      cwd: event.cwd ?? this.current.cwd,
      currentTool,
      message: event.message,
    };

    const result: StateTransitionResult = {
      snapshot: this.getSnapshot(),
    };

    // Determine autoNext: event-specific overrides take priority over defaults
    const autoNext = this.resolveAutoNext(event, newState);
    if (autoNext) {
      result.autoNext = autoNext;
      result.epoch = this.epoch;
    }

    return result;
  }

  setState(state: PetState, message?: string): PetStateSnapshot {
    const previousState = this.current.state;
    this.current = {
      state,
      previousState,
      since: new Date().toISOString(),
      sessionId: this.current.sessionId,
      cwd: this.current.cwd,
      message,
    };
    return this.getSnapshot();
  }

  private resolveAutoNext(
    event: PetEvent,
    newState: PetState
  ): { state: PetState; delayMs: number } | undefined {
    // PostToolUseFailure: error -> thinking (recover to active work)
    if (event.type === "PostToolUseFailure" && newState === "error") {
      return { state: "thinking", delayMs: 2500 };
    }

    return AUTO_NEXT_DELAYS[newState];
  }
}
