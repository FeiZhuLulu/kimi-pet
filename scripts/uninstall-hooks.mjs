#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();
const CONFIG_PATHS = [
  path.join(HOME, ".kimi", "config.toml"),
  path.join(HOME, ".kimi-code", "config.toml"),
];

async function readConfig(configPath) {
  try {
    return await fs.readFile(configPath, "utf-8");
  } catch (e) {
    if ((e).code === "ENOENT") return "";
    throw e;
  }
}

function removeHooksBlock(text) {
  const lines = text.split("\n");
  const result = [];
  let inInlineHooks = false;
  let inArrayHooks = false;
  let bracketDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*hooks\s*=\s*\[\s*$/.test(line)) {
      inInlineHooks = true;
      bracketDepth = 1;
      continue;
    }
    if (inInlineHooks) {
      bracketDepth += (line.match(/\[/g) || []).length;
      bracketDepth -= (line.match(/\]/g) || []).length;
      if (bracketDepth <= 0) {
        inInlineHooks = false;
      }
      continue;
    }

    if (/^\s*\[\[hooks\]\]\s*$/.test(line)) {
      inArrayHooks = true;
      continue;
    }
    if (inArrayHooks) {
      if (/^\s*\[/.test(line) && !/^\s*\[\[hooks\]\]\s*$/.test(line)) {
        inArrayHooks = false;
        result.push(line);
      }
      continue;
    }

    result.push(line);
  }

  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function uninstallFrom(configPath) {
  const text = await readConfig(configPath);
  if (!text) {
    console.log(`Config not found, skipping: ${configPath}`);
    return;
  }
  const cleaned = removeHooksBlock(text);
  const newConfig = cleaned ? `${cleaned}\n\nhooks = []\n` : `hooks = []\n`;
  await fs.writeFile(configPath, newConfig);
  console.log(`Removed Kimi Pet hooks from ${configPath}`);
}

async function main() {
  for (const configPath of CONFIG_PATHS) {
    try {
      await uninstallFrom(configPath);
    } catch (e) {
      console.error(`Failed to uninstall from ${configPath}:`, e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
