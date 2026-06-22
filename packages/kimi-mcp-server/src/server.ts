import type { PetState } from "@kimi-pet/shared-types";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DAEMON_URL = process.env.KIMI_PET_DAEMON_URL ?? "http://127.0.0.1:17373/events";
const MCP_LOG_FILE = path.join(os.homedir(), ".kimi-pet", "logs", "mcp-server.log");

function log(msg: string): void {
  fs.mkdirSync(path.dirname(MCP_LOG_FILE), { recursive: true });
  fs.appendFileSync(MCP_LOG_FILE, JSON.stringify({ time: new Date().toISOString(), msg }) + "\n");
}

interface MCPRequest {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
  };
}

interface MCPResponse {
  jsonrpc: "2.0";
  id?: number | string;
  result?: unknown;
  error?: { code: number; message: string };
}

async function postEvent(type: string, extras: Record<string, unknown> = {}): Promise<void> {
  await fetch(DAEMON_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      source: "kimi-mcp",
      type,
      ...extras,
    }),
  });
}

function createToolResult(text: string): unknown {
  return {
    content: [{ type: "text", text }],
    isError: false,
  };
}

function createErrorResult(message: string): unknown {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

const tools = {
  pet_set_state: {
    description: "Set the Kimi Pet animation state manually.",
    inputSchema: {
      type: "object",
      properties: {
        state: {
          type: "string",
          enum: ["idle", "thinking", "tool_use", "editing", "terminal", "waiting_approval", "success", "error"],
          description: "The pet state to display",
        },
        message: { type: "string", description: "Optional status message" },
      },
      required: ["state"],
    },
  },
  pet_say: {
    description: "Show a short companion message in the Kimi Pet panel.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Short message to display" },
      },
      required: ["text"],
    },
  },
  pet_notify: {
    description: "Show a notification-style status in Kimi Pet.",
    inputSchema: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["info", "success", "warning", "error"], default: "info" },
        message: { type: "string", description: "Notification message" },
      },
      required: ["message"],
    },
  },
};

async function handleRequest(req: MCPRequest): Promise<MCPResponse | undefined> {
  log(`received: ${req.method} id=${req.id}`);

  if (req.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: req.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, logging: {} },
        serverInfo: { name: "kimi-pet-mcp", version: "0.1.0" },
      },
    };
  }

  if (req.method === "notifications/initialized") {
    log("client initialized");
    return undefined;
  }

  if (req.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: req.id,
      result: { tools: Object.entries(tools).map(([name, t]) => ({ name, ...t })) },
    };
  }

  if (req.method === "tools/call") {
    const name = req.params?.name;
    const args = req.params?.arguments ?? {};

    try {
      if (name === "pet_set_state") {
        const state = args.state as PetState;
        await postEvent("mcp.set_state", { state, message: args.message });
        return { jsonrpc: "2.0", id: req.id, result: createToolResult(`Pet state set to ${state}`) };
      }

      if (name === "pet_say") {
        const text = args.text as string;
        await postEvent("mcp.say", { message: text });
        return { jsonrpc: "2.0", id: req.id, result: createToolResult(`Pet says: ${text}`) };
      }

      if (name === "pet_notify") {
        const level = (args.level as string) ?? "info";
        const message = args.message as string;
        const stateMap: Record<string, PetState> = {
          info: "thinking",
          success: "success",
          warning: "waiting_approval",
          error: "error",
        };
        await postEvent("mcp.notify", { state: stateMap[level], message });
        return { jsonrpc: "2.0", id: req.id, result: createToolResult(`Pet notified: ${message}`) };
      }

      return { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `Unknown tool: ${name}` } };
    } catch (e) {
      return { jsonrpc: "2.0", id: req.id, error: { code: -32603, message: (e as Error).message } };
    }
  }

  return { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `Unknown method: ${req.method}` } };
}

export function startMcpServer(): void {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", async (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const req = JSON.parse(line) as MCPRequest;
        const res = await handleRequest(req);
        if (res) {
          process.stdout.write(JSON.stringify(res) + "\n");
        }
      } catch (e) {
        log(`error: ${(e as Error).message}`);
      }
    }
  });
}
