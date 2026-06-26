import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ─── Types ──────────────────────────────────────────────────────

export interface DesktopSettings {
  x?: number;
  y?: number;
  scale: number;
  alwaysOnTop: boolean;
  showStateText: boolean;
}

export interface KimiPetSettings {
  version: 1;
  desktop: DesktopSettings;
}

// ─── Defaults ───────────────────────────────────────────────────

const DEFAULT_DESKTOP: DesktopSettings = {
  scale: 1,
  alwaysOnTop: true,
  showStateText: true,
};

const DEFAULT_SETTINGS: KimiPetSettings = {
  version: 1,
  desktop: { ...DEFAULT_DESKTOP },
};

const SCALE_MIN = 0.5;
const SCALE_MAX = 2.0;

// ─── Path ───────────────────────────────────────────────────────

export function getSettingsPath(): string {
  return path.join(os.homedir(), ".kimi-pet", "settings.json");
}

// ─── Normalize ──────────────────────────────────────────────────

function normalizeDesktop(raw: unknown): DesktopSettings {
  const d = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const result: DesktopSettings = { ...DEFAULT_DESKTOP };

  // scale
  if (typeof d.scale === "number" && Number.isFinite(d.scale) && d.scale >= SCALE_MIN && d.scale <= SCALE_MAX) {
    result.scale = d.scale;
  }

  // alwaysOnTop
  if (typeof d.alwaysOnTop === "boolean") {
    result.alwaysOnTop = d.alwaysOnTop;
  }

  // showStateText
  if (typeof d.showStateText === "boolean") {
    result.showStateText = d.showStateText;
  }

  // x/y — only set if finite numbers
  if (typeof d.x === "number" && Number.isFinite(d.x)) {
    result.x = d.x;
  }
  if (typeof d.y === "number" && Number.isFinite(d.y)) {
    result.y = d.y;
  }

  return result;
}

function normalizeSettings(raw: unknown): KimiPetSettings {
  if (typeof raw !== "object" || raw === null) {
    return { ...DEFAULT_SETTINGS, desktop: { ...DEFAULT_DESKTOP } };
  }
  const r = raw as Record<string, unknown>;
  return {
    version: 1,
    desktop: normalizeDesktop(r.desktop),
  };
}

// ─── Load / Save ────────────────────────────────────────────────

let cached: KimiPetSettings | null = null;

export function loadSettings(): KimiPetSettings {
  if (cached) return cached;

  const settingsPath = getSettingsPath();

  try {
    const text = fs.readFileSync(settingsPath, "utf-8");
    const parsed = JSON.parse(text);
    cached = normalizeSettings(parsed);
  } catch (e: any) {
    if (e.code === "ENOENT") {
      // File doesn't exist — use defaults
      cached = { ...DEFAULT_SETTINGS, desktop: { ...DEFAULT_DESKTOP } };
    } else {
      // JSON parse error or other read failure — backup and reset
      try {
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = `${settingsPath}.bak.${ts}`;
        fs.renameSync(settingsPath, backupPath);
      } catch {
        // backup failed — not critical
      }
      cached = { ...DEFAULT_SETTINGS, desktop: { ...DEFAULT_DESKTOP } };
    }
  }

  return cached;
}

export function saveSettings(settings: KimiPetSettings): void {
  const settingsPath = getSettingsPath();
  const dir = path.dirname(settingsPath);

  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
    cached = settings;
  } catch {
    // write failure — not critical, settings just won't persist
  }
}

export function updateDesktopSettings(patch: Partial<DesktopSettings>): KimiPetSettings {
  const settings = loadSettings();
  settings.desktop = { ...settings.desktop, ...patch };
  saveSettings(settings);
  return settings;
}
