#!/usr/bin/env node
/**
 * Install the Kimi Pet plugin to ~/.kimi/plugins/kimi-pet/ and ~/.kimi-code/plugins/kimi-pet/.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(PROJECT_ROOT, "plugins", "kimi-pet", "plugin.json");

const TARGET_DIRS = [
  path.join(os.homedir(), ".kimi", "plugins", "kimi-pet"),
  path.join(os.homedir(), ".kimi-code", "plugins", "kimi-pet"),
];

async function installTo(dir) {
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, "plugin.json");
  const repoRoot = PROJECT_ROOT.replace(/\\/g, "/");

  let content = await fs.readFile(SOURCE, "utf-8");
  content = content.replace(/<PROJECT_ROOT>/g, repoRoot);

  await fs.writeFile(target, content);
  console.log(`Installed Kimi Pet plugin to ${target}`);
}

async function main() {
  if (!(await fs.access(SOURCE).then(() => true).catch(() => false))) {
    console.error(`Source plugin not found: ${SOURCE}`);
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
