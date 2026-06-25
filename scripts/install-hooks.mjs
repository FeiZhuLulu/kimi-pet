#!/usr/bin/env node
/**
 * Install kimi-pet lifecycle hooks into Kimi Code's config.toml.
 *
 * Only kimi-pet hooks are touched — any user-defined hooks are preserved.
 * The existing hooks format (inline vs block) is maintained.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  CONFIG_PATHS,
  HOME,
  readConfig,
  writeConfig,
  writeBackup,
  removeKimiPetHooks,
  buildKimiPetHooks,
} from "./hooks-utils.mjs";

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
  "PermissionRequest",
  "PermissionResult",
  "Interrupt",
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

async function installTo(configPath, hookCommand) {
  const text = await readConfig(configPath);

  // Remove only kimi-pet hooks; preserve user hooks; detect format
  const { text: cleaned, format } = removeKimiPetHooks(text);

  // Choose output format: match existing, or default to "block" for new configs
  const outputFormat = format === "inline" ? "inline" : "block";

  // Build new kimi-pet hooks in the appropriate format
  const newHooksBlock = buildKimiPetHooks(outputFormat, HOOK_EVENTS, hookCommand);

  // Combine: kimi-pet hooks first, then the rest of the config
  const newConfig = cleaned ? `${newHooksBlock}\n\n${cleaned}` : newHooksBlock;

  await writeBackup(configPath, text);
  await writeConfig(configPath, newConfig);

  console.log(`Installed Kimi Pet hooks to ${configPath}`);
  console.log(`Backup saved to ${configPath}.kimi-pet.bak`);
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
