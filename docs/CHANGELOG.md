# Changelog

## v0.4.0 — 桌面体验优化

### Added

- **桌面设置持久化**：窗口位置、缩放比例、是否显示状态文字、是否置顶均保存到 `~/.kimi-pet/settings.json`，重启后自动恢复。
- **窗口位置保护**：启动时检测窗口是否落在当前屏幕工作区内；若显示器变化导致窗口飞出屏幕，自动回到主显示器右下角。
- **右键 Scale 预设**：75%、100%、125%、150%、200% 五档快速缩放。
- **右键状态开关**：
  - Show State Text — 显示/隐藏当前状态文字。
  - Always on Top — 切换置顶（保存）。
  - Reset Position — 一键回到默认位置。
- **缩放拖动手柄**：右下角圆形手柄可拖拽实时调整大小，停止后自动保存。
- **设置文件损坏兜底**：`settings.json` 解析失败时自动备份并回退到默认配置。

### Changed

- 右键菜单状态项精简为：`idle`、`thinking`、`tool_use`、`editing`、`waiting_approval`、`success`、`error`（移除 `terminal` 手动项）。
- 桌面端顶层防御增强：禁用 native occlusion、backgrounding 和 timer throttling；每 2 秒重新断言置顶，降低截图工具等系统 overlay 导致窗口消失的概率。
- `terminal` 动画帧率从 10 fps 下调到 6 fps，降低抖动。

### Fixed

- 截图后 Electron 透明窗口可能被系统 overlay 覆盖而不可见。
- 窗口拖出屏幕或关闭后再启动时位置丢失。
- 缩放调整不持久化。

---

早期版本历史见 Git 提交记录。
