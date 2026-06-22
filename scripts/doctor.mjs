#!/usr/bin/env node
/**
 * Kimi Pet environment doctor (read-only).
 *
 * Usage: node scripts/doctor.mjs
 *
 * Checks Node, pnpm, petpack files, build dist files, 17373 port,
 * Kimi config, hooks, and /pet command. Exits 0 if no [FAIL],
 * 1 if any [FAIL]. [WARN] is advisory and does not affect exit code.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const IS_WIN = platform() === "win32";
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
      existsSync(join(ROOT, "pets/kimi-robot/pet.json"))
        ? { level: "ok", message: "pets/kimi-robot/pet.json" }
        : {
            level: "fail",
            message: "pets/kimi-robot/pet.json missing",
            fix: "Check pets/kimi-robot/ directory is complete",
          },
  },
  {
    id: "spritesheet",
    run: () =>
      existsSync(join(ROOT, "pets/kimi-robot/spritesheet.webp"))
        ? { level: "ok", message: "pets/kimi-robot/spritesheet.webp" }
        : {
            level: "fail",
            message: "pets/kimi-robot/spritesheet.webp missing",
            fix: "Check pets/kimi-robot/ directory is complete",
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
      const paths = [
        join(homedir(), ".kimi", "config.toml"),
        join(homedir(), ".kimi-code", "config.toml"),
      ];
      const found = paths.find((p) => existsSync(p));
      if (found) return { level: "ok", message: found };
      return {
        level: "fail",
        message: "no Kimi config found",
        fix: "Launch Kimi Code once to generate ~/.kimi/ or ~/.kimi-code/",
      };
    },
  },
  {
    id: "hooks",
    run: () => {
      const paths = [
        join(homedir(), ".kimi", "config.toml"),
        join(homedir(), ".kimi-code", "config.toml"),
      ];
      for (const p of paths) {
        const content = readIfExists(p);
        if (content && content.includes("kimi-pet-hook")) {
          return { level: "ok", message: `kimi-pet hooks in ${p}` };
        }
      }
      return {
        level: "warn",
        message: "kimi-pet hooks not registered",
        fix: "node scripts/install-hooks.mjs",
      };
    },
  },
  {
    id: "pet-command",
    run: () => {
      const paths = [
        join(homedir(), ".kimi", "commands", "pet.md"),
        join(homedir(), ".kimi-code", "commands", "pet.md"),
      ];
      const found = paths.find((p) => existsSync(p));
      if (found) return { level: "ok", message: `/pet at ${found}` };
      return {
        level: "warn",
        message: "/pet command not installed",
        fix: "node scripts/install-slash-command.mjs",
      };
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
