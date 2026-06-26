import type { BrowserWindow as BrowserWindowType, Rectangle } from "electron";
import { loadSettings, saveSettings, updateDesktopSettings } from "./settings";
import type { KimiPetSettings } from "./settings";

const { app, BrowserWindow, ipcMain, Menu, shell, screen } = require("electron");
const { exec, spawn } = require("node:child_process");
const path = require("node:path");

// Keep the transparent pet window alive when occluded by system overlays (e.g. Snipping Tool).
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows", "1");

const DAEMON_PORT = process.env.KIMI_PET_PORT ?? "17373";
const DAEMON_URL = `http://127.0.0.1:${DAEMON_PORT}`;

let mainWindow: BrowserWindowType | null = null;

function focusKimiCli() {
  if (process.platform !== "win32") {
    spawn("kimi", [], { detached: true, stdio: "ignore" });
    return;
  }
  const ps = `
    $kimi = Get-Process | Where-Object {
      ($_.MainWindowTitle -like '*Kimi*' -or $_.ProcessName -like '*kimi*') -and $_.MainWindowHandle -ne 0
    } | Select-Object -First 1
    if ($kimi) {
      $hwnd = $kimi.MainWindowHandle
      Add-Type @'
        using System;
        using System.Runtime.InteropServices;
        public class Win32 {
          [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
          [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
        }
'@
      if ([Win32]::IsIconic($hwnd)) {
        [Win32]::ShowWindowAsync($hwnd, 9) | Out-Null
      }
      [Win32]::SetForegroundWindow($hwnd) | Out-Null
    } else {
      Write-Error 'No Kimi Code CLI window found'
    }
  `;
  exec(ps, { shell: "powershell.exe" }, (err: any) => {
    if (err) {
      showBubble("未找到 Kimi Code CLI 窗口");
    }
  });
}

// ─── Window geometry helpers ─────────────────────────────────────

const BASE_SIZE = 256;
const MARGIN = 24;

/** Calculate window size from scale and state-text visibility. */
function getWindowSize(scale: number, _showStateText: boolean): { width: number; height: number } {
  // State text is overlay (absolute positioned) — no extra height needed.
  // _showStateText is reserved for future use if text becomes non-overlay.
  const size = Math.round(BASE_SIZE * scale);
  return { width: size, height: size };
}

/** Check if a rectangle intersects any display's work area. */
function isOnAnyScreen(x: number, y: number, width: number, height: number): boolean {
  const displays = screen.getAllDisplays();
  return displays.some((d: any) => {
    const wa = d.workArea;
    return x < wa.x + wa.width && x + width > wa.x && y < wa.y + wa.height && y + height > wa.y;
  });
}

/** Default position: primary display bottom-right corner. */
function getDefaultPosition(width: number, height: number): { x: number; y: number } {
  const primary = screen.getPrimaryDisplay();
  const wa = primary.workArea;
  return {
    x: wa.x + wa.width - width - MARGIN,
    y: wa.y + wa.height - height - MARGIN,
  };
}

async function postState(state: string, message?: string) {
  try {
    await fetch(`${DAEMON_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "desktop-menu",
        type: "ManualState",
        state,
        message,
        ts: new Date().toISOString(),
      }),
    });
  } catch {
    // ignore
  }
}

function showBubble(text: string, durationMs = 3000) {
  if (!mainWindow) return;
  mainWindow.webContents.send("show-bubble", text, durationMs);
}

function playTemporaryState(state: string, durationMs = 1500) {
  if (!mainWindow) return;
  mainWindow.webContents.send("play-state", state);
  setTimeout(() => {
    mainWindow?.webContents.send("restore-state");
  }, durationMs);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 256,
    height: 256,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    maximizable: false,
    minimizable: false,
    focusable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });
  mainWindow = win;

  // Keep the pet above system overlays (e.g. Snipping Tool) and prevent throttling.
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true);

  // Some system overlays can steal topmost status or hide the window. Re-assert periodically.
  const topmostInterval = setInterval(() => {
    if (win.isDestroyed()) {
      clearInterval(topmostInterval);
      return;
    }
    if (!win.isVisible()) {
      win.showInactive();
    }
    win.setAlwaysOnTop(true, "screen-saver");
  }, 2000);

  win.on("minimize", (_event: any) => {
    _event.preventDefault();
    win.restore();
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  :root { --scale: 1; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    width: calc(256px * var(--scale)); height: calc(256px * var(--scale));
    background: transparent !important;
    color: #fff;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow: hidden;
    user-select: none;
  }
  #pet-wrap {
    width: calc(256px * var(--scale)); height: calc(256px * var(--scale));
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  #pet {
    width: calc(256px * var(--scale)); height: calc(256px * var(--scale));
    background-repeat: no-repeat;
    background-size: calc(2048px * var(--scale)) calc(2048px * var(--scale));
    cursor: pointer;
  }
  #state {
    position: absolute; bottom: calc(6px * var(--scale)); left: 50%;
    transform: translateX(-50%);
    font-size: calc(12px * var(--scale)); text-transform: capitalize;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    pointer-events: none;
  }
  #status { display: none; }
  #bubble {
    position: absolute;
    top: calc(-10px * var(--scale)); left: 50%;
    transform: translateX(-50%) scale(0);
    background: rgba(30,30,30,0.92);
    color: #fff;
    padding: calc(8px * var(--scale)) calc(12px * var(--scale));
    border-radius: calc(12px * var(--scale));
    font-size: calc(13px * var(--scale));
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
    z-index: 10;
  }
  #bubble::after {
    content: "";
    position: absolute;
    bottom: calc(-6px * var(--scale)); left: 50%;
    transform: translateX(-50%);
    border-width: calc(6px * var(--scale)) calc(6px * var(--scale)) 0;
    border-style: solid;
    border-color: rgba(30,30,30,0.92) transparent transparent transparent;
  }
  #bubble.visible {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
  #resize-handle {
    position: absolute;
    bottom: calc(6px * var(--scale)); right: calc(6px * var(--scale));
    width: calc(32px * var(--scale)); height: calc(32px * var(--scale));
    border-radius: 50%;
    background: rgba(0,0,0,0.25);
    border: 1px solid rgba(255,255,255,0.3);
    cursor: nwse-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 1;
    pointer-events: auto;
    transition: background 0.15s ease, transform 0.1s ease;
    z-index: 20;
  }
  #resize-handle::before, #resize-handle::after {
    content: "";
    position: absolute;
    width: 0; height: 0;
    border-style: solid;
  }
  /* 左上箭头 */
  #resize-handle::before {
    top: calc(7px * var(--scale)); left: calc(7px * var(--scale));
    border-width: 0 calc(4px * var(--scale)) calc(7px * var(--scale)) calc(4px * var(--scale));
    border-color: transparent transparent #fff transparent;
    transform: rotate(45deg);
  }
  /* 右下箭头 */
  #resize-handle::after {
    bottom: calc(7px * var(--scale)); right: calc(7px * var(--scale));
    border-width: calc(7px * var(--scale)) calc(4px * var(--scale)) 0 calc(4px * var(--scale));
    border-color: #fff transparent transparent transparent;
    transform: rotate(45deg);
  }
  #resize-handle:hover { background: rgba(0,0,0,0.5); transform: scale(1.08); }
  #resize-handle:active { transform: scale(0.95); }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    40% { transform: translateY(calc(-18px * var(--scale))); }
    60% { transform: translateY(calc(-8px * var(--scale))); }
  }
  .bounce #pet {
    animation: bounce 0.5s ease;
  }
</style>
</head>
<body>
<div id="pet-wrap">
  <div id="resize-handle" title="拖动调整大小"></div>
  <div id="bubble"></div>
  <div id="pet"></div>
  <div id="state">idle</div>
  <div id="status">connecting...</div>
</div>
<script>
const { ipcRenderer } = require('electron');
const DAEMON_URL = 'http://127.0.0.1:${DAEMON_PORT}';
const WS_URL = 'ws://127.0.0.1:${DAEMON_PORT}/ws';
const stateEl = document.getElementById('state');
const statusEl = document.getElementById('status');
const petEl = document.getElementById('pet');
const wrapEl = document.getElementById('pet-wrap');
const bubbleEl = document.getElementById('bubble');
const resizeHandle = document.getElementById('resize-handle');
let manifest = null, currentState = 'idle', previousState = 'idle', frame = 0, startTime = 0;
let bubbleTimer = null;
let currentScale = 1;

async function init() {
  try {
    const res = await fetch(DAEMON_URL + '/petpack');
    manifest = await res.json();
    petEl.style.backgroundImage = 'url(' + DAEMON_URL + '/spritesheet.webp)';
    startTime = performance.now();
    tick();
    connectWs();
    const stateRes = await fetch(DAEMON_URL + '/state');
    const snapshot = await stateRes.json();
    setState(snapshot.state);
  } catch (e) {
    statusEl.textContent = 'error: ' + e.message;
  }
}

function setState(state, fromDaemon = true) {
  if (!manifest || !manifest.animations[state]) return;
  if (fromDaemon && state !== currentState) {
    previousState = currentState;
  }
  currentState = state; frame = 0; startTime = performance.now();
  stateEl.textContent = state;
}

function tick() {
  const anim = manifest.animations[currentState];
  if (!anim) return;
  const elapsed = performance.now() - startTime;
  const f = Math.floor((elapsed / 1000) * anim.fps);
  frame = anim.loop ? (f % anim.frames) : Math.min(f, anim.frames - 1);
  if (!anim.loop && f >= anim.frames && anim.next) { setState(anim.next, false); }
  const cellW = manifest.asset.cellWidth * currentScale;
  const cellH = manifest.asset.cellHeight * currentScale;
  const x = -frame * cellW;
  const y = -anim.row * cellH;
  petEl.style.backgroundPosition = x + 'px ' + y + 'px';
  requestAnimationFrame(tick);
}

function connectWs() {
  const ws = new WebSocket(WS_URL);
  ws.onopen = () => { statusEl.textContent = 'connected'; };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'state') {
      const oldState = currentState;
      setState(msg.data.state);
      if ((currentState === 'success' || currentState === 'error') && currentState !== oldState) {
        const text = currentState === 'success' ? '完成啦！' : '出错了…';
        showBubble(text, 3000);
      }
    }
  };
  ws.onclose = () => { statusEl.textContent = 'disconnected'; };
  ws.onerror = () => { statusEl.textContent = 'connection error'; };
}

function showBubble(text, durationMs = 3000) {
  bubbleEl.textContent = text;
  bubbleEl.classList.add('visible');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => {
    bubbleEl.classList.remove('visible');
  }, durationMs);
}

let resizing = false, resizeStartX = 0, resizeStartY = 0;
resizeHandle.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.stopPropagation();
  resizing = true;
  resizeStartX = e.screenX;
  resizeStartY = e.screenY;
  ipcRenderer.send('window-resize-start');
});

let dragging = false, dragStartX = 0, dragStartY = 0;
petEl.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  dragging = true;
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  ipcRenderer.send('window-drag-start');
});

window.addEventListener('mousemove', (e) => {
  if (resizing) {
    ipcRenderer.send('window-resize-move', e.screenX - resizeStartX, e.screenY - resizeStartY);
  } else if (dragging) {
    ipcRenderer.send('window-drag-move', e.screenX - dragStartX, e.screenY - dragStartY);
  }
});
window.addEventListener('mouseup', () => { resizing = false; dragging = false; });

petEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  ipcRenderer.send('show-context-menu');
});

petEl.addEventListener('dblclick', (e) => {
  e.preventDefault();
  wrapEl.classList.remove('bounce');
  void wrapEl.offsetWidth;
  wrapEl.classList.add('bounce');
  ipcRenderer.send('pet-double-click');
});

ipcRenderer.on('show-bubble', (_ev, text, durationMs) => showBubble(text, durationMs));
ipcRenderer.on('play-state', (_ev, state) => {
  if (manifest && manifest.animations[state]) {
    previousState = currentState;
    setState(state, false);
  }
});
ipcRenderer.on('restore-state', () => {
  if (manifest && manifest.animations[previousState]) {
    setState(previousState, false);
  }
});
ipcRenderer.on('set-scale', (_ev, scale) => {
  currentScale = scale;
  document.documentElement.style.setProperty('--scale', scale);
});

init();
</script>
</body>
</html>`;

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  win.setPosition(1200, 600);
  win.setIgnoreMouseEvents(false);

  let dragBaseX = 1200, dragBaseY = 600;
  ipcMain.on("window-drag-start", () => {
    const pos = win.getPosition();
    dragBaseX = pos[0];
    dragBaseY = pos[1];
  });
  ipcMain.on("window-drag-move", (_ev: any, dx: number, dy: number) => {
    win.setPosition(dragBaseX + dx, dragBaseY + dy);
  });

  let resizeBaseScale = 1.0;
  const MIN_SCALE = 0.5, MAX_SCALE = 2.0;
  ipcMain.on("window-resize-start", () => {
    resizeBaseScale = currentScale;
  });
  ipcMain.on("window-resize-move", (_ev: any, dx: number, dy: number) => {
    const delta = (dx + dy) / 2;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, resizeBaseScale + delta / 400));
    currentScale = Number(newScale.toFixed(2));
    const size = Math.round(256 * currentScale);
    win.setSize(size, size);
    win.webContents.send("set-scale", currentScale);
  });

  ipcMain.on("show-context-menu", () => {
    const stateItem = (state: string) => ({
      label: state,
      click: () => { postState(state); showBubble(`状态: ${state}`); },
    });
    const menu = Menu.buildFromTemplate([
      {
        label: "聚焦 Kimi Code CLI",
        click: () => focusKimiCli(),
      },
      { type: "separator" },
      {
        label: "状态",
        submenu: [
          stateItem("idle"),
          stateItem("thinking"),
          stateItem("tool_use"),
          stateItem("editing"),
          stateItem("waiting_approval"),
          stateItem("success"),
          stateItem("error"),
        ],
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => app.quit(),
      },
    ]);
    menu.popup();
  });

  ipcMain.on("pet-double-click", () => {
    const reactions = ["你好呀~", "我在呢", "双击互动！", "嘻嘻~", "收到！"];
    const text = reactions[Math.floor(Math.random() * reactions.length)];
    showBubble(text, 2000);
    playTemporaryState("success", 1200);
  });

  let currentScale = 1.0;
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
