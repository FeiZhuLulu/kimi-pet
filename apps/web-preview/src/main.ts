import { PetRenderer } from "./renderer.js";
import type { PetPackManifest, PetState, PetStateSnapshot } from "@kimi-pet/shared-types";

const DAEMON_URL = "http://127.0.0.1:17373";
const WS_URL = "ws://127.0.0.1:17373/ws";

const stateText = document.getElementById("state-text")!;
const statusEl = document.getElementById("status")!;
const petSprite = document.getElementById("pet-sprite")!;

async function main() {
  try {
    const res = await fetch(`${DAEMON_URL}/petpack`);
    const manifest = (await res.json()) as PetPackManifest;

    const spritesheetUrl = `${DAEMON_URL}/spritesheet.webp`;

    const renderer = new PetRenderer(petSprite, manifest, spritesheetUrl);

    const update = (snapshot: PetStateSnapshot) => {
      renderer.setState(snapshot.state);
      stateText.textContent = snapshot.state;
      if (snapshot.message) {
        statusEl.textContent = snapshot.message;
      }
    };

    // Manual controls
    document.querySelectorAll("#controls button").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const state = (btn as HTMLButtonElement).dataset.state as PetState;
        await fetch(`${DAEMON_URL}/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });
      });
    });

    // WebSocket
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      statusEl.textContent = "connected";
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "state") {
        update(msg.data);
      }
    };
    ws.onclose = () => {
      statusEl.textContent = "disconnected";
    };
    ws.onerror = () => {
      statusEl.textContent = "connection error";
    };

    // Initial state
    const stateRes = await fetch(`${DAEMON_URL}/state`);
    const snapshot = (await stateRes.json()) as PetStateSnapshot;
    update(snapshot);
  } catch (e) {
    statusEl.textContent = `error: ${(e as Error).message}`;
  }
}

main();
