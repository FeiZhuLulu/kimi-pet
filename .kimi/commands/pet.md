---
allowed-tools: Shell
description: Launch the Kimi Pet desktop companion
---

Launch the Kimi Pet desktop companion.

Steps:
1. Locate the root of the `kimi-pet` repository (the directory containing this `.kimi/commands/pet.md` file).
2. Run the launcher: `node <repo-root>/scripts/start-pet.mjs`
3. Verify the daemon is healthy at `http://127.0.0.1:17373/health`.
4. If the daemon and desktop window are already running, report that instead of starting duplicates.

Keep your response short: confirm the pet is starting or already running.
