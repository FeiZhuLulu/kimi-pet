#!/usr/bin/env node
/**
 * Install the Kimi Pet plugin to the primary Kimi home.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPrimaryPluginDir } from "./kimi-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(PROJECT_ROOT, "plugins", "kimi-pet", "plugin.json");

async function main() {
  if (!(await fs.access(SOURCE).then(() => true).catch(() => false))) {
    console.error(`Source plugin not found: ${SOURCE}`);
    process.exit(1);
  }

  const dir = getPrimaryPluginDir();
  const target = path.join(dir, "plugin.json");

  await fs.mkdir(dir, { recursive: true });

  const repoRoot = PROJECT_ROOT.replace(/\\/g, "/");
  let content = await fs.readFile(SOURCE, "utf-8");
  content = content.replace(/<PROJECT_ROOT>/g, repoRoot);

  await fs.writeFile(target, content);
  console.log(`Installed Kimi Pet plugin to ${target}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
