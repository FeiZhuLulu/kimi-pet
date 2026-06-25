#!/usr/bin/env node
/**
 * Remove the Kimi Pet plugin from all candidate Kimi homes.
 */
import fs from "node:fs/promises";
import { getCandidatePluginDirs } from "./kimi-paths.mjs";

async function main() {
  for (const target of getCandidatePluginDirs()) {
    try {
      await fs.rm(target, { recursive: true, force: true });
      console.log(`Removed ${target}`);
    } catch (e) {
      console.error(`Failed to remove ${target}:`, e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
