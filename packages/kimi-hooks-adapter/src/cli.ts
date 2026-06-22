#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PetEvent } from "@kimi-pet/shared-types";
import { normalizeKimiHook } from "./normalize.js";

const DAEMON_URL = process.env.KIMI_PET_DAEMON_URL ?? "http://127.0.0.1:17373/events";
const FALLBACK_DIR = path.join(os.homedir(), ".kimi-pet", "logs");

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (input += chunk));
    process.stdin.on("end", () => resolve(input));
  });
}

async function appendFallbackLog(event: PetEvent): Promise<void> {
  await fs.mkdir(FALLBACK_DIR, { recursive: true });
  await fs.appendFile(
    path.join(FALLBACK_DIR, "hook-fallback.ndjson"),
    JSON.stringify(event) + "\n"
  );
}

async function postToDaemon(event: PetEvent): Promise<void> {
  const res = await fetch(DAEMON_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    throw new Error(`Daemon returned ${res.status}`);
  }
}

async function main() {
  const input = await readStdin();
  let payload: unknown;
  try {
    payload = input ? JSON.parse(input) : {};
  } catch {
    payload = { raw: input };
  }

  const event = normalizeKimiHook(payload);

  try {
    await postToDaemon(event);
  } catch {
    await appendFallbackLog(event);
  }

  // Always exit 0 to avoid blocking Kimi
  process.exit(0);
}

main().catch(() => process.exit(0));
