import type { PetEvent, PetState } from "@kimi-pet/shared-types";

export function mapToolNameToState(toolName: string): PetState {
  const n = toolName.toLowerCase();

  if (n.includes("shell") || n.includes("terminal") || n.includes("bash")) {
    return "terminal";
  }

  if (
    n.includes("edit") ||
    n.includes("write") ||
    n.includes("multiedit") ||
    n.includes("patch") ||
    n.includes("replace")
  ) {
    return "editing";
  }

  return "tool_use";
}

function isToolError(event: PetEvent): boolean {
  const output = event.toolInput && typeof event.toolInput === "object"
    ? (event.toolInput as Record<string, unknown>).toolOutput
    : undefined;

  if (typeof output === "string") {
    return output.includes("is_error=True");
  }

  if (output && typeof output === "object") {
    return (output as Record<string, unknown>).is_error === true;
  }

  return false;
}

export function mapKimiEventToState(event: PetEvent): PetState {
  if (event.state) return event.state;

  const type = event.type;

  switch (type) {
    case "SessionStart":
    case "SessionEnd":
      return "idle";

    case "UserPromptSubmit":
    case "SubagentStart":
    case "SubagentStop":
    case "PreCompact":
    case "PostCompact":
    case "Notification":
      return "thinking";

    case "PreToolUse":
      return mapToolNameToState(event.toolName ?? "");

    case "PostToolUse":
      return isToolError(event) ? "error" : "thinking";

    case "PostToolUseFailure":
      return "error";

    case "Stop":
      return "success";

    case "StopFailure":
      return "error";

    case "wrapper.start":
      return "idle";

    case "wrapper.exit":
      return "idle";

    case "wrapper.error":
      return "error";

    default:
      return "thinking";
  }
}
