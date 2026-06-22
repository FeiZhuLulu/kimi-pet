#!/usr/bin/env node
/**
 * Install the `/pet` slash command into Kimi Code's global command directories.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(PROJECT_ROOT, ".kimi", "commands", "pet.md");

const TARGET_DIRS = [
  path.join(os.homedir(), ".kimi", "commands"),
  path.join(os.homedir(), ".kimi-code", "commands"),
];

async function installTo(dir) {
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, "pet.md");

  const repoRoot = PROJECT_ROOT.replace(/\\/g, "/");

  let content = await fs.readFile(SOURCE, "utf-8");
  // Replace the placeholder with the absolute repository root so the global
  // command works regardless of the current working directory.
  content = content.replace(/<repo-root>/g, repoRoot);

  await fs.writeFile(target, content);
  console.log(`Installed /pet command to ${target}`);
}

async function main() {
  if (!(await fs.access(SOURCE).then(() => true).catch(() => false))) {
    console.error(`Source command not found: ${SOURCE}`);
    process.exit(1);
  }
  for (const dir of TARGET_DIRS) {
    try {
      await installTo(dir);
    } catch (e) {
      console.error(`Failed to install to ${dir}:`, e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
