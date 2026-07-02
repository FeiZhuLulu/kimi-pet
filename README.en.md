**English** | [简体中文](./README.md)

# Kimi Pet 🐾

An always-on-top transparent desktop pet that reacts to your [Kimi Code](https://kimi.moonshot.cn/) coding sessions in real time.

![kimi-block-preview](docs/assets/kimi-block-preview.png)

## Features

- Live state animations (idle / thinking / tool_use / editing / waiting_approval / success / error)
- Auto-syncs with Kimi Code CLI via lifecycle hooks
- Transparent, draggable Electron window; settings saved to `~/.kimi-pet/settings.json`
- Launch from Kimi Code CLI with `/start pet`

## Install

Requires Node.js 20+, pnpm 8+, and Kimi Code CLI.

```bash
git clone https://github.com/FeiZhuLulu/kimi-pet.git
cd kimi-pet
corepack enable
node scripts/install-all.mjs
```

For CI or non-interactive install: `node scripts/install-all.mjs --yes`

## Start

**Recommended** — in Kimi Code CLI chat, type:

```text
/start pet
```

If it does not trigger, run `node scripts/install-plugin.mjs` first.

**Or run directly:**

```bash
node scripts/start-pet.mjs
```

On Windows, you can also double-click `start-pet.bat`.

## Verify & uninstall

```bash
node scripts/doctor.mjs          # check installation
node scripts/uninstall-hooks.mjs
node scripts/uninstall-slash-command.mjs
node scripts/uninstall-plugin.mjs
```

## How it works

```text
Kimi Code CLI → hooks → kimi-pet-hook → pet-daemon → desktop window / web preview
```

## More docs

- [Architecture](docs/ARCHITECTURE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md) (mirrors, common issues)
- [Changelog](CHANGELOG.md)

## License

MIT — see [LICENSE](LICENSE).