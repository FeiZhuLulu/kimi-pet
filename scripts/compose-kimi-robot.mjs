#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composeRows } from "../packages/pet-assets/dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const sourceDir = path.join(projectRoot, "assets", "kimi-robot", "source-normalized");
const outDir = path.join(projectRoot, "pets", "kimi-robot");

try {
  await composeRows({ sourceDir, outDir });
  console.log(`✓ Composed petpack: ${outDir}`);
} catch (e) {
  console.error(`✗ Failed to compose: ${e.message}`);
  process.exit(1);
}
