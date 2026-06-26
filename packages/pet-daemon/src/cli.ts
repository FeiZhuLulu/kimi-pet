#!/usr/bin/env node
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { PetDaemon } from "./daemon.js";

const port = Number(process.env.KIMI_PET_PORT ?? "17373");
const host = process.env.KIMI_PET_HOST ?? "127.0.0.1";
const cwdPetPack = path.join(process.cwd(), "pets", "kimi-block");
const homePetPack = path.join(os.homedir(), ".kimi-pet", "pets", "kimi-block");
const defaultPetPack = fsSync.existsSync(cwdPetPack) ? cwdPetPack : homePetPack;
const petPackDir = process.env.KIMI_PET_PETPACK ?? defaultPetPack;

async function main() {
  const daemon = new PetDaemon({ port, host, petPackDir });

  process.on("SIGINT", async () => {
    await daemon.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await daemon.stop();
    process.exit(0);
  });

  await daemon.start();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
