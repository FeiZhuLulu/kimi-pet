# 故障排查

桌面端配置保存在 `~/.kimi-pet/settings.json`。如果设置异常，直接删除该文件即可恢复默认。桌宠会保留在显示器右下角、100% 缩放、显示状态文字、置顶开启。

---

## `kimi doctor` 报 `config.toml` 无效 / `hooks[N]: Invalid input`

这是旧版 `kimi-pet` 的 hooks 安装脚本写入了 Kimi Code 不支持的 hook 事件（`PermissionRequest`、`PermissionResult`、`Interrupt`）和 `timeout` 字段导致的。

**修复步骤：**

1. 先按你之前的方式，用备份恢复 `~/.kimi-code/config.toml`，让 Kimi Code 能正常启动。
2. 拉取最新代码后重新安装 hooks：

   ```bash
   node scripts/install-hooks.mjs
   ```

3. 再次运行 `kimi doctor`，确认配置验证通过。

如果你不想覆盖自己的 config 备份，也可以手动删除 config.toml 里所有 `event = "PermissionRequest"`、`PermissionResult`、`Interrupt` 的 hook 块，以及每个 hook 里的 `timeout = 1` 行。

---

## `/start pet` 没反应，或启动后没有任何窗口

最常见原因是上次启动的 Electron / pet-daemon 进程还在后台，新实例无法创建窗口。

**修复步骤：**

1. 结束所有相关进程：

   ```powershell
   Get-Process | Where-Object { $_.ProcessName -match 'electron|pet-daemon' } | Stop-Process -Force
   ```

   ```bash
   # macOS / Linux
   pkill -f electron
   pkill -f pet-daemon
   ```

2. 重新启动：

   ```bash
   node scripts/start-pet.mjs
   ```

3. 如果仍无窗口，手动运行桌面端查看报错：

   ```bash
   node apps/desktop/dist/main.js
   ```

   或从源码构建后运行：

   ```bash
   corepack pnpm --filter @kimi-pet/desktop build
   node apps/desktop/dist/main.js
   ```

---

## 截图（Snipping Tool / 微信截图等）后桌宠消失

这是 Windows 透明置顶窗口常见的系统 overlay 抢占问题。v0.4 已做以下缓解：

- 启动参数禁用 `CalculateNativeWinOcclusion`、renderer backgrounding 和 timer throttling。
- 窗口被最小化时会自动 restore。
- 每 2 秒重新断言一次置顶状态。

**临时恢复：** 在桌宠上右键 → **Reset Position**，或重启 `start-pet.mjs`。

**彻底规避：** 截图前可临时关闭 **Always on Top**，截图完再打开。

---

## 窗口拖到了屏幕外，或换显示器后找不到

右键菜单选择 **Reset Position**，窗口会回到主显示器右下角。

如果右键菜单无法呼出，删除配置文件恢复默认：

```bash
rm ~/.kimi-pet/settings.json
```

Windows PowerShell：

```powershell
Remove-Item "$env:USERPROFILE\.kimi-pet\settings.json" -ErrorAction SilentlyContinue
```

---

## 缩放调到太小/太大，无法操作

右键菜单 **Scale** 提供了 75%、100%、125%、150%、200% 几个固定档位。选中后会立即生效并保存。

如果窗口已经小到拖不动，删除 `~/.kimi-pet/settings.json` 恢复 100%。

---

## `/pet` 在 Kimi Code 聊天里不出现

当前公开版 Kimi Code CLI 还不支持自定义 slash command。`/pet` 文件已安装在：

- `~/.kimi-code/commands/pet.md`
- `~/.kimi/commands/pet.md`

等官方支持自定义 slash command 后会自动生效。

**现在请用 `/start pet` skill 启动：** 在 Kimi Code CLI 聊天输入 `/start pet`，agent 会调用启动脚本。

---

## 桌面窗口不显示但进程存在

1. 确认已构建：

   ```bash
   corepack pnpm --filter @kimi-pet/desktop build
   ```

2. 检查 `~/.kimi-pet/settings.json` 里的 `x` / `y` 是否落在当前显示器之外：

   ```bash
   cat ~/.kimi-pet/settings.json
   ```

3. 如果坐标异常，删除该文件。

---

## daemon 端口 17373 被占用

换一个端口启动：

```powershell
$env:KIMI_PET_PORT="17374"
node scripts/start-pet.mjs
```

```bash
# macOS / Linux
KIMI_PET_PORT=17374 node scripts/start-pet.mjs
```

同时需要修改 `~/.kimi-code/config.toml` 里 hook 命令中的端口。

---

## Electron 下载失败或安装卡住

在国内网络下，先设置镜像再安装：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:npm_config_electron_mirror="https://npmmirror.com/mirrors/electron/"
pnpm config set registry https://registry.npmmirror.com
pnpm install
```

恢复官方源：

```powershell
Remove-Item Env:ELECTRON_MIRROR -ErrorAction SilentlyContinue
Remove-Item Env:npm_config_electron_mirror -ErrorAction SilentlyContinue
pnpm config set registry https://registry.npmjs.org
```

---

## Electron 二进制是手动解压的

如果你手动放置了 Electron `dist` 目录，确保它在以下路径之一：

- `node_modules/.pnpm/electron@30.5.1/node_modules/electron/dist/`
- `node_modules/electron/dist/`

然后运行：

```bash
node scripts/start-pet.mjs --dry-run
```

验证路径被正确识别。

---

## 设置文件损坏

如果 `~/.kimi-pet/settings.json` 损坏，桌宠会自动把它备份为 `settings.json.bak.<时间戳>`，然后生成默认配置。查看备份：

```bash
ls ~/.kimi-pet/
```
