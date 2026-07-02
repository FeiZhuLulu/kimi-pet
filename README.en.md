**English** | [简体中文](./README.md)

# Kimi Pet 🐾

A always-on-top transparent desktop pet that watches your [Kimi Code](https://kimi.moonshot.cn/) coding sessions and reacts in real time.

![kimi-block-preview](docs/assets/kimi-block-preview.png)

## Features

- **Live state animations** — idle, thinking, tool_use, editing, waiting_approval, success, error
- **Lifecycle hook integration** — listens to Kimi Code CLI events via `~/.kimi-code/config.toml`
- **Desktop companion** — borderless, transparent, draggable, resizable Electron window; position, scale, state text, and always-on-top settings persist to `~/.kimi-pet/settings.json`
- **Right-click menu** — focus Kimi Code CLI, scale presets (75%–200%), show/hide state text, always on top, reset position, manual state switching
- **Web preview** — open `apps/web-preview` in a browser for a quick demo
- **VS Code side panel** — 🧪 experimental; not the primary integration path (see below)
- **MCP server** — exposes `pet_set_state`, `pet_say`, and `pet_notify` tools
- **`/start pet` skill / `start-pet.bat`** — one-click daemon + desktop pet launch from Kimi Code CLI (the `/pet` slash command will work automatically once Kimi Code supports custom commands)

> **Supported paths:** The primary integration is Kimi Code CLI. The VS Code companion is experimental and not the main target; adaptation for the official Kimi Code VS Code extension is on hold until the plugin is updated.

## Installation

Requirements: Node.js 20+, pnpm 8+ (or `corepack pnpm`), and Kimi Code CLI. Works on Windows, macOS, and Linux.

### Quick install (recommended)

```bash
git clone https://github.com/FeiZhuLulu/kimi-pet.git
cd kimi-pet
corepack enable
node scripts/install-all.mjs
```

`install-all` will: install dependencies → build → register Kimi hooks → register the `/pet` slash command → register the Kimi Code plugin. It prints a plan and asks for y/N confirmation before proceeding.

For non-interactive use (CI / automation), skip confirmation:

```bash
node scripts/install-all.mjs --yes
```

### Manual install

```bash
git clone https://github.com/FeiZhuLulu/kimi-pet.git
cd kimi-pet
corepack enable
corepack pnpm install
corepack pnpm build
node scripts/install-hooks.mjs
node scripts/install-slash-command.mjs
node scripts/install-plugin.mjs
```

Use this for CI pipelines or when you need step-by-step debugging.

## Starting the pet

The current public Kimi Code CLI does not yet support custom `/pet` slash commands. Two ways to start:

### Option 1: Let the agent start it via skill (recommended)

In Kimi Code CLI chat, type:

```text
/start pet
```

The agent reads `~/.kimi-code/plugins/kimi-pet/skills/start-pet/SKILL.md` and runs the launch command automatically.

If `/start pet` does not trigger, the skill is not installed in the Kimi Code plugin directory yet. Run:

```bash
node scripts/install-plugin.mjs
```

This copies `plugins/kimi-pet/` to `~/.kimi-code/plugins/kimi-pet/` and substitutes `<PROJECT_ROOT>` with your clone path.

### Option 2: Run the start script directly

```bash
node scripts/start-pet.mjs
```

Or on Windows, double-click `start-pet.bat` in the project root.

The script starts the daemon on demand (default port `17373`) and opens the transparent Electron desktop pet window.

Desktop settings (window position, scale, state text visibility, always on top) are saved to `~/.kimi-pet/settings.json`. Delete that file to restore defaults.

> Once Kimi Code CLI supports custom slash commands, the `/pet` command (already installed to `~/.kimi-code/commands/pet.md`) will work automatically.

## Verify installation

```bash
node scripts/doctor.mjs
```

Doctor checks Node / pnpm / petpack / dist artifacts / port 17373 / Kimi config / hooks / `/pet` command, with three levels:

- `[OK]` — passed
- `[WARN]` — informational (does not affect exit code)
- `[FAIL]` — must fix (exit code 1)

Each failure includes the corresponding fix command.

## Uninstall

```bash
node scripts/uninstall-hooks.mjs
node scripts/uninstall-slash-command.mjs
node scripts/uninstall-plugin.mjs
```

## How it works

```text
Kimi Code CLI
        │
        ▼
  lifecycle hooks
        │
        ▼
  kimi-pet-hook
        │
        ▼
    pet-daemon  ◀───────  MCP tools / manual events
        │
        ├──▶  Desktop Electron window
        └──▶  Web preview
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

## Project structure

```text
kimi-pet/
├── apps/
│   ├── desktop/            # Electron transparent desktop pet window
│   ├── vscode-companion/   # VS Code extension panel (⏸️ on hold)
│   └── web-preview/        # Browser demo
├── packages/
│   ├── pet-core/           # State machine + Kimi event mapping
│   ├── pet-daemon/         # HTTP / WebSocket daemon
│   ├── pet-assets/         # Spritesheet utilities
│   ├── kimi-hooks-adapter/ # Kimi config.toml hook bridge
│   ├── kimi-mcp-server/    # Desktop pet MCP server
│   ├── kimi-wrapper/       # Shared Kimi integration helpers
│   └── shared-types/       # Shared TypeScript types
├── pets/
│   ├── kimi-block/         # Default petpack (procedural Canvas blue block robot)
│   └── kimi-robot/         # Alternate petpack (3D-style robot)
├── scripts/
│   ├── install-all.mjs           # One-click install
│   ├── install-hooks.mjs         # Register Kimi hooks
│   ├── install-slash-command.mjs # Register /pet command
│   ├── install-plugin.mjs        # Register Kimi Code plugin
│   ├── start-pet.mjs             # Start daemon + desktop pet
│   └── validate-petpack.mjs      # Validate petpack
├── docs/
│   ├── ARCHITECTURE.md
│   └── assets/               # Screenshots
└── .kimi/commands/pet.md   # Project-level /pet slash command
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages and apps
pnpm build

# Start daemon (dev mode)
pnpm dev:daemon

# Run tests
pnpm test

# Validate default petpack
pnpm validate:petpack
```

## Customizing your pet

The default petpack lives in `pets/kimi-block/`:

- `spritesheet.webp` — 8×8 grid, 256×256 frames per cell
- `pet.json` — animation metadata (row, frames, fps, loop, next)

Replace or extend these files, then restart the daemon. Use `scripts/validate-petpack.mjs` to validate your changes.

## Built-in petpacks

This repo ships two petpacks:

- `pets/kimi-block/` — default petpack; a minimal blue block robot generated procedurally via Canvas. Source: `assets/kimi-block/source/canvas-generator.html`.
- `pets/kimi-robot/` — alternate petpack; 256×256 8×8 grid.

### Temporarily switch to kimi-robot

Set the environment variable:

```powershell
$env:KIMI_PET_PETPACK="E:\path\to\kimi-pet\pets\kimi-robot"
node scripts/start-pet.mjs
```

```bash
# macOS / Linux
KIMI_PET_PETPACK=/path/to/pets/kimi-robot node scripts/start-pet.mjs
```

### Re-export kimi-block assets

1. Open `assets/kimi-block/source/canvas-generator.html` in a browser.
2. Switch to transparent background mode and download `desktop_pet_spritesheet_transparent.png`.
3. Rename to `spritesheet.png` and place in `assets/kimi-block/dist/`.
4. Convert to lossless WebP:

```bash
node -e "import sharp from 'sharp'; await sharp('assets/kimi-block/dist/spritesheet.png').webp({ lossless: true }).toFile('assets/kimi-block/dist/spritesheet.webp')"
```

5. Copy to the petpack:

```bash
cp assets/kimi-block/dist/spritesheet.webp pets/kimi-block/spritesheet.webp
```

6. Validate:

```bash
node scripts/validate-petpack.mjs pets/kimi-block
```

> Note: The desktop app and web-preview do not perform green-screen chroma keying at runtime, so `spritesheet.webp` must have a transparent background. If you only have a green-screen version, chroma key it first.

## Troubleshooting

See [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) for Electron download failures, missing `/pet`, daemon port conflicts, and more.

### Mirrors for China

On slower or blocked networks, Electron binaries and the pnpm registry may fail. Set mirrors before installing.

PowerShell:

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:npm_config_electron_mirror="https://npmmirror.com/mirrors/electron/"
pnpm config set registry https://registry.npmmirror.com
pnpm install
```

CMD:

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set npm_config_electron_mirror=https://npmmirror.com/mirrors/electron/
pnpm config set registry https://registry.npmmirror.com
pnpm install
```

macOS / Linux:

```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export npm_config_electron_mirror=https://npmmirror.com/mirrors/electron/
pnpm config set registry https://registry.npmmirror.com
pnpm install
```

Restore official sources:

```powershell
Remove-Item Env:ELECTRON_MIRROR -ErrorAction SilentlyContinue
Remove-Item Env:npm_config_electron_mirror -ErrorAction SilentlyContinue
pnpm config set registry https://registry.npmjs.org
```

```bat
set ELECTRON_MIRROR=
set npm_config_electron_mirror=
pnpm config set registry https://registry.npmjs.org
```

```bash
unset ELECTRON_MIRROR npm_config_electron_mirror
pnpm config set registry https://registry.npmjs.org
```

### Common issues

- `/start pet` does nothing or no window appears → kill leftover `electron` / `pet-daemon` processes and retry
- Pet disappears after a screenshot → right-click **Reset Position** or turn off **Always on Top** and re-enable it
- Window off-screen / lost after display change → right-click **Reset Position**, or delete `~/.kimi-pet/settings.json`
- `doctor` reports missing `dist/*.js` → run `pnpm build`
- `pnpm install` hangs or Electron 404 → see "Mirrors for China" above
- `doctor` reports port 17373 in use → Windows: `netstat -ano | findstr 17373`; macOS / Linux: `lsof -iTCP:17373 -sTCP:LISTEN`, then kill the PID
- `/pet` does not appear in Kimi chat → the public CLI does not support custom slash commands yet; use `/start pet` instead
- Kimi config path `~/.kimi-code/config.toml` (or `$KIMI_CODE_HOME/config.toml`) missing → launch Kimi Code CLI once so it creates the config directory

## Roadmap

- [ ] Linux / macOS desktop experience polish
- [ ] More built-in pets
- [ ] Installer package / GitHub Releases

Version history: [CHANGELOG.md](CHANGELOG.md).

### Experimental — resume after Kimi updates the VS Code extension

- [ ] Native `/pet` slash command in Kimi Code extension (VS Code chat API)
- [ ] Resume VS Code companion extension (vscode-companion)
- [ ] Resume kimi-wrapper development

## License

MIT — see [LICENSE](LICENSE).