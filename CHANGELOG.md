# Changelog

## v0.4.2 — skill install portability

- Fixed hardcoded absolute path in `plugins/kimi-pet/skills/start-pet/SKILL.md`.
- Updated `scripts/install-plugin.mjs` to substitute `<PROJECT_ROOT>` in skill markdown files, so the skill works after cloning the repo to any location.
- Added README note about running `node scripts/install-plugin.mjs` when `/start pet` is not available.

Verified by cloning the GitHub repo to a temporary directory and running `install-plugin.mjs`; the installed skill correctly pointed to the clone path.

## v0.4.1 — hook config hotfix

- Removed unsupported hook events (`PermissionRequest`, `PermissionResult`, `Interrupt`) from `install-hooks.mjs`. These events caused `kimi doctor` to fail with `hooks[15]: Invalid input` because Kimi Code does not recognize them.
- Removed `timeout = 1` from generated hook entries; current Kimi Code schema rejects the `timeout` field on hooks.
- Updated `doctor.mjs` to warn about unsupported hook events and about any `timeout` field still present in existing installs.

If you previously ran `install-hooks.mjs` and Kimi Code started failing validation, re-run:

```bash
node scripts/install-hooks.mjs
```

This will rewrite only the kimi-pet hooks (preserving your other hooks) and remove the invalid entries.

## v0.4.0 — desktop experience polish

### Added

- **Desktop settings persistence**: window position, scale, state-text visibility, and always-on-top are saved to `~/.kimi-pet/settings.json` and restored on startup.
- **Window position protection**: on launch the window is checked against current display work areas; if it is off-screen (e.g. after a display change), it snaps back to the primary display bottom-right corner.
- **Scale presets**: right-click menu provides 75%, 100%, 125%, 150%, and 200% scale options.
- **Right-click toggles**: Show State Text, Always on Top, and Reset Position.
- **Interactive scale handle**: drag the circular resize handle to scale the pet in real time; scale is saved after the drag ends.
- **Corrupt settings fallback**: if `settings.json` is malformed, it is backed up and defaults are used.

### Changed

- Right-click state menu now lists `idle`, `thinking`, `tool_use`, `editing`, `waiting_approval`, `success`, `error` (manual `terminal` entry removed).
- Improved topmost-window survival against system overlays such as Snipping Tool.
- Lowered `terminal` animation FPS from 10 to 6.

### Fixed

- Transparent Electron window disappearing after screenshots.
- Window position being lost between sessions.
- Scale changes not persisting.

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
