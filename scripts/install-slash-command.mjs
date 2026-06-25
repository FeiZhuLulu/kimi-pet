#!/usr/bin/env node
/**
 * Install the `/pet` slash command into Kimi Code's global command directory.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPrimaryCommandPath } from "./kimi-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(PROJECT_ROOT, ".kimi", "commands", "pet.md");

async function main() {
  if (!(await fs.access(SOURCE).then(() => true).catch(() => false))) {
    console.error(`Source command not found: ${SOURCE}`);
    process.exit(1);
  }

  const target = getPrimaryCommandPath();
  const dir = path.dirname(target);

  await fs.mkdir(dir, { recursive: true });

  const repoRoot = PROJECT_ROOT.replace(/\\/g, "/");
  let content = await fs.readFile(SOURCE, "utf-8");
  content = content.replace(/<repo-root>/g, repoRoot);

  await fs.writeFile(target, content);
  console.log(`Installed /pet command to ${target}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
