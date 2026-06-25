# Kimi Pet 🐾

一个常驻桌面顶层的透明桌宠，监听你的 [Kimi Code](https://kimi.moonshot.cn/) 编程会话并实时反应。

![success](docs/assets/success.png)

## 功能特性

- **实时状态动画** — idle、thinking、tool_use、editing、terminal、waiting_approval、success、error
- **生命周期 hook 集成** — 通过 `~/.kimi-code/config.toml` 监听 Kimi Code CLI 事件
- **桌面伴侣** — 无边框、透明、可拖动、可缩放的 Electron 窗口
- **Web 预览** — 浏览器打开 `apps/web-preview` 即可快速演示
- **VS Code 侧边面板** — 🧪 experimental，当前不作为主接入目标（见下方说明）
- **MCP 服务器** — 暴露 `pet_set_state`、`pet_say`、`pet_notify` 工具
- **`/pet` slash 命令** — 在 Kimi Code 聊天里一键启动 daemon + 桌宠

> **支持路径说明：** 当前主支持路径是 Kimi Code CLI。VS Code companion 暂为实验功能，不作为主接入目标；由于官方 Kimi Code for VS Code 插件版本较旧，相关适配等官方更新后再继续。

## 安装

要求：Node.js 20+、pnpm 8+（或用 `corepack pnpm`）、Kimi Code CLI。Windows / macOS / Linux 均可。

### 快速安装（推荐）

```bash
git clone https://github.com/FeiZhuLulu/kimi-pet.git
cd kimi-pet
corepack enable
node scripts/install-all.mjs
```

`install-all` 会：装依赖 → build → 注册 Kimi hooks → 注册 `/pet` slash command → 注册 Kimi Code plugin。执行前会打印计划并要求 y/N 确认。

非交互场景（CI / 自动化）跳过确认：

```bash
node scripts/install-all.mjs --yes
```

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

在 Kimi Code CLI 聊天输入：

```text
/pet
```

或在终端运行：

```bash
node scripts/start-pet.mjs
```

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

## 工作原理

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
    pet-daemon  ◀───────  MCP 工具 / 手动事件
        │
        ├──▶  桌面 Electron 窗口
        └──▶  Web 预览
```

完整设计见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 项目结构

```text
kimi-pet/
├── apps/
│   ├── desktop/            # Electron 透明桌宠窗口
│   ├── vscode-companion/   # VS Code 扩展面板（⏸️ 搁置）
│   └── web-preview/        # 浏览器演示
├── packages/
│   ├── pet-core/           # 状态机 + Kimi 事件映射
│   ├── pet-daemon/         # HTTP / WebSocket daemon
│   ├── pet-assets/         # 精灵图工具
│   ├── kimi-hooks-adapter/ # Kimi config.toml hook 桥接
│   ├── kimi-mcp-server/    # 桌宠 MCP 服务器
│   ├── kimi-wrapper/       # 共享 Kimi 集成辅助
│   └── shared-types/       # 共享 TypeScript 类型
├── pets/
│   └── kimi-robot/         # 默认 petpack（精灵图 + pet.json）
├── scripts/
│   ├── install-all.mjs           # 一键安装
│   ├── install-hooks.mjs         # 注册 Kimi hooks
│   ├── install-slash-command.mjs # 注册 /pet 命令
│   ├── install-plugin.mjs        # 注册 Kimi Code 插件
│   ├── start-pet.mjs             # 启动 daemon + 桌宠
│   └── validate-petpack.mjs      # 校验 petpack
├── docs/
│   ├── ARCHITECTURE.md
│   └── assets/               # 截图
└── .kimi/commands/pet.md   # 项目级 /pet slash 命令
```

## 开发

```bash
# 安装依赖
pnpm install

# 构建所有 packages 和 apps
pnpm build

# 启动 daemon（开发模式）
pnpm dev:daemon

# 运行测试
pnpm test

# 校验默认 petpack
pnpm validate:petpack
```

## 自定义桌宠

默认 petpack 在 `pets/kimi-robot/`：

- `spritesheet.webp` — 8×8 网格，每格 256×256 动画帧
- `pet.json` — 动画元数据（row、frames、fps、loop、next）

替换或扩展这些文件后重启 daemon。用 `scripts/validate-petpack.mjs` 校验你的修改。

## 故障排查

完整内容见 [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)，涵盖 Electron 下载失败、`/pet` 不出现、daemon 端口冲突等。

### 国内镜像

在国内网络下，Electron 二进制与 pnpm 注册表可能很慢或失败。先设置镜像再安装。

PowerShell：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:npm_config_electron_mirror="https://npmmirror.com/mirrors/electron/"
pnpm config set registry https://registry.npmmirror.com
pnpm install
```

CMD：

```bat
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set npm_config_electron_mirror=https://npmmirror.com/mirrors/electron/
pnpm config set registry https://registry.npmmirror.com
pnpm install
```

macOS / Linux：

```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export npm_config_electron_mirror=https://npmmirror.com/mirrors/electron/
pnpm config set registry https://registry.npmmirror.com
pnpm install
```

恢复官方源：

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

### 常见错误

- `doctor` 报 `dist/*.js` 缺失 → 跑 `pnpm build`
- `pnpm install` 阶段卡住或 Electron 404 → 见上"国内镜像"
- `doctor` 报端口 17373 被占 → Windows: `netstat -ano | findstr 17373`；macOS / Linux: `lsof -iTCP:17373 -sTCP:LISTEN`，找到 PID 后结束进程
- `/pet` 在 Kimi 聊天里不出现 → 跑 `install-slash-command.mjs` 后重启 Kimi Code 客户端
- Kimi config 路径 `~/.kimi-code/config.toml`（或 `$KIMI_CODE_HOME/config.toml`）不存在 → 先启动一次 Kimi Code CLI 让它生成配置目录

## 路线图

- [ ] Linux / macOS 桌面体验打磨
- [ ] 更多内置桌宠
- [ ] 打包安装器 / GitHub Releases

### Experimental — 等待 Kimi 更新 VS Code 插件后恢复

- [ ] Kimi Code 扩展原生 `/pet` slash 命令（VS Code chat API）
- [ ] VS Code 伴侣扩展（vscode-companion）恢复开发
- [ ] kimi-wrapper 恢复开发

## 许可证

MIT — 见 [LICENSE](LICENSE)。
