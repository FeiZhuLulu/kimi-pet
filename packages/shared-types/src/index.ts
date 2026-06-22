export type PetState =
  | "idle"
  | "thinking"
  | "tool_use"
  | "editing"
  | "terminal"
  | "waiting_approval"
  | "success"
  | "error";

export type PetEventSource =
  | "kimi-hooks"
  | "kimi-mcp"
  | "kimi-wrapper"
  | "vscode-companion"
  | "manual"
  | "unknown";

export interface PetEvent {
  id: string;
  ts: string;
  source: PetEventSource;
  type: string;
  state?: PetState;
  sessionId?: string;
  cwd?: string;
  toolName?: string;
  toolInput?: unknown;
  message?: string;
  raw?: unknown;
}

export interface PetStateSnapshot {
  state: PetState;
  previousState?: PetState;
  since: string;
  sessionId?: string;
  cwd?: string;
  currentTool?: {
    name: string;
    input?: unknown;
  };
  message?: string;
}

export interface PetAnimation {
  row: number;
  frames: number;
  fps: number;
  loop: boolean;
  next?: PetState;
}

export interface PetPackManifest {
  schemaVersion: string;
  id: string;
  displayName: string;
  description?: string;
  asset: {
    type: "spritesheet";
    path: string;
    cellWidth: number;
    cellHeight: number;
    columns: number;
    rows: number;
  };
  animations: Record<PetState, PetAnimation>;
}

export interface LoadedPetPack {
  manifest: PetPackManifest;
  absoluteSpritesheetPath: string;
}
