#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();
const CONFIG_PATHS = [
  path.join(HOME, ".kimi", "config.toml"),
  path.join(HOME, ".kimi-code", "config.toml"),
];

const HOOK_EVENTS = [
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
];

async function findHookCommand() {
  const candidates = [
    path.join(process.cwd(), "packages", "kimi-hooks-adapter", "dist", "cli.js"),
    path.join(process.cwd(), "node_modules", ".bin", "kimi-pet-hook"),
    path.join(HOME, ".kimi-pet", "node_modules", ".bin", "kimi-pet-hook"),
  ];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      // continue
    }
  }
  return "kimi-pet-hook";
}

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

    // Remove inline hooks = [ ... ]
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

    // Remove [[hooks]] array-of-tables
    if (/^\s*\[\[hooks\]\]\s*$/.test(line)) {
      inArrayHooks = true;
      continue;
    }
    if (inArrayHooks) {
      // Stop at next section header or non-hook key
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

async function installTo(configPath, hookCommand) {
  const backupPath = `${configPath}.kimi-pet.bak`;
  const text = await readConfig(configPath);
  const cleaned = removeHooksBlock(text);

  const newHooks = HOOK_EVENTS.map(
    (event) => `  { event = "${event}", command = "${hookCommand}" }`
  ).join(",\n");
  const newHooksBlock = `hooks = [\n${newHooks}\n]`;

  const newConfig = cleaned ? `${newHooksBlock}\n\n${cleaned}` : newHooksBlock;

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(backupPath, text);
  await fs.writeFile(configPath, newConfig + "\n");

  console.log(`Installed Kimi Pet hooks to ${configPath}`);
  console.log(`Backup saved to ${backupPath}`);
}

async function main() {
  const hookCmd = await findHookCommand();
  const hookCommand = `node ${hookCmd.replace(/\\/g, "/")}`;

  for (const configPath of CONFIG_PATHS) {
    try {
      await installTo(configPath, hookCommand);
    } catch (e) {
      console.error(`Failed to install to ${configPath}:`, e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
