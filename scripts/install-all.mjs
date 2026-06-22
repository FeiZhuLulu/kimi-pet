#!/usr/bin/env node
/**
 * One-shot setup script for Kimi Pet.
 *
 * Usage:
 *   node scripts/install-all.mjs
 *
 * It will:
 *   1. Install dependencies with pnpm (via corepack if pnpm is not on PATH)
 *   2. Build all packages and apps
 *   3. Install Kimi lifecycle hooks
 *   4. Install the `/pet` slash command globally
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const IS_WIN = os.platform() === "win32";

function run(cmd, args, opts = {}) {
  const needsShell = IS_WIN && /\.(cmd|bat|ps1)$/i.test(cmd);
  return new Promise((resolve, reject) => {
    console.log(`> ${cmd} ${args.join(" ")}`);
    const child = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      shell: needsShell,
      ...opts,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });
  });
}

async function findPnpm() {
  const localBin = path.join(PROJECT_ROOT, "node_modules", ".bin", IS_WIN ? "pnpm.cmd" : "pnpm");
  if (await fs.access(localBin).then(() => true).catch(() => false)) {
    return { cmd: localBin, prefix: [] };
  }
  try {
    await run("pnpm", ["--version"], { stdio: "pipe" });
    return { cmd: "pnpm", prefix: [] };
  } catch {
    return { cmd: IS_WIN ? "corepack.cmd" : "corepack", prefix: ["pnpm"] };
  }
}

async function main() {
  console.log("\nThe following will be executed:");
  console.log("  run:    corepack pnpm install (or skip if node_modules exists)");
  console.log("  run:    corepack pnpm -r build");
  console.log("  modify: ~/.kimi/config.toml and/or ~/.kimi-code/config.toml (hooks)");
  console.log("  modify: ~/.kimi/commands/pet.md and/or ~/.kimi-code/commands/pet.md (/pet)");
  console.log("  modify: Kimi Code plugin registration");
  console.log("");
  if (!process.argv.includes("--yes") && !process.argv.includes("-y")) {
    if (!process.stdout.isTTY) {
      console.error("Non-interactive shell detected. Re-run with --yes to install.");
      process.exit(1);
    }
    const { createInterface } = await import("node:readline/promises");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const ans = (await rl.question("Continue? [y/N] ")).trim().toLowerCase();
      if (ans !== "y" && ans !== "yes") {
        console.log("Aborted. Re-run with --yes to skip this prompt.");
        return;
      }
    } finally {
      rl.close();
    }
  }

  const nodeModules = path.join(PROJECT_ROOT, "node_modules");
  const alreadyInstalled = await fs.access(nodeModules).then(() => true).catch(() => false);

  const { cmd, prefix } = await findPnpm();

  if (!alreadyInstalled) {
    console.log("\n[kimi-pet] Installing dependencies...\n");
    await run(cmd, [...prefix, "install"]);
  } else {
    console.log("\n[kimi-pet] node_modules already exists; skipping install.\n");
  }

  console.log("\n[kimi-pet] Building packages and apps...\n");
  try {
    await run(cmd, [...prefix, "-r", "build"]);
  } catch (e) {
    console.error("[kimi-pet] Build step failed:", e.message);
    console.error("[kimi-pet] Please run 'pnpm build' manually, then re-run install-all.");
    process.exit(1);
  }

  console.log("\n[kimi-pet] Installing Kimi lifecycle hooks...\n");
  await run(process.execPath, [path.join(PROJECT_ROOT, "scripts", "install-hooks.mjs")]);

  console.log("\n[kimi-pet] Installing /pet slash command...\n");
  await run(process.execPath, [path.join(PROJECT_ROOT, "scripts", "install-slash-command.mjs")]);

  console.log("\n[kimi-pet] Installing Kimi Pet plugin...\n");
  await run(process.execPath, [path.join(PROJECT_ROOT, "scripts", "install-plugin.mjs")]);

  console.log("\n[kimi-pet] Setup complete.");
  console.log("  - Type `/pet` in Kimi Code chat to launch the desktop companion.");
  console.log("  - Or run: node scripts/start-pet.mjs");
}

main().catch((e) => {
  console.error("[kimi-pet] Setup failed:", e.message);
  process.exit(1);
});
