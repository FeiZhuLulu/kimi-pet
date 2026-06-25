import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.join(__dirname, "..", "dist", "cli.js");

function runCli(input: string, env: Record<string, string> = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "node",
      [CLI_PATH],
      {
        env: { ...process.env, ...env },
        timeout: 5000,
      },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          exitCode: error ? (error as any).code ?? 1 : 0,
        });
      }
    );
    child.stdin!.write(input);
    child.stdin!.end();
  });
}

const PRE_TOOL_USE_PAYLOAD = JSON.stringify({
  hook_event_name: "PreToolUse",
  session_id: "test-session-123",
  cwd: "/tmp",
  tool_name: "Shell",
  tool_input: { command: "echo hello" },
});

describe("kimi-pet-hook CLI", () => {
  it("produces no stdout on PreToolUse event", async () => {
    const result = await runCli(PRE_TOOL_USE_PAYLOAD, {
      KIMI_PET_DAEMON_URL: "http://127.0.0.1:1/events",
    });
    expect(result.stdout).toBe("");
  });

  it("exits 0 on PreToolUse event (daemon offline)", async () => {
    const result = await runCli(PRE_TOOL_USE_PAYLOAD, {
      KIMI_PET_DAEMON_URL: "http://127.0.0.1:1/events",
    });
    expect(result.exitCode).toBe(0);
  });

  it("produces no stdout on empty stdin", async () => {
    const result = await runCli("", {
      KIMI_PET_DAEMON_URL: "http://127.0.0.1:1/events",
    });
    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(0);
  });
});
