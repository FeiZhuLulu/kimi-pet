import type { PetEvent, PetState } from "@kimi-pet/shared-types";

export function normalizeKimiHook(payload: unknown): PetEvent {
  const p = payload as Record<string, unknown>;

  const type =
    (p.hook_event_name as string) ??
    (p.event as string) ??
    (p.type as string) ??
    "unknown";

  return {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    source: "kimi-hooks",
    type,
    sessionId: (p.session_id as string) ?? (p.sessionId as string),
    cwd: (p.cwd as string) ?? undefined,
    toolName: (p.tool_name as string) ?? (p.toolName as string),
    toolInput: summarizeToolInput(
      (p.tool_input as Record<string, unknown>) ??
        (p.toolInput as Record<string, unknown>) ??
        undefined
    ),
    message: deriveMessage(p, type),
    raw: shouldStoreRawEvents() ? payload : undefined,
  };
}

function summarizeToolInput(input: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!input) return undefined;
  const mode = process.env.KIMI_PET_STORE_TOOL_INPUT ?? "summary";
  if (mode === "none") return undefined;
  if (mode === "full") return input;

  // summary mode: keep path/command keys, drop full content
  const summary: Record<string, unknown> = {};
  for (const key of ["path", "command", "name", "toolName"]) {
    if (key in input) summary[key] = input[key];
  }
  return Object.keys(summary).length ? summary : undefined;
}

function deriveMessage(p: Record<string, unknown>, type: string): string | undefined {
  if (type === "Stop" && p.stop_hook_active === false) {
    return "Task completed";
  }
  if (type === "SessionEnd") {
    return `Session ended: ${p.reason ?? "unknown"}`;
  }
  return undefined;
}

function shouldStoreRawEvents(): boolean {
  return process.env.KIMI_PET_STORE_RAW_EVENTS === "true";
}
