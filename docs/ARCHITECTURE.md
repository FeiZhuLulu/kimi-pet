# Kimi Pet 架构文档

## 1. 总体架构

```text
Kimi Code CLI / VS Code / Wrapper / MCP
        ↓
kimi-pet-hook (kimi-hooks-adapter)
        ↓
kimi-pet-daemon (HTTP + WebSocket on 127.0.0.1:17373)
        ↓
pet-core (PetStateMachine)
        ↓
Web Preview / VS Code Companion Renderer
        ↓
spritesheet.webp 动画
```

## 2. 模块职责

### packages/shared-types
跨模块共享的 TypeScript 类型：PetState、PetEvent、PetStateSnapshot、PetPackManifest。

### packages/pet-assets
- petpack schema 定义
- loadPetPack：加载 pet.json + spritesheet
- validatePetPack：校验尺寸、row、frames、next
- composeRows：用 sharp 合成 spritesheet.webp
- frameMath：计算 CSS background-position

### packages/pet-core
- PetStateMachine：接收 PetEvent，输出 PetStateSnapshot
- Kimi 事件到 8 状态的映射
- success/error 自动回落

### packages/pet-daemon
- 本地 HTTP/WebSocket 服务
- 接收 hooks/MCP/wrapper/手动事件
- 维护状态机并广播状态
- 提供 /petpack 和 /spritesheet.webp 静态资源

### packages/kimi-hooks-adapter
- kimi-pet-hook CLI
- 从 stdin 读取 Kimi Hook JSON
- 归一化为 PetEvent 并 POST 到 daemon
- fail-open，exit 0，不阻塞 Kimi

### packages/kimi-wrapper
- fake kimi executable
- 透传给真实 kimi
- 发送 wrapper.start / wrapper.exit 事件

### apps/web-preview
- Vite + TS 浏览器预览
- CSS spritesheet 动画播放
- WebSocket 实时状态同步

### apps/vscode-companion
- VS Code extension
- Activity Bar webview 面板
- 复用 renderer 逻辑
- Commands：Show/Hide/Start Daemon/Install Hooks

## 3. 数据流

1. Kimi Code CLI 触发 hook
2. `kimi-pet-hook` 读取 stdin，转换为 PetEvent
3. POST 到 `http://127.0.0.1:17373/events`
4. pet-daemon 调用 PetStateMachine.transition(event)
5. 状态变更通过 WebSocket `/ws` 广播
6. Renderer 收到 state 后播放对应动画

## 4. 安全约束

- 监听 127.0.0.1，不上传数据
- hook adapter 永远 exit 0
- 不修改 Kimi Code 源码
- wrapper 通过 VS Code setting 指向，不替换系统命令
