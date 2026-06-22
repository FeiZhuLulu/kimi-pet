import fsSync from "node:fs";
import http from "node:http";
import path from "node:path";
import { WebSocketServer } from "ws";
import type { PetEvent, PetPackManifest, PetState, PetStateSnapshot } from "@kimi-pet/shared-types";
import { PetStateMachine } from "@kimi-pet/pet-core";
import { loadPetPack, validatePetPack } from "@kimi-pet/pet-assets";

export interface DaemonOptions {
  port: number;
  host: string;
  petPackDir: string;
  maxRecentEvents?: number;
}

export class PetDaemon {
  private server: http.Server;
  private wss: WebSocketServer;
  private stateMachine: PetStateMachine;
  private recentEvents: PetEvent[] = [];
  private timers: Map<PetState, ReturnType<typeof setTimeout>> = new Map();
  private options: DaemonOptions;
  private petPackDir: string;

  constructor(options: DaemonOptions) {
    this.options = options;
    this.petPackDir = options.petPackDir;
    this.stateMachine = new PetStateMachine("idle");

    this.server = http.createServer((req, res) => this.handleHttp(req, res));
    this.wss = new WebSocketServer({ server: this.server, path: "/ws" });
    this.wss.on("connection", (ws) => {
      ws.send(JSON.stringify({ type: "state", data: this.stateMachine.getSnapshot() }));
    });
  }

  private manifestCache: PetPackManifest | null = null;

  async start(): Promise<void> {
    const loaded = await loadPetPack(this.petPackDir);
    this.manifestCache = loaded.manifest;
    const validation = await validatePetPack(this.petPackDir);
    if (!validation.ok) {
      throw new Error(
        `Invalid petpack at ${this.petPackDir}: ${validation.errors.map((e) => e.message).join(", ")}`
      );
    }
    return new Promise((resolve) => {
      this.server.listen(this.options.port, this.options.host, () => {
        console.log(`kimi-pet-daemon listening on ${this.options.host}:${this.options.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => resolve());
      });
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
      this.timers.clear();
    });
  }

  private handleHttp(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname === "/health" && req.method === "GET") {
      this.json(res, 200, { ok: true, name: "kimi-pet-daemon", version: "0.1.0" });
      return;
    }

    if (url.pathname === "/state" && req.method === "GET") {
      this.json(res, 200, this.stateMachine.getSnapshot());
      return;
    }

    if (url.pathname === "/events" && req.method === "POST") {
      this.readBody(req).then((body) => {
        const event = body as PetEvent;
        this.handleEvent(event);
        this.json(res, 200, { ok: true, state: this.stateMachine.getSnapshot().state });
      });
      return;
    }

    if (url.pathname === "/state" && req.method === "POST") {
      this.readBody(req).then((body) => {
        const { state, message } = body as { state: PetState; message?: string };
        this.setState(state, message);
        this.json(res, 200, this.stateMachine.getSnapshot());
      });
      return;
    }

    if (url.pathname === "/events/recent" && req.method === "GET") {
      this.json(res, 200, { events: this.recentEvents });
      return;
    }

    if (url.pathname === "/petpack" && req.method === "GET") {
      this.json(res, 200, this.manifestCache ?? { ok: true, dir: this.petPackDir });
      return;
    }

    if (url.pathname === "/spritesheet.webp" && req.method === "GET") {
      this.serveSpritesheet(res);
      return;
    }

    this.json(res, 404, { ok: false, error: "Not found" });
  }

  private handleEvent(event: PetEvent): void {
    this.recentEvents.push(event);
    const max = this.options.maxRecentEvents ?? 200;
    if (this.recentEvents.length > max) {
      this.recentEvents = this.recentEvents.slice(-max);
    }

    const result = this.stateMachine.transition(event);
    this.broadcastState();

    if (result.autoNext) {
      this.scheduleAutoNext(result.autoNext.state, result.autoNext.delayMs);
    }
  }

  private setState(state: PetState, message?: string): void {
    this.stateMachine.setState(state, message);
    this.broadcastState();
  }

  private scheduleAutoNext(state: PetState, delayMs: number): void {
    const existing = this.timers.get(state);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.stateMachine.setState(state);
      this.broadcastState();
      this.timers.delete(state);
    }, delayMs);

    this.timers.set(state, timer);
  }

  private broadcastState(): void {
    const data = JSON.stringify({ type: "state", data: this.stateMachine.getSnapshot() });
    for (const client of this.wss.clients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }

  private serveSpritesheet(res: http.ServerResponse): void {
    const filePath = path.join(this.petPackDir, "spritesheet.webp");
    try {
      const data = fsSync.readFileSync(filePath);
      res.writeHead(200, {
        "Content-Type": "image/webp",
        "Content-Length": data.length,
        "Cache-Control": "public, max-age=3600",
      });
      res.end(data);
    } catch {
      this.json(res, 404, { ok: false, error: "Spritesheet not found" });
    }
  }

  private json(res: http.ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }

  private readBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on("error", reject);
    });
  }
}
