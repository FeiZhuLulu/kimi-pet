#!/usr/bin/env node
/**
 * Kimi Pet environment doctor (read-only).
 *
 * Usage: node scripts/doctor.mjs
 *
 * Checks Node, pnpm, petpack files, build dist files, 17373 port,
 * Kimi config, hooks, /pet command, hook freshness, and hook command targets.
 *
 * Exits 0 if no [FAIL], 1 if any [FAIL]. [WARN] is advisory only.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getPrimaryKimiHome,
  getCandidateKimiHomes,
  getCandidateConfigPaths,
  getCandidateCommandPaths,
} from "./kimi-paths.mjs";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const IS_WIN = process.platform === "win32";
const COLOR = Boolean(process.stdout.isTTY);

const color = (code, s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const say = (lvl, msg, fix) => {
  if (lvl === "ok") console.log(color(32, `[OK]    ${msg}`));
  if (lvl === "warn") {
    console.log(color(33, `[WARN]  ${msg}`));
    if (fix) console.log(`        -> ${fix}`);
  }
  if (lvl === "fail") {
    console.log(color(31, `[FAIL]  ${msg}`));
    if (fix) console.log(`        -> ${fix}`);
  }
};

const sh = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || "") };
};

const readIfExists = (p) => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
};

// ─── Hook analysis helpers ──────────────────────────────────────

const KIMI_PET_MARKERS = [
  "kimi-pet-hook",
  "packages/kimi-hooks-adapter",
  "kimi-hooks-adapter/dist/cli.js",
];

function isKimiPetCommand(cmd) {
  const normalized = cmd.replaceAll("\\", "/");
  return KIMI_PET_MARKERS.some((m) => normalized.includes(m));
}

/** Extract all [[hooks]] blocks and inline hooks entries from config text. */
function extractAllHooks(content) {
  const hooks = [];

  // [[hooks]] blocks
  const blockRegex = /\[\[hooks\]\]\s*\n([\s\S]*?)(?=\n\[\[|$)/g;
  let m;
  while ((m = blockRegex.exec(content)) !== null) {
    const block = m[1];
    const eventM = block.match(/event\s*=\s*"([^"]*)"/);
    const commandM = block.match(/command\s*=\s*"([^"]*)"/);
    const timeoutM = block.match(/timeout\s*=\s*(\d+)/);
    if (eventM) {
      hooks.push({
        event: eventM[1],
        command: commandM ? commandM[1] : "",
        timeout: timeoutM ? Number(timeoutM[1]) : undefined,
      });
    }
  }

  // Inline hooks = [...]
  const inlineMatch = content.match(/hooks\s*=\s*\[([\s\S]*?)\]/);
  if (inlineMatch) {
    const inner = inlineMatch[1];
    const entryRegex = /\{([^}]*)\}/g;
    let e;
    while ((e = entryRegex.exec(inner)) !== null) {
      const entry = e[1];
      const eventM = entry.match(/event\s*=\s*"([^"]*)"/);
      const commandM = entry.match(/command\s*=\s*"([^"]*)"/);
      const timeoutM = entry.match(/timeout\s*=\s*(\d+)/);
      if (eventM) {
        hooks.push({
          event: eventM[1],
          command: commandM ? commandM[1] : "",
          timeout: timeoutM ? Number(timeoutM[1]) : undefined,
        });
      }
    }
  }

  return hooks;
}

function getKimiPetHooks(content) {
  return extractAllHooks(content).filter((h) => isKimiPetCommand(h.command));
}

/** Extract file path from a hook command like 'node E:/path/cli.js'. */
function extractCommandPath(command) {
  // node "path with spaces"
  const quoted = command.match(/node\s+["']([^"']+)["']/);
  if (quoted) return quoted[1].replaceAll("\\", "/");
  // node path
  const bare = command.match(/node\s+(\S+)/);
  if (bare) return bare[1].replaceAll("\\", "/");
  return null;
}

// ─── Checks ─────────────────────────────────────────────────────

const SUPPORTED_HOOK_EVENTS = new Set([
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "PostCompact",
  "Stop",
  "StopFailure",
  "Notification",
]);
const REQUIRED_HOOK_EVENTS = Array.from(SUPPORTED_HOOK_EVENTS);

const checks = [
  {
    id: "node",
    run: () => {
      const m = process.version.match(/^v(\d+)/);
      if (m && Number(m[1]) >= 20) {
        return { level: "ok", message: `node ${process.version}` };
      }
      return {
        level: "fail",
        message: `node ${process.version} (need >= 20)`,
        fix: "Install Node 20+ from https://nodejs.org",
      };
    },
  },
  {
    id: "pnpm",
    run: () => {
      const r = sh("pnpm", ["--version"]);
      if (r.ok) return { level: "ok", message: `pnpm ${r.out.trim()}` };
      return {
        level: "fail",
        message: "pnpm not found on PATH",
        fix: "corepack enable && corepack pnpm install",
      };
    },
  },
  {
    id: "pet-json",
    run: () =>
      existsSync(join(ROOT, "pets/kimi-block/pet.json"))
        ? { level: "ok", message: "pets/kimi-block/pet.json" }
        : {
            level: "fail",
            message: "pets/kimi-block/pet.json missing",
            fix: "Check pets/kimi-block/ directory is complete",
          },
  },
  {
    id: "spritesheet",
    run: () =>
      existsSync(join(ROOT, "pets/kimi-block/spritesheet.webp"))
        ? { level: "ok", message: "pets/kimi-block/spritesheet.webp" }
        : {
            level: "fail",
            message: "pets/kimi-block/spritesheet.webp missing",
            fix: "Check pets/kimi-block/ directory is complete",
          },
  },
  {
    id: "dist-desktop",
    run: () =>
      existsSync(join(ROOT, "apps/desktop/dist/main.js"))
        ? { level: "ok", message: "apps/desktop/dist/main.js" }
        : {
            level: "fail",
            message: "apps/desktop/dist/main.js missing",
            fix: "pnpm build",
          },
  },
  {
    id: "dist-daemon",
    run: () =>
      existsSync(join(ROOT, "packages/pet-daemon/dist/daemon.js"))
        ? { level: "ok", message: "packages/pet-daemon/dist/daemon.js" }
        : {
            level: "fail",
            message: "packages/pet-daemon/dist/daemon.js missing",
            fix: "pnpm build",
          },
  },
  {
    id: "port",
    run: () => {
      const findPid = () => {
        if (IS_WIN) {
          const r = sh("netstat", ["-ano", "-p", "TCP"]);
          for (const line of r.out.split(/\r?\n/)) {
            if (!/LISTENING/i.test(line)) continue;
            if (!/:17373\s/.test(line)) continue;
            const m = line.trim().match(/(\d+)\s*$/);
            if (m) return Number(m[1]);
          }
          return null;
        }
        const r = sh("lsof", ["-iTCP:17373", "-sTCP:LISTEN", "-n", "-P"]);
        const first = r.out.split(/\r?\n/)[1];
        const cols = first ? first.trim().split(/\s+/) : null;
        return cols && cols[1] ? Number(cols[1]) : null;
      };
      const pid = findPid();
      if (pid === null || Number.isNaN(pid)) {
        return { level: "ok", message: "port 17373 free" };
      }
      const task = IS_WIN
        ? sh("tasklist", ["/NH", "/FI", `PID eq ${pid}`, "/FO", "CSV"])
        : sh("ps", ["-p", String(pid), "-o", "args="]);
      if (/pet-daemon|kimi-pet/i.test(task.out)) {
        return { level: "ok", message: "pet-daemon running on 17373" };
      }
      return {
        level: "fail",
        message: `port 17373 in use by pid ${pid}`,
        fix: IS_WIN
          ? "netstat -ano | findstr 17373"
          : "lsof -iTCP:17373 -sTCP:LISTEN",
      };
    },
  },
  {
    id: "kimi-config",
    run: () => {
      const found = getCandidateConfigPaths().find((p) => existsSync(p));
      if (found) {
        const isPrimary = found === join(getPrimaryKimiHome(), "config.toml");
        return {
          level: "ok",
          message: isPrimary ? found : `${found} (legacy)`,
        };
      }
      return {
        level: "fail",
        message: "no Kimi config found",
        fix: "Launch Kimi Code CLI once to generate ~/.kimi-code/",
      };
    },
  },
  {
    id: "hooks",
    run: () => {
      const found = getCandidateConfigPaths().find((p) => existsSync(p));
      if (!found) {
        return {
          level: "warn",
          message: "kimi-pet hooks not registered (no config found)",
          fix: "node scripts/install-hooks.mjs",
        };
      }
      const content = readIfExists(found);
      if (content && isKimiPetCommand(content)) {
        return { level: "ok", message: `kimi-pet hooks in ${found}` };
      }
      return {
        level: "warn",
        message: "kimi-pet hooks not registered",
        fix: "node scripts/install-hooks.mjs",
      };
    },
  },
  {
    id: "hooks-events",
    run: () => {
      const found = getCandidateConfigPaths().find((p) => existsSync(p));
      if (!found) return { level: "ok", message: "skipped (no config)" };
      const content = readIfExists(found);
      if (!content || !isKimiPetCommand(content)) {
        return { level: "ok", message: "skipped (no kimi-pet hooks)" };
      }
      const kpHooks = getKimiPetHooks(content);
      const registered = new Set(kpHooks.map((h) => h.event));
      const missing = REQUIRED_HOOK_EVENTS.filter((e) => !registered.has(e));
      const unsupported = Array.from(registered).filter((e) => !SUPPORTED_HOOK_EVENTS.has(e));
      if (missing.length === 0 && unsupported.length === 0) {
        return { level: "ok", message: `hook events complete (${registered.size} events)` };
      }
      const issues = [];
      if (missing.length > 0) issues.push(`missing ${missing.join(", ")}`);
      if (unsupported.length > 0) issues.push(`unsupported ${unsupported.join(", ")}`);
      return {
        level: "warn",
        message: `hooks outdated: ${issues.join("; ")}`,
        fix: "node scripts/install-hooks.mjs",
      };
    },
  },
  {
    id: "hooks-timeout",
    run: () => {
      const found = getCandidateConfigPaths().find((p) => existsSync(p));
      if (!found) return { level: "ok", message: "skipped (no config)" };
      const content = readIfExists(found);
      if (!content || !isKimiPetCommand(content)) {
        return { level: "ok", message: "skipped (no kimi-pet hooks)" };
      }
      const kpHooks = getKimiPetHooks(content);
      const withTimeout = kpHooks.filter((h) => h.timeout !== undefined);
      if (withTimeout.length === 0) {
        return { level: "ok", message: "kimi-pet hooks have no timeout field" };
      }
      return {
        level: "warn",
        message: `${withTimeout.length} kimi-pet hooks still have a timeout field`,
        fix: "node scripts/install-hooks.mjs",
      };
    },
  },
  {
    id: "hooks-command",
    run: () => {
      const found = getCandidateConfigPaths().find((p) => existsSync(p));
      if (!found) return { level: "ok", message: "skipped (no config)" };
      const content = readIfExists(found);
      if (!content || !isKimiPetCommand(content)) {
        return { level: "ok", message: "skipped (no kimi-pet hooks)" };
      }
      const kpHooks = getKimiPetHooks(content);
      for (const h of kpHooks) {
        const cmdPath = extractCommandPath(h.command);
        if (!cmdPath) {
          // Bare command like "kimi-pet-hook" — can't verify
          continue;
        }
        if (!existsSync(cmdPath)) {
          return {
            level: "fail",
            message: `hook command target not found: ${cmdPath}`,
            fix: "pnpm build && node scripts/install-hooks.mjs",
          };
        }
      }
      return { level: "ok", message: "hook command targets exist" };
    },
  },
  {
    id: "pet-command",
    run: () => {
      const found = getCandidateCommandPaths().find((p) => existsSync(p));
      if (found) return { level: "ok", message: `/pet at ${found}` };
      return {
        level: "warn",
        message: "/pet command not installed",
        fix: "node scripts/install-slash-command.mjs",
      };
    },
  },
  {
    id: "petpack",
    run: () => {
      const petJson = join(ROOT, "pets/kimi-block/pet.json");
      const spritesheet = join(ROOT, "pets/kimi-block/spritesheet.webp");
      if (!existsSync(petJson)) {
        return {
          level: "fail",
          message: "default petpack missing (pet.json)",
          fix: "Check pets/kimi-block/ directory",
        };
      }
      if (!existsSync(spritesheet)) {
        return {
          level: "fail",
          message: "default petpack missing (spritesheet.webp)",
          fix: "Check pets/kimi-block/ directory",
        };
      }
      // Try running validate-petpack.mjs if dist exists
      const validateScript = join(ROOT, "scripts/validate-petpack.mjs");
      if (existsSync(validateScript)) {
        const r = sh(process.execPath, [validateScript]);
        if (r.ok) {
          return { level: "ok", message: "default petpack valid" };
        }
        return {
          level: "fail",
          message: "default petpack validation failed",
          fix: "node scripts/validate-petpack.mjs",
        };
      }
      // Files exist but can't validate — just OK
      return { level: "ok", message: "default petpack files present" };
    },
  },
];

let fail = 0;
let warn = 0;
for (const c of checks) {
  const r = c.run();
  say(r.level, r.message, r.fix);
  if (r.level === "fail") fail++;
  else if (r.level === "warn") warn++;
}
console.log(`\n${warn} warnings, ${fail} failures`);
process.exit(fail > 0 ? 1 : 0);
