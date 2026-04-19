# Aiden

> Local-first Windows AI OS · 56 skills · 60+ tools · 13 providers

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)](https://github.com/taracodlabs/aiden-releases/releases/latest)
[![Version](https://img.shields.io/badge/version-v3.7.0-orange)](https://github.com/taracodlabs/aiden-releases/releases/latest)

---

## What is Aiden?

Aiden is a local-first AI operating system that runs entirely on your Windows machine. It combines a full terminal UI, a web dashboard, 60+ autonomous tools, and a plugin-style skill system — all powered by local models via [Ollama](https://ollama.com) with optional cloud provider fallback. No data leaves your hardware unless you configure a cloud API key. At v3.7.0, Aiden ships as a signed installer with auto-updates, a 6-layer memory architecture, self-healing provider routing, and the ability to control your screen, browse the web, run code, send emails, manage files, and talk to you — entirely offline.

---

## Features

- **Local-first inference** — runs on Ollama (Llama 3, Mistral, Qwen, Gemma, and more); cloud providers (OpenAI, Anthropic, Groq, Cerebras, NVIDIA NIM, OpenRouter) are optional fallbacks
- **60+ built-in tools** — web search, file read/write, shell execution, browser automation (Playwright), screen capture & OCR, calendar, email (IMAP/SMTP), and more
- **56 installable skills** — composable plugins that teach Aiden new domains (stock research, code review, image generation, Minecraft server setup, Pokémon emulation, and more)
- **Subagent swarm** — spawn N parallel agents on a task, then vote, merge, or pick the best result
- **6-layer memory** — episodic, semantic (BM25 + vector), procedural, skill, goal, and LESSONS.md permanent-failure moat
- **Self-healing provider chain** — exponential backoff, keepalive, fast-path routing; Aiden never drops a request
- **Voice layer** — speech-to-text (Groq → OpenAI → local Whisper.cpp) + text-to-speech (Edge TTS → ElevenLabs → Windows SAPI)
- **Channel adapters** — Discord, Slack, Telegram, WhatsApp, Email, Webhook, and Twilio out of the box
- **Computer use** — takes screenshots, reads screen state, and performs GUI automation when asked
- **Self-evolution** — analyses its own past failures and appends permanent rules to `LESSONS.md`; the moat grows every session

---

## Install

### Option A — Download installer (recommended)

**[→ Download Aiden v3.7.0 for Windows](https://github.com/taracodlabs/aiden-releases/releases/latest)**

Run `Aiden-Setup-3.7.0.exe`. Aiden installs with auto-update support — install once, stay current.

### Option B — Build from source

Requires: Node.js ≥ 18, Windows 10/11 (64-bit), [Ollama](https://ollama.com) installed and running.

```bash
git clone https://github.com/taracodlabs/aiden.git
cd aiden
npm install
npm run build          # TypeScript compile + CLI + API bundle
npm run dist           # Build signed Windows installer → release/
```

The installer lands in `release/`. Install it, then run `aiden` from any terminal.

---

## Running Aiden

### Desktop app (recommended)

```cmd
aiden pc
```

Launches the Electron desktop app. The API server starts automatically.

### Terminal / TUI mode

```cmd
npm run serve          # start API server on :4200
npm run cli            # start the TUI (separate terminal)
```

Once running, explore with `/help`, `/tools`, `/skills`, `/providers`.

---

## Configuration

Copy `.env.example` to `.env` in the Aiden data directory and fill in the values you need.

```bash
cp .env.example .env
```

Key settings:

| Variable | Default | Notes |
|---|---|---|
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Override if Ollama runs on a different host/port |
| `OLLAMA_MODEL` | `mistral-nemo:12b` | Default chat model |
| `ANTHROPIC_API_KEY` | — | Optional cloud fallback |
| `OPENAI_API_KEY` | — | Optional cloud fallback |
| `GROQ_API_KEY` | — | Free tier: fast Llama 3 inference |

See `.env.example` for the full list of ~90 variables covering messaging integrations, voice, search, and more.

---

## Architecture

Aiden's core is an autonomous agent loop (`core/agentLoop.ts`) that routes each user message through a planner, a set of tool-calling steps, and a responder. Memory is split across six layers: in-context episodic, BM25 keyword search, vector semantic search, procedural (skill scripts), goal tracking, and the permanent `LESSONS.md` moat. Skills (`skills/`) are self-contained directories each with a `SKILL.md` prompt, tool implementations, and an optional sandbox runner. The provider router (`providers/router.ts`) tries each configured provider in priority order with automatic retry and keepalive.

See [ARCHITECTURE.md](ARCHITECTURE.md) for a full diagram and layer-by-layer breakdown.

---

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

Quick summary:
- Bug fixes and skill contributions are the easiest entry points
- All contributors must sign the [Contributor License Agreement](.github/CLA.md) (one-time, via PR comment)
- Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/)
- Run `npx tsc --noEmit` before opening a PR

---

## Commercial Use

Aiden's core is **AGPL-3.0**. You can self-host, study, and modify it freely. If you embed Aiden in a commercial product or offer it as a hosted service, AGPL-3.0 requires you to release your modifications under the same license — **or** purchase a commercial license that removes this requirement.

For commercial licensing inquiries: **hello@taracod.com**

Skills in `skills/` are licensed under **Apache-2.0** (see [LICENSE-SKILLS.md](LICENSE-SKILLS.md)) and can be used in commercial products without copyleft obligations.

---

## License

| Component | License |
|---|---|
| Core (`src/`, `cli/`, `api/`, `core/`, `providers/`, `dashboard-next/`) | [AGPL-3.0-only](LICENSE) |
| Skills (`skills/`) | [Apache-2.0](LICENSE-SKILLS.md) |

---

Built by [Taracod](https://taracod.com) · Made in India
