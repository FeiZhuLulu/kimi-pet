# Kimi Pet 🐾

A transparent, always-on-top desktop pet for [Kimi Code](https://kimi.moonshot.cn/) that reacts to your coding session in real time.

![success](docs/assets/success.png)

## Features

- **Live state animations** — idle, thinking, tool_use, editing, terminal, waiting_approval, success, error
- **Lifecycle hook integration** — listens to Kimi Code CLI/VS Code events via `~/.kimi/config.toml` hooks
- **Desktop companion** — frameless, transparent, drag-to-move, resizable Electron window
- **VS Code side panel** — optional webview companion extension
- **Web preview** — open `apps/web-preview` in a browser for a quick demo
- **MCP server** — expose `pet_set_state`, `pet_say`, `pet_notify` tools
- **`/pet` slash command** — launch the daemon + desktop pet from Kimi Code chat

## 安装

要求：Node.js 20+、pnpm 8+（或用 `corepack pnpm`）、Kimi Code（CLI 或 VS Code 插件）。Windows / macOS / Linux 均可。

### 快速安装（推荐）

```bash
git clone https://github.com/FeiZhuLulu/kimi-pet.git
cd kimi-pet
node scripts/install-all.mjs
```

`install-all` 会：装依赖 → build → 注册 Kimi hooks → 注册 `/pet` slash command → 注册 Kimi Code plugin。执行前会打印计划并要求 y/N 确认；非交互场景（CI / 自动化）请加 `--yes` 或 `-y` 跳过确认。

### 手动安装

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

适合 CI 流水线或需要分步调试的场景。

## 启动

在 Kimi Code 聊天（CLI 或 VS Code 插件）输入：

```text
/pet
```

或在终端运行：

```bash
node scripts/start-pet.mjs
```

VS Code 用户也可在命令面板（`Ctrl+Shift+P`）执行 **Kimi Pet: Launch Desktop Pet**。

脚本会按需启动 daemon（默认端口 `17373`）并打开 Electron 透明桌宠窗口。

## 验证安装

```bash
node scripts/doctor.mjs
```

doctor 会逐项检查 Node / pnpm / petpack / dist 产物 / 17373 端口 / Kimi config / hooks / `/pet` 命令，输出三档：

- `[OK]` — 通过
- `[WARN]` — 提示性（不影响退出码）
- `[FAIL]` — 必须修复（退出码 1）

每项失败都会给出对应修复命令。

## 卸载

```bash
node scripts/uninstall-hooks.mjs
node scripts/uninstall-slash-command.mjs
node scripts/uninstall-plugin.mjs
```

## How It Works

```text
Kimi Code CLI/VS Code
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
        ├──▶  desktop Electron window
        ├──▶  VS Code companion webview
        └──▶  web preview
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design.

## Project Structure

```text
kimi-pet/
├── apps/
│   ├── desktop/            # Electron transparent pet window
│   ├── vscode-companion/   # VS Code extension panel
│   └── web-preview/        # Browser demo
├── packages/
│   ├── pet-core/           # State machine + Kimi event mapping
│   ├── pet-daemon/         # HTTP/WebSocket daemon
│   ├── pet-assets/         # Spritesheet utilities
│   ├── kimi-hooks-adapter/ # Kimi config.toml hook bridge
│   ├── kimi-mcp-server/    # MCP server for pet tools
│   ├── kimi-wrapper/       # Shared Kimi integration helpers
│   └── shared-types/       # Shared TypeScript types
├── pets/
│   └── kimi-robot/         # Default petpack (spritesheet + pet.json)
├── scripts/
│   ├── install-all.mjs           # One-shot setup
│   ├── install-hooks.mjs         # Register Kimi hooks
│   ├── install-slash-command.mjs # Register /pet command
│   ├── install-plugin.mjs        # Register Kimi Code plugin
│   ├── start-pet.mjs             # Launch daemon + desktop
│   └── validate-petpack.mjs      # Validate a petpack
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

# Start the daemon in dev mode
pnpm dev:daemon

# Run tests
pnpm test

# Validate the default petpack
pnpm validate:petpack
```

## Customizing the Pet

The default petpack lives in `pets/kimi-robot/`:

- `spritesheet.webp` — 8×8 grid of 256×256 animation frames
- `pet.json` — animation metadata (row, frames, fps, loop, next)

Replace or extend these files and restart the daemon. Use `scripts/validate-petpack.mjs` to check your edits.

## Troubleshooting

See [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) for common issues (Electron download, `/pet` not appearing, daemon port conflicts).

## Roadmap

- [ ] Linux/macOS desktop polish
- [ ] More built-in pets
- [ ] Kimi Code extension-native `/pet` slash command (VS Code chat API)
- [ ] Packaged installer / GitHub Releases

## License

MIT — see [LICENSE](LICENSE).
