#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePetPack } from "../packages/pet-assets/dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const arg = process.argv[2];
const petDir = arg
  ? path.resolve(arg)
  : path.join(projectRoot, "pets", "kimi-robot");

const result = await validatePetPack(petDir);

console.log(`ok: ${result.ok}`);
console.log(`pet: ${result.pet ?? "unknown"}`);
console.log(`spritesheet: ${result.spritesheet?.width ?? 0}×${result.spritesheet?.height ?? 0}`);
console.log(`cell: ${result.cell?.width ?? 0}×${result.cell?.height ?? 0}`);

if (result.errors.length) {
  console.log("\nerrors:");
  for (const err of result.errors) {
    console.log(`- [${err.code}] ${err.message}`);
  }
}

if (result.warnings.length) {
  console.log("\nwarnings:");
  for (const warn of result.warnings) {
    console.log(`- [${warn.code}] ${warn.message}`);
  }
}

process.exit(result.ok ? 0 : 1);
