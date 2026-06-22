#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const realKimi = process.env.KIMI_PET_REAL_KIMI || "kimi";

const DAEMON_URL = process.env.KIMI_PET_DAEMON_URL ?? "http://127.0.0.1:17373/events";
const LOG_DIR = path.join(os.homedir(), ".kimi-pet", "logs");

function log(msg: string): void {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(
    path.join(LOG_DIR, "wrapper.log"),
    JSON.stringify({ time: new Date().toISOString(), msg }) + "\n"
  );
}

async function postEvent(type: string, extras: Record<string, unknown> = {}): Promise<void> {
  try {
    await fetch(DAEMON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        source: "kimi-wrapper",
        type,
        ...extras,
      }),
    });
  } catch (e) {
    log(`daemon post failed: ${(e as Error).message}`);
  }
}

async function main() {
  log(`wrapper started: argv=${JSON.stringify(process.argv)} cwd=${process.cwd()}`);

  await postEvent("wrapper.start", {
    cwd: process.cwd(),
    argv: process.argv,
  });

  const child = spawn(realKimi, process.argv.slice(2), {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", async (code, signal) => {
    log(`real kimi exited: code=${code} signal=${signal}`);
    await postEvent("wrapper.exit", { code, signal });
    process.exit(code ?? 0);
  });

  child.on("error", async (err) => {
    log(`real kimi error: ${err.message}`);
    await postEvent("wrapper.error", { message: err.message });
    process.exit(1);
  });
}

main();
