import type { PetEvent, PetState, PetStateSnapshot } from "@kimi-pet/shared-types";
import { mapKimiEventToState } from "./kimiMapping.js";

export interface StateTransitionResult {
  snapshot: PetStateSnapshot;
  autoNext?: {
    state: PetState;
    delayMs: number;
  };
}

const AUTO_NEXT_DELAYS: Partial<Record<PetState, { state: PetState; delayMs: number }>> = {
  success: { state: "idle", delayMs: 2000 },
  error: { state: "idle", delayMs: 2500 },
};

export class PetStateMachine {
  private current: PetStateSnapshot;

  constructor(initial: PetState = "idle") {
    this.current = {
      state: initial,
      since: new Date().toISOString(),
    };
  }

  getSnapshot(): PetStateSnapshot {
    return { ...this.current };
  }

  transition(event: PetEvent): StateTransitionResult {
    const newState = mapKimiEventToState(event);
    const previousState = this.current.state;

    this.current = {
      state: newState,
      previousState,
      since: new Date().toISOString(),
      sessionId: event.sessionId ?? this.current.sessionId,
      cwd: event.cwd ?? this.current.cwd,
      currentTool: event.toolName
        ? { name: event.toolName, input: event.toolInput }
        : this.current.currentTool,
      message: event.message,
    };

    const result: StateTransitionResult = {
      snapshot: this.getSnapshot(),
    };

    const autoNext = AUTO_NEXT_DELAYS[newState];
    if (autoNext) {
      result.autoNext = autoNext;
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
}
