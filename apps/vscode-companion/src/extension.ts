import * as vscode from "vscode";
import { spawn } from "node:child_process";
import path from "node:path";

let currentPanel: vscode.WebviewPanel | undefined;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Kimi Pet");
  outputChannel.appendLine("Kimi Pet companion activated");

  const config = vscode.workspace.getConfiguration("kimiPet");
  const port = config.get<number>("daemonPort") ?? 17373;

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = "$(server) Kimi Pet";
  statusBarItem.command = "kimiPet.show";
  statusBarItem.show();

  const kimiExt = vscode.extensions.getExtension("moonshot-ai.kimi-code");
  outputChannel.appendLine(`Kimi extension: ${kimiExt ? "installed" : "not found"}`);

  if (kimiExt) {
    Promise.resolve(kimiExt.activate()).then(() => {
      outputChannel.appendLine(`Kimi extension exports: ${JSON.stringify(Object.keys(kimiExt.exports ?? {}))}`);
    }).catch((e: Error) => {
      outputChannel.appendLine(`Kimi extension activation failed: ${e.message}`);
    });
  }

  vscode.commands.getCommands(true).then((commands) => {
    const kimiCommands = commands.filter((c) => c.toLowerCase().includes("kimi"));
    outputChannel.appendLine(`Kimi commands: ${kimiCommands.join(", ")}`);
  });

  const showCommand = vscode.commands.registerCommand("kimiPet.show", () => {
    if (currentPanel) {
      currentPanel.reveal(vscode.ViewColumn.One);
      return;
    }

    currentPanel = vscode.window.createWebviewPanel(
      "kimiPet",
      "Kimi Pet",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, "media"))],
      }
    );

    const daemonUrl = `http://127.0.0.1:${port}`;
    const wsUrl = `ws://127.0.0.1:${port}/ws`;
    currentPanel.webview.html = getWebviewHtml(daemonUrl, wsUrl);

    currentPanel.onDidDispose(() => {
      currentPanel = undefined;
    });
  });

  const hideCommand = vscode.commands.registerCommand("kimiPet.hide", () => {
    currentPanel?.dispose();
  });

  const startDaemonCommand = vscode.commands.registerCommand("kimiPet.startDaemon", () => {
    const projectRoot = getProjectRoot(config, context);
    const daemonScript = path.join(projectRoot, "packages", "pet-daemon", "dist", "cli.js");
    const env = { ...process.env, KIMI_PET_PETPACK: getPetPackPath(config, context) };
    const child = spawn("node", [daemonScript], { env, detached: true, stdio: "ignore" });
    child.unref();
    vscode.window.showInformationMessage("Kimi Pet daemon started");
  });

  const installHooksCommand = vscode.commands.registerCommand("kimiPet.installHooks", () => {
    const projectRoot = getProjectRoot(config, context);
    const script = path.join(projectRoot, "scripts", "install-hooks.mjs");
    const child = spawn("node", [script], { stdio: "inherit" });
    child.on("exit", (code) => {
      if (code === 0) {
        vscode.window.showInformationMessage("Kimi Pet hooks installed");
      } else {
        vscode.window.showErrorMessage("Failed to install Kimi Pet hooks");
      }
    });
  });

  const launchDesktopCommand = vscode.commands.registerCommand("kimiPet.launchDesktop", () => {
    const projectRoot = getProjectRoot(config, context);
    const script = path.join(projectRoot, "scripts", "start-pet.mjs");
    const env = { ...process.env, KIMI_PET_PETPACK: getPetPackPath(config, context) };
    const child = spawn("node", [script], { env, detached: true, stdio: "ignore" });
    child.unref();
    vscode.window.showInformationMessage("Kimi Pet desktop companion launching");
  });

  context.subscriptions.push(showCommand, hideCommand, startDaemonCommand, installHooksCommand, launchDesktopCommand, statusBarItem);
}

export function deactivate() {
  statusBarItem?.dispose();
  currentPanel?.dispose();
}

function getProjectRoot(config: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext): string {
  const configured = config.get<string>("projectRoot");
  if (configured) return configured;
  return path.resolve(context.extensionPath, "..", "..");
}

function getPetPackPath(config: vscode.WorkspaceConfiguration, context: vscode.ExtensionContext): string {
  const configured = config.get<string>("petPackPath");
  if (configured) return configured;
  return path.join(getProjectRoot(config, context), "pets", "kimi-robot");
}

function getWebviewHtml(daemonUrl: string, wsUrl: string): string {
  const htmlParts = [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<meta charset="UTF-8">',
    '<style>',
    'body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #1e1e1e; color: #fff; font-family: system-ui; }',
    '#pet { width: 256px; height: 256px; background-repeat: no-repeat; }',
    '#state { margin-top: 16px; font-size: 18px; text-transform: capitalize; }',
    '#status { margin-top: 8px; font-size: 12px; color: #888; }',
    '#controls { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }',
    'button { padding: 6px 12px; background: #2d2d2d; border: 1px solid #555; color: #fff; border-radius: 4px; cursor: pointer; }',
    '</style>',
    '</head>',
    '<body>',
    '<div id="pet"></div>',
    '<div id="state">idle</div>',
    '<div id="status">connecting...</div>',
    '<div id="controls">',
    '<button data-state="idle">idle</button>',
    '<button data-state="thinking">thinking</button>',
    '<button data-state="tool_use">tool_use</button>',
    '<button data-state="editing">editing</button>',
    '<button data-state="terminal">terminal</button>',
    '<button data-state="waiting_approval">waiting</button>',
    '<button data-state="success">success</button>',
    '<button data-state="error">error</button>',
    '</div>',
    '<script>',
    `const DAEMON_URL = "${daemonUrl}";`,
    `const WS_URL = "${wsUrl}";`,
    'const stateEl = document.getElementById("state");',
    'const statusEl = document.getElementById("status");',
    'const petEl = document.getElementById("pet");',
    'let manifest = null;',
    'let currentState = "idle";',
    'let frame = 0;',
    'let startTime = 0;',
    'async function init() {',
    '  try {',
    '    const res = await fetch(DAEMON_URL + "/petpack");',
    '    manifest = await res.json();',
    '    petEl.style.backgroundImage = "url(" + DAEMON_URL + "/spritesheet.webp)";',
    '    startTime = performance.now();',
    '    tick();',
    '    connectWs();',
    '    const stateRes = await fetch(DAEMON_URL + "/state");',
    '    const snapshot = await stateRes.json();',
    '    setState(snapshot.state);',
    '  } catch (e) {',
    '    statusEl.textContent = "error: " + e.message;',
    '  }',
    '}',
    'function setState(state) {',
    '  if (manifest && manifest.animations[state]) {',
    '    currentState = state;',
    '    frame = 0;',
    '    startTime = performance.now();',
    '    stateEl.textContent = state;',
    '  }',
    '}',
    'function tick() {',
    '  const anim = manifest.animations[currentState];',
    '  if (!anim) return;',
    '  const elapsed = performance.now() - startTime;',
    '  const f = Math.floor((elapsed / 1000) * anim.fps);',
    '  if (anim.loop) {',
    '    frame = f % anim.frames;',
    '  } else {',
    '    frame = Math.min(f, anim.frames - 1);',
    '    if (f >= anim.frames && anim.next) {',
    '      setState(anim.next);',
    '    }',
    '  }',
    '  const x = -frame * manifest.asset.cellWidth;',
    '  const y = -anim.row * manifest.asset.cellHeight;',
    '  petEl.style.backgroundPosition = x + "px " + y + "px";',
    '  requestAnimationFrame(tick);',
    '}',
    'function connectWs() {',
    '  const ws = new WebSocket(WS_URL);',
    '  ws.onopen = function() { statusEl.textContent = "connected"; };',
    '  ws.onmessage = function(ev) {',
    '    const msg = JSON.parse(ev.data);',
    '    if (msg.type === "state") setState(msg.data.state);',
    '  };',
    '  ws.onclose = function() { statusEl.textContent = "disconnected"; };',
    '  ws.onerror = function() { statusEl.textContent = "connection error"; };',
    '}',
    'document.querySelectorAll("button").forEach(function(btn) {',
    '  btn.addEventListener("click", function() {',
    '    fetch(DAEMON_URL + "/state", {',
    '      method: "POST",',
    '      headers: { "Content-Type": "application/json" },',
    '      body: JSON.stringify({ state: btn.dataset.state })',
    '    });',
    '  });',
    '});',
    'init();',
    '</script>',
    '</body>',
    '</html>'
  ];
  return htmlParts.join('\n');
}
