[English](./README.en.md) | **简体中文**

# Kimi Pet 🐾

一个常驻桌面顶层的透明桌宠，监听 [Kimi Code](https://kimi.moonshot.cn/) 编程会话并实时反应。

![kimi-block-preview](docs/assets/kimi-block-preview.png)

## 功能

- 实时状态动画（idle / thinking / tool_use / editing / waiting_approval / success / error）
- 通过 Kimi Code CLI hooks 自动同步会话状态
- 透明可拖动的 Electron 桌面窗口，设置保存在 `~/.kimi-pet/settings.json`
- 在 Kimi Code CLI 输入 `/start pet` 即可启动

## 安装

需要 Node.js 20+、pnpm 8+、Kimi Code CLI。

```bash
git clone https://github.com/FeiZhuLulu/kimi-pet.git
cd kimi-pet
corepack enable
node scripts/install-all.mjs
```

CI 或非交互安装：`node scripts/install-all.mjs --yes`

## 启动

**推荐** — 在 Kimi Code CLI 聊天输入：

```text
/start pet
```

若未触发，先运行 `node scripts/install-plugin.mjs`。

**或直接运行：**

```bash
node scripts/start-pet.mjs
```

Windows 也可双击 `start-pet.bat`。

## 验证与卸载

```bash
node scripts/doctor.mjs          # 检查安装
node scripts/uninstall-hooks.mjs
node scripts/uninstall-slash-command.mjs
node scripts/uninstall-plugin.mjs
```

## 工作原理

```text
Kimi Code CLI → hooks → kimi-pet-hook → pet-daemon → 桌面窗口 / Web 预览
```

## 更多文档

- [架构设计](docs/ARCHITECTURE.md)
- [故障排查](docs/TROUBLESHOOTING.md)（含国内镜像、常见错误）
- [版本历史](CHANGELOG.md)

## 许可证

MIT — 见 [LICENSE](LICENSE)。