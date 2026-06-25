/**
 * Kimi Code configuration path resolution.
 *
 * Priority (matches Kimi Code's own logic):
 *   1. $KIMI_CODE_HOME env var  (if set)
 *   2. ~/.kimi-code             (default)
 *   3. ~/.kimi                  (legacy fallback — read-only, never written to)
 */

import os from "node:os";
import path from "node:path";

const HOME = os.homedir();

/**
 * The primary Kimi home directory for WRITING new config.
 * Install scripts use this — they only write to one location.
 */
export function getPrimaryKimiHome() {
  if (process.env.KIMI_CODE_HOME) return process.env.KIMI_CODE_HOME;
  return path.join(HOME, ".kimi-code");
}

/**
 * All candidate Kimi home directories for READING/SCANNING.
 * Doctor and diagnostics use this to find existing config across all locations.
 * Order: primary first, then other known locations.
 */
export function getCandidateKimiHomes() {
  const primary = getPrimaryKimiHome();
  const kimiCode = path.join(HOME, ".kimi-code");
  const legacy = path.join(HOME, ".kimi");

  const homes = [primary];
  if (kimiCode !== primary) homes.push(kimiCode);
  if (legacy !== primary && legacy !== kimiCode) homes.push(legacy);

  return homes;
}

/** config.toml path for the primary Kimi home. */
export function getPrimaryConfigPath() {
  return path.join(getPrimaryKimiHome(), "config.toml");
}

/** config.toml paths across all candidate homes. */
export function getCandidateConfigPaths() {
  return getCandidateKimiHomes().map((h) => path.join(h, "config.toml"));
}

/** commands/pet.md path for the primary Kimi home. */
export function getPrimaryCommandPath() {
  return path.join(getPrimaryKimiHome(), "commands", "pet.md");
}

/** commands/pet.md paths across all candidate homes. */
export function getCandidateCommandPaths() {
  return getCandidateKimiHomes().map((h) => path.join(h, "commands", "pet.md"));
}

/** plugins/kimi-pet directory for the primary Kimi home. */
export function getPrimaryPluginDir() {
  return path.join(getPrimaryKimiHome(), "plugins", "kimi-pet");
}

/** plugins/kimi-pet directories across all candidate homes. */
export function getCandidatePluginDirs() {
  return getCandidateKimiHomes().map((h) => path.join(h, "plugins", "kimi-pet"));
}
