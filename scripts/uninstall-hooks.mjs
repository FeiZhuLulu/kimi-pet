#!/usr/bin/env node
/**
 * Remove kimi-pet lifecycle hooks from Kimi Code's config.toml.
 *
 * Only kimi-pet hooks are removed — any user-defined hooks are preserved.
 * A backup is created before any modification.
 */
import {
  CONFIG_PATHS,
  readConfig,
  writeConfig,
  writeBackup,
  removeKimiPetHooks,
} from "./hooks-utils.mjs";

async function uninstallFrom(configPath) {
  const text = await readConfig(configPath);
  if (!text) {
    console.log(`Config not found, skipping: ${configPath}`);
    return;
  }

  await writeBackup(configPath, text);

  const { text: cleaned } = removeKimiPetHooks(text);

  await writeConfig(configPath, cleaned);

  console.log(`Removed Kimi Pet hooks from ${configPath}`);
  console.log(`Backup saved to ${configPath}.kimi-pet.bak`);
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
