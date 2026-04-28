# aiden-os

> One command installs and runs [DevOS — Aiden](https://github.com/taracodlabs/devos), the autonomous local AI operating system.

## Quick Start

```bash
npx aiden-os
```

Or install globally for the `aiden` command:

```bash
npm install -g aiden-os
aiden
```

## What it does

On first run, the setup wizard:
1. Asks which AI provider you want (Groq, OpenRouter, Anthropic, OpenAI, or Ollama)
2. Validates your API key
3. Saves config to `~/.aiden/app/.env` (or `%LOCALAPPDATA%\aiden\app\.env` on Windows)
4. Starts the DevOS server + CLI in a **single terminal** — no second window needed

On subsequent runs, it skips the wizard and goes straight to the AI assistant.

## Requirements

- Node.js 18+
- Internet connection (for cloud providers) or [Ollama](https://ollama.com) running locally

## Peer dependency

`aiden-os` auto-installs `devos-ai` the first time it runs.  
You can also pre-install it: `npm install -g devos-ai`

## License

AGPL-3.0-only — © 2026 Taracod
