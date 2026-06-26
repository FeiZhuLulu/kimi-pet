# Changelog

## v0.3.0 — install/config safety + lightweight diagnostics

**Safe hooks install/uninstall**
- `install-hooks.mjs` and `uninstall-hooks.mjs` only touch kimi-pet hooks; user-defined hooks are preserved
- Ownership judged by command string (`kimi-pet-hook`, `kimi-hooks-adapter`)
- Format-aware: preserves existing `hooks = [...]` or `[[hooks]]` format; rejects mixed configs
- Uninstall now creates a backup before modifying

**Config path priority**
- All scripts now use `$KIMI_CODE_HOME` > `~/.kimi-code` > `~/.kimi` (legacy fallback)
- Install scripts write to primary home only; uninstall/doctor scan all candidates
- New shared module: `scripts/kimi-paths.mjs`

**Doctor enhancement**
- New checks: hook events (PermissionRequest/PermissionResult/Interrupt), hook timeout, hook command target, petpack validity
- Updated path resolution to use `kimi-paths.mjs`

Commits: `8b6629c`, `791e3e6`, `818f24f`

---

## v0.2.0 — CLI hooks stability

**Event mapping**
- Mapped `PermissionRequest` → `waiting_approval`, `PermissionResult` → `thinking`, `Interrupt` → `error`
- Registered all 3 events in `install-hooks.mjs`

**Hook timeout**
- All hook entries now include `timeout = 1` (minimum valid value per Kimi Code schema)

**Hook adapter validation**
- Verified `kimi-pet-hook` produces no stdout and always exits 0
- New test: `packages/kimi-hooks-adapter/src/cli.spec.ts`

**Auto-next timer protection**
- Added epoch counter to `PetStateMachine` to prevent stale timers from overriding new state
- Daemon clears all pending timers on each new event and validates epoch before applying
- `PostToolUseFailure` error autoNext now targets `thinking` instead of `idle`
- `currentTool` is cleared on PostToolUse, Stop, Interrupt, PermissionRequest

**Documentation**
- README: Kimi Code CLI marked as primary support path
- VS Code companion marked as experimental

Commits: `08c1904`, `62d4c7a`, `dfbe59b`, `e5c15ee`, `e6e98c7`

---

## v0.1.0 — initial release

- Pet state machine with 8 states: idle, thinking, tool_use, editing, terminal, waiting_approval, success, error
- Kimi Code lifecycle hooks integration (`~/.kimi/config.toml`)
- Electron transparent desktop pet window
- VS Code companion extension (experimental)
- Web preview (Vite)
- MCP server (pet_set_state, pet_say, pet_notify)
- `/pet` slash command
- Default petpack: kimi-robot (8×8 spritesheet, 256×256 cells)
- One-shot install script (`scripts/install-all.mjs`)
- Environment doctor (`scripts/doctor.mjs`)
