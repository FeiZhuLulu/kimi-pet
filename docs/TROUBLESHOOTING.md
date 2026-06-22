# Troubleshooting

## `/pet` does not appear in Kimi Code chat

1. Make sure the slash command file exists:
   - CLI: `~/.kimi/commands/pet.md`
   - VS Code: `~/.kimi-code/commands/pet.md`
2. Re-run the installer:
   ```bash
   node scripts/install-slash-command.mjs
   ```
3. Restart Kimi Code (CLI or VS Code window).
4. Some Kimi Code builds expose slash commands only in interactive chat sessions; non-interactive `kimi -p` will not trigger hooks or slash commands.

## Desktop window does not appear

1. Verify the build:
   ```bash
   corepack pnpm -r build
   ```
2. Run the launcher manually and check the output:
   ```bash
   node scripts/start-pet.mjs
   ```
3. If Electron fails to download, set a mirror and reinstall:
   ```bash
   # PowerShell
   $env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
   corepack pnpm install
   ```

## Daemon port is already in use

Set a different port:

```bash
$env:KIMI_PET_PORT="17374"
node scripts/start-pet.mjs
```

Then update `~/.kimi/config.toml` and `~/.kimi-code/config.toml` hook commands to use the same port.

## Electron binary was manually extracted

If you placed the Electron `dist` folder manually, make sure it is at one of these paths:

- `node_modules/.pnpm/electron@30.5.1/node_modules/electron/dist/`
- `node_modules/electron/dist/`

Then re-run `node scripts/start-pet.mjs --dry-run` to verify the path is detected.
