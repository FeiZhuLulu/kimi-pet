#!/usr/bin/env node
/**
 * Launch the Kimi Pet daemon (if not running) and the desktop pet window.
 * This script is invoked by the `/pet` slash command in Kimi Code chat.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const PORT = process.env.KIMI_PET_PORT ?? "17373";
const DAEMON_URL = `http://127.0.0.1:${PORT}`;
const PETPACK = process.env.KIMI_PET_PETPACK ?? path.join(PROJECT_ROOT, "pets", "kimi-robot");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: node scripts/start-pet.mjs [options]

Launch the Kimi Pet daemon (if needed) and the desktop pet window.

Options:
  --dry-run    Validate paths and report what would be launched without starting processes.
  --help       Show this help message.

Environment:
  KIMI_PET_PORT      Daemon port (default: 17373)
  KIMI_PET_PETPACK   Path to petpack directory (default: <repo>/pets/kimi-robot)
`);
  process.exit(0);
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function isDaemonRunning() {
  try {
    const res = await fetch(`${DAEMON_URL}/health`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForDaemon(maxMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await isDaemonRunning()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function resolveElectron() {
  const platform = os.platform();
  const exe = platform === "win32" ? "electron.exe" : "electron";

  // Try to resolve the electron package entry point and infer dist/ from it.
  try {
    const pkg = await import.meta.resolve("electron", `file://${path.join(PROJECT_ROOT, "package.json")}`);
    const dist = path.join(path.dirname(pkg), "..", "dist", exe);
    if (await fileExists(dist)) return dist;
  } catch {
    // ignore
  }

  // Common manual / pnpm extraction paths.
  const candidates = [
    path.join(PROJECT_ROOT, "node_modules", ".bin", platform === "win32" ? "electron.cmd" : "electron"),
    path.join(PROJECT_ROOT, "node_modules", ".pnpm", "electron@30.5.1", "node_modules", "electron", "dist", exe),
    path.join(PROJECT_ROOT, "node_modules", "electron", "dist", exe),
  ];
  for (const c of candidates) {
    if (await fileExists(c)) return c;
  }

  // Fall back to PATH
  return platform === "win32" ? "electron.cmd" : "electron";
}

async function startDaemon() {
  const daemonScript = path.join(PROJECT_ROOT, "packages", "pet-daemon", "dist", "cli.js");
  if (!(await fileExists(daemonScript))) {
    throw new Error(`Daemon script not found: ${daemonScript}. Run "pnpm build" first.`);
  }
  const env = { ...process.env, KIMI_PET_PETPACK: PETPACK, KIMI_PET_PORT: PORT };
  if (dryRun) {
    console.log(`[dry-run] Would spawn daemon: node ${daemonScript}`);
    return null;
  }
  const child = spawn(process.execPath, [daemonScript], {
    env,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return child;
}

async function startDesktop() {
  const desktopMain = path.join(PROJECT_ROOT, "apps", "desktop", "dist", "main.js");
  if (!(await fileExists(desktopMain))) {
    throw new Error(`Desktop main not found: ${desktopMain}. Run "pnpm build" first.`);
  }
  const electron = await resolveElectron();
  const env = { ...process.env, KIMI_PET_PORT: PORT };
  if (dryRun) {
    console.log(`[dry-run] Would spawn desktop: ${electron} ${desktopMain}`);
    return null;
  }
  const child = spawn(electron, [desktopMain], {
    env,
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
  return child;
}

async function main() {
  console.log(`[kimi-pet] Checking daemon on port ${PORT}...`);
  const daemonAlreadyRunning = await isDaemonRunning();

  if (dryRun) {
    console.log("[kimi-pet] Dry run mode.");
    console.log(`  daemon health: ${daemonAlreadyRunning ? "running" : "not running"}`);
    console.log(`  petpack: ${PETPACK}`);
    if (!daemonAlreadyRunning) await startDaemon();
    await startDesktop();
    console.log("[kimi-pet] Dry run complete.");
    return;
  }

  let daemonStarted = false;
  if (!daemonAlreadyRunning) {
    console.log("[kimi-pet] Daemon not running; starting...");
    await startDaemon();
    if (!(await waitForDaemon())) {
      console.error("[kimi-pet] Daemon failed to start within 10s.");
      process.exit(1);
    }
    daemonStarted = true;
  } else {
    console.log("[kimi-pet] Daemon already running.");
  }

  console.log("[kimi-pet] Launching desktop pet...");
  await startDesktop();

  console.log("[kimi-pet] " + (daemonStarted ? "Daemon + desktop started." : "Desktop launched."));
}

main().catch((e) => {
  console.error("[kimi-pet]", e.message);
  process.exit(1);
});
