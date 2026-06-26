---
name: start pet
description: Start the Kimi Pet desktop companion. Use when the user types "/start pet", "/start-pet", or asks to start, open, or launch the desktop pet.
---

# Start Pet

The user wants to launch the Kimi Pet desktop companion.

Steps:
1. Check if the pet is already running by calling `http://127.0.0.1:17373/health`. If it returns `{ ok: true }`, the daemon is running.
2. If the daemon is healthy, check whether an Electron desktop window for the pet is also visible. If both are present, report that the pet is already running and do not start duplicates.
3. If the daemon is not running, launch it together with the desktop window:
   ```bash
   node E:/项目库/桌宠项目/scripts/start-pet.mjs
   ```
4. Wait a few seconds, then verify `http://127.0.0.1:17373/health` returns ok.
5. Keep the response short: confirm the pet is starting or already running.

Note: If the user previously asked to switch to a different petpack via `KIMI_PET_PETPACK`, respect that environment variable. Otherwise the default petpack is `kimi-block`.
