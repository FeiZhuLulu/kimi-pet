#!/usr/bin/env node
/**
 * Remove the globally installed `/pet` slash command.
 * Scans all candidate homes to clean up legacy installations too.
 */
import fs from "node:fs/promises";
import { getCandidateCommandPaths } from "./kimi-paths.mjs";

async function main() {
  for (const target of getCandidateCommandPaths()) {
    try {
      await fs.unlink(target);
      console.log(`Removed ${target}`);
    } catch (e) {
      if (e.code !== "ENOENT") {
        console.error(`Failed to remove ${target}:`, e.message);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
