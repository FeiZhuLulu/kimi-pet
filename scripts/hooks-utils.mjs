/**
 * Shared utilities for safely managing kimi-pet hooks in Kimi Code config.toml.
 *
 * Key invariants:
 *   - Only hooks whose `command` matches kimi-pet are touched.
 *   - User-defined hooks are always preserved.
 *   - The existing hooks format (inline vs block) is preserved.
 *   - hooks = [...] and [[hooks]] are never mixed.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const HOME = os.homedir();

export const CONFIG_PATHS = [
  path.join(HOME, ".kimi", "config.toml"),
  path.join(HOME, ".kimi-code", "config.toml"),
];

/** Patterns that identify a kimi-pet hook by its command string. */
const KIMI_PET_MARKERS = [
  "kimi-pet-hook",
  "packages/kimi-hooks-adapter",
  "kimi-hooks-adapter/dist/cli.js",
];

/** Returns true if the command string belongs to a kimi-pet hook. */
export function isKimiPetCommand(cmd) {
  const normalized = cmd.replaceAll("\\", "/");
  return KIMI_PET_MARKERS.some((marker) => normalized.includes(marker));
}

// ─── Format detection ───────────────────────────────────────────

/**
 * Detect the hooks format used in a config string.
 * Returns: "inline" | "block" | "none" | "mixed"
 */
export function detectHooksFormat(text) {
  const lines = text.split("\n");
  let hasInline = false;
  let hasBlock = false;

  for (const line of lines) {
    if (/^\s*hooks\s*=\s*\[/.test(line)) hasInline = true;
    if (/^\s*\[\[hooks\]\]\s*$/.test(line)) hasBlock = true;
  }

  if (hasInline && hasBlock) return "mixed";
  if (hasInline) return "inline";
  if (hasBlock) return "block";
  return "none";
}

// ─── Inline array parsing ───────────────────────────────────────

/**
 * Parse an inline hooks = [...] block into individual entry strings.
 * Each entry is the inner content between { and } (exclusive).
 */
function parseInlineEntries(blockLines) {
  const inner = blockLines.slice(1, -1).join("\n");
  const entries = [];
  let depth = 0;
  let current = "";
  let inString = false;
  let escape = false;

  for (const ch of inner) {
    if (escape) {
      if (depth > 0) current += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      if (depth > 0) current += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      if (depth > 0) current += ch;
      continue;
    }
    if (inString) {
      if (depth > 0) current += ch;
      continue;
    }
    if (ch === "{") {
      depth++;
      if (depth === 1) {
        current = "";
        continue;
      }
    }
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        entries.push(current.trim());
        continue;
      }
    }
    if (depth > 0) current += ch;
  }

  return entries;
}

/** Extract the command value from an inline entry string. */
function extractCommand(entry) {
  const m = entry.match(/command\s*=\s*"([^"]*)"/);
  return m ? m[1] : "";
}

// ─── Block parsing ([[hooks]]) ──────────────────────────────────

/**
 * Split a config into segments. Each segment is either:
 *   { type: "lines", lines: [...] }           — non-hooks content
 *   { type: "inline-hooks", lines: [...] }    — hooks = [...]
 *   { type: "hook-block", lines: [...] }      — [[hooks]] ... block
 */
function segmentConfig(text) {
  const lines = text.split("\n");
  const segments = [];
  let i = 0;
  let current = [];

  function flush() {
    if (current.length > 0) {
      segments.push({ type: "lines", lines: current });
      current = [];
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    // Inline hooks = [...]
    if (/^\s*hooks\s*=\s*\[\s*$/.test(line)) {
      flush();
      const block = [line];
      let depth = 1;
      i++;
      while (i < lines.length && depth > 0) {
        const bl = lines[i];
        depth += (bl.match(/\[/g) || []).length;
        depth -= (bl.match(/\]/g) || []).length;
        block.push(bl);
        i++;
      }
      segments.push({ type: "inline-hooks", lines: block });
      continue;
    }

    // [[hooks]] block
    if (/^\s*\[\[hooks\]\]\s*$/.test(line)) {
      flush();
      const block = [line];
      i++;
      while (i < lines.length) {
        const bl = lines[i];
        // Break on any [section] header (including another [[hooks]])
        if (/^\s*\[/.test(bl)) break;
        block.push(bl);
        i++;
      }
      segments.push({ type: "hook-block", lines: block });
      continue;
    }

    current.push(line);
    i++;
  }

  flush();
  return segments;
}

/** Check if a [[hooks]] block belongs to kimi-pet. */
function isKimiPetBlock(blockLines) {
  const blockText = blockLines.join("\n");
  const m = blockText.match(/command\s*=\s*"([^"]*)"/);
  return m ? isKimiPetCommand(m[1]) : false;
}

// ─── Remove kimi-pet hooks (format-aware) ───────────────────────

/**
 * Remove only kimi-pet hooks from a config string.
 * Returns { text, format } where format is the detected format.
 * Throws if the config has mixed inline+block hooks.
 */
export function removeKimiPetHooks(text) {
  const format = detectHooksFormat(text);

  if (format === "mixed") {
    throw new Error(
      "Config has both hooks = [...] and [[hooks]] — cannot safely edit. " +
      "Please manually consolidate into one format, then re-run."
    );
  }

  if (format === "none") {
    return { text: text.trim(), format };
  }

  const segments = segmentConfig(text);
  const output = [];

  for (const seg of segments) {
    if (seg.type === "lines") {
      output.push(...seg.lines);
    } else if (seg.type === "inline-hooks") {
      // Parse and filter inline entries
      const entries = parseInlineEntries(seg.lines);
      const kept = entries.filter((e) => !isKimiPetCommand(extractCommand(e)));
      if (kept.length > 0) {
        const formatted = kept.map((e) => `  { ${e} }`).join(",\n");
        output.push("hooks = [", formatted, "]");
      }
      // If all were kimi-pet, drop the block entirely
    } else if (seg.type === "hook-block") {
      if (!isKimiPetBlock(seg.lines)) {
        output.push(...seg.lines);
      }
      // If it's a kimi-pet block, drop it
    }
  }

  return { text: output.join("\n").replace(/\n{3,}/g, "\n\n").trim(), format };
}

// ─── Build kimi-pet hooks (format-aware) ────────────────────────

/**
 * Build kimi-pet hooks in the given format.
 * @param {"inline" | "block"} format
 * @param {string[]} events
 * @param {string} hookCommand
 */
export function buildKimiPetHooks(format, events, hookCommand) {
  if (format === "block") {
    return events
      .map(
        (event) =>
          `[[hooks]]\nevent = "${event}"\ncommand = "${hookCommand}"\ntimeout = 1`
      )
      .join("\n\n");
  }
  // inline (default for new installs)
  const entries = events.map(
    (event) => `  { event = "${event}", command = "${hookCommand}", timeout = 1 }`
  );
  return `hooks = [\n${entries.join(",\n")}\n]`;
}

// ─── File I/O helpers ───────────────────────────────────────────

export async function readConfig(configPath) {
  try {
    return await fs.readFile(configPath, "utf-8");
  } catch (e) {
    if (e.code === "ENOENT") return "";
    throw e;
  }
}

export async function writeConfig(configPath, text) {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, text + "\n");
}

export async function writeBackup(configPath, content) {
  const backupPath = `${configPath}.kimi-pet.bak`;
  await fs.writeFile(backupPath, content);
  return backupPath;
}
