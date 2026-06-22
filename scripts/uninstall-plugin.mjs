#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TARGETS = [
  path.join(os.homedir(), ".kimi", "plugins", "kimi-pet"),
  path.join(os.homedir(), ".kimi-code", "plugins", "kimi-pet"),
];

async function main() {
  for (const target of TARGETS) {
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
