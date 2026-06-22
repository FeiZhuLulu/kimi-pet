#!/usr/bin/env node
/**
 * Remove the globally installed `/pet` slash command.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TARGETS = [
  path.join(os.homedir(), ".kimi", "commands", "pet.md"),
  path.join(os.homedir(), ".kimi-code", "commands", "pet.md"),
];

async function main() {
  for (const target of TARGETS) {
    try {
      await fs.unlink(target);
      console.log(`Removed ${target}`);
    } catch (e) {
      if ((e).code !== "ENOENT") {
        console.error(`Failed to remove ${target}:`, e.message);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
