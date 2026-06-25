import { describe, it, expect } from "vitest";
import {
  isKimiPetCommand,
  detectHooksFormat,
  removeKimiPetHooks,
  buildKimiPetHooks,
} from "./hooks-utils.mjs";

describe("isKimiPetCommand", () => {
  it("matches kimi-pet-hook", () => {
    expect(isKimiPetCommand("node path/to/kimi-pet-hook")).toBe(true);
  });

  it("matches packages/kimi-hooks-adapter", () => {
    expect(isKimiPetCommand("node packages/kimi-hooks-adapter/dist/cli.js")).toBe(true);
  });

  it("matches kimi-hooks-adapter/dist/cli.js", () => {
    expect(isKimiPetCommand("node E:/project/kimi-hooks-adapter/dist/cli.js")).toBe(true);
  });

  it("normalizes Windows backslashes", () => {
    expect(isKimiPetCommand("node E:\\project\\packages\\kimi-hooks-adapter\\dist\\cli.js")).toBe(true);
  });

  it("does not match unrelated commands", () => {
    expect(isKimiPetCommand("node C:/user/hooks/security.mjs")).toBe(false);
  });

  it("does not match unrelated tool names", () => {
    expect(isKimiPetCommand("node path/to/my-other-tool")).toBe(false);
    expect(isKimiPetCommand("node path/to/security-guard.mjs")).toBe(false);
  });
});

describe("detectHooksFormat", () => {
  it("detects inline format", () => {
    const text = `hooks = [\n  { event = "Stop", command = "node test" }\n]`;
    expect(detectHooksFormat(text)).toBe("inline");
  });

  it("detects block format", () => {
    const text = `[[hooks]]\nevent = "Stop"\ncommand = "node test"`;
    expect(detectHooksFormat(text)).toBe("block");
  });

  it("detects none", () => {
    expect(detectHooksFormat("default_model = 'test'")).toBe("none");
  });

  it("detects mixed", () => {
    const text = `hooks = [\n  { event = "Stop", command = "node test" }\n]\n\n[[hooks]]\nevent = "PreToolUse"\ncommand = "node other"`;
    expect(detectHooksFormat(text)).toBe("mixed");
  });
});

describe("removeKimiPetHooks", () => {
  it("throws on mixed format", () => {
    const text = `hooks = [{ event = "Stop", command = "node kimi-pet-hook" }]\n[[hooks]]\nevent = "PreToolUse"\ncommand = "node other"`;
    expect(() => removeKimiPetHooks(text)).toThrow("cannot safely edit");
  });

  it("returns text unchanged when format is none", () => {
    const text = `default_model = "test"`;
    const result = removeKimiPetHooks(text);
    expect(result.text).toBe(text);
    expect(result.format).toBe("none");
  });

  describe("inline format", () => {
    it("removes kimi-pet entries, keeps user entries", () => {
      const text = [
        'default_model = "kimi-code/kimi-for-coding"',
        "",
        "hooks = [",
        '  { event = "PreToolUse", command = "node C:/user/hooks/security.mjs", timeout = 5 },',
        '  { event = "Stop", command = "node E:/project/packages/kimi-hooks-adapter/dist/cli.js", timeout = 1 },',
        '  { event = "SessionStart", command = "node E:/project/packages/kimi-hooks-adapter/dist/cli.js", timeout = 1 }',
        "]",
      ].join("\n");

      const result = removeKimiPetHooks(text);
      expect(result.text).toContain('default_model = "kimi-code/kimi-for-coding"');
      expect(result.text).toContain("security.mjs");
      expect(result.text).not.toContain("kimi-hooks-adapter");
      expect(result.text).toContain("hooks = [");
      expect(result.format).toBe("inline");
    });

    it("removes entire inline block when all entries are kimi-pet", () => {
      const text = [
        "hooks = [",
        '  { event = "Stop", command = "node kimi-pet-hook" },',
        '  { event = "SessionStart", command = "node kimi-pet-hook" }',
        "]",
      ].join("\n");

      const result = removeKimiPetHooks(text);
      expect(result.text).not.toContain("hooks");
      expect(result.text).not.toContain("kimi-pet");
    });
  });

  describe("block format", () => {
    it("removes kimi-pet blocks, keeps user blocks", () => {
      const text = [
        'default_model = "test"',
        "",
        "[[hooks]]",
        'event = "PreToolUse"',
        'matcher = "Bash"',
        'command = "node C:/user/hooks/security.mjs"',
        "timeout = 5",
        "",
        "[[hooks]]",
        'event = "Stop"',
        'command = "node E:/project/packages/kimi-hooks-adapter/dist/cli.js"',
        "timeout = 1",
      ].join("\n");

      const result = removeKimiPetHooks(text);
      expect(result.text).toContain("security.mjs");
      expect(result.text).not.toContain("kimi-hooks-adapter");
      expect(result.text).toContain("[[hooks]]");
      expect(result.text).toContain('default_model = "test"');
      expect(result.format).toBe("block");
    });

    it("removes all blocks when all are kimi-pet", () => {
      const text = [
        "[[hooks]]",
        'event = "Stop"',
        'command = "node kimi-pet-hook"',
        "timeout = 1",
      ].join("\n");

      const result = removeKimiPetHooks(text);
      expect(result.text).not.toContain("[[hooks]]");
      expect(result.text).not.toContain("kimi-pet");
    });

    it("preserves non-hooks sections", () => {
      const text = [
        'default_model = "test"',
        "",
        "[[hooks]]",
        'event = "Stop"',
        'command = "node kimi-pet-hook"',
        "timeout = 1",
        "",
        "[other-section]",
        "key = value",
      ].join("\n");

      const result = removeKimiPetHooks(text);
      expect(result.text).toContain("[other-section]");
      expect(result.text).toContain("key = value");
      expect(result.text).toContain('default_model = "test"');
    });
  });
});

describe("buildKimiPetHooks", () => {
  it("builds inline format", () => {
    const result = buildKimiPetHooks("inline", ["Stop", "SessionStart"], "node test.js");
    expect(result).toContain("hooks = [");
    expect(result).toContain('event = "Stop"');
    expect(result).toContain('event = "SessionStart"');
    expect(result).toContain('command = "node test.js"');
    expect(result).toContain("timeout = 1");
  });

  it("builds block format", () => {
    const result = buildKimiPetHooks("block", ["Stop", "SessionStart"], "node test.js");
    expect(result).toContain("[[hooks]]");
    expect(result).toContain('event = "Stop"');
    expect(result).toContain('event = "SessionStart"');
    expect(result).toContain('command = "node test.js"');
    expect(result).toContain("timeout = 1");
    expect(result).not.toContain("hooks = [");
  });
});
