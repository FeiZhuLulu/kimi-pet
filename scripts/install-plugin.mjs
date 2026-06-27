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
const SOURCE_DIR = path.join(PROJECT_ROOT, "plugins", "kimi-pet");

async function main() {
  const pluginJsonSource = path.join(SOURCE_DIR, "plugin.json");
  if (!(await fs.access(pluginJsonSource).then(() => true).catch(() => false))) {
    console.error(`Source plugin not found: ${pluginJsonSource}`);
    process.exit(1);
  }

  const dir = getPrimaryPluginDir();
  await fs.mkdir(dir, { recursive: true });

  // Copy the whole plugin directory (skills, etc.), then rewrite plugin.json and skill
  // markdown files so that <PROJECT_ROOT> points to the actual repo location.
  await fs.cp(SOURCE_DIR, dir, { recursive: true, force: true });

  const repoRoot = PROJECT_ROOT.replace(/\\/g, "/");

  const targetPluginJson = path.join(dir, "plugin.json");
  let pluginContent = await fs.readFile(pluginJsonSource, "utf-8");
  pluginContent = pluginContent.replace(/<PROJECT_ROOT>/g, repoRoot);
  await fs.writeFile(targetPluginJson, pluginContent);

  const skillsDir = path.join(dir, "skills");
  const skillFiles = [];
  try {
    for (const entry of await fs.readdir(skillsDir, { withFileTypes: true, recursive: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        skillFiles.push(path.join(entry.parentPath ?? entry.path, entry.name));
      }
    }
  } catch {
    // skills directory may not exist
  }
  for (const skillFile of skillFiles) {
    let skillContent = await fs.readFile(skillFile, "utf-8");
    skillContent = skillContent.replace(/<PROJECT_ROOT>/g, repoRoot);
    await fs.writeFile(skillFile, skillContent);
  }

  console.log(`Installed Kimi Pet plugin to ${dir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
