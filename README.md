```
    ___   _    ___   ___  _  _
   /   \ | |  |   \ | __|| \| |
  / /\ / | |_ | |) || _| | .` |
 /_/\_\  |___||___/ |___||_|\_|
  local-first AI OS for Windows
```

**[aiden.taracod.com](https://aiden.taracod.com)** · **[Releases](https://github.com/taracodlabs/aiden-releases/releases)** · **[Contact](https://aiden.taracod.com/contact)**

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078d4)](https://github.com/taracodlabs/aiden-releases/releases/latest)
[![Version](https://img.shields.io/badge/version-v3.7.0-f97316)](https://github.com/taracodlabs/aiden-releases/releases/latest)
[![Skills](https://img.shields.io/badge/skills-56-22c55e)](skills/)
[![Providers](https://img.shields.io/badge/providers-13-a855f7)](providers/)

---

Aiden is a local-first AI operating system for Windows. It runs entirely on your machine — no cloud account required, no telemetry, no data leaving your hardware unless you configure a cloud API key. At v3.7.0 it ships as a signed installer with auto-updates, 56 composable skills, 60+ autonomous tools, a 6-layer memory architecture, self-healing provider routing, and the ability to control your screen, browse the web, run code, send emails, manage files, and hold a full conversation — entirely offline via Ollama.

---

## Quick links

| | |
|---|---|
| **Install (one command)** | `irm aiden.taracod.com/install.ps1 \| iex` |
| **Download installer** | [Aiden-Setup-3.7.0.exe](https://github.com/taracodlabs/aiden-releases/releases/download/v3.7.0/Aiden-Setup-3.7.0.exe) |
| **Releases & changelog** | [github.com/taracodlabs/aiden-releases](https://github.com/taracodlabs/aiden-releases) |
| **Landing page** | [aiden.taracod.com](https://aiden.taracod.com) |
| **Contact / commercial** | [aiden.taracod.com/contact](https://aiden.taracod.com/contact) |
| **Discord** | [discord.gg/TwrWSkph](https://discord.gg/TwrWSkph) |
| **License** | AGPL-3.0 core · Apache-2.0 skills |

---

## Install

### One command (PowerShell 5.1+, Windows 10/11)

```powershell
irm aiden.taracod.com/install.ps1 | iex
```

Downloads and runs the signed installer, then places `aiden` on your PATH. Run `aiden pc` to launch.

### Download the installer directly

**[→ Aiden-Setup-3.7.0.exe](https://github.com/taracodlabs/aiden-releases/releases/download/v3.7.0/Aiden-Setup-3.7.0.exe)**

Run the installer. Aiden auto-updates after first launch — install once, stay current.

### Build from source

Requires: Node.js ≥ 18, Windows 10/11 (64-bit), [Ollama](https://ollama.com) installed and running.

```bash
git clone https://github.com/taracodlabs/aiden.git
cd aiden
npm install
npm run build          # TypeScript compile + CLI + API bundle
npm run dist           # Signed Windows installer → release/
```

Install the `.exe` in `release/`, then run `aiden` from any terminal.

---

## Features

| Category | What Aiden does |
|---|---|
| **Inference & providers** | Local Ollama (Llama 3, Mistral, Qwen, Gemma, Phi…) with optional cloud fallback to OpenAI, Anthropic, Groq, Cerebras, NVIDIA NIM, OpenRouter, and more — 13 providers total |
| **60+ tools** | Web search, file read/write, shell execution, Playwright browser automation, screen capture & OCR, calendar, email (IMAP/SMTP), code execution sandbox, clipboard, system info |
| **56 skills** | Composable plugins each with a `SKILL.md` prompt, tool implementations, and optional sandbox runner — install per-session or globally |
| **Subagent swarm** | Spawn N parallel agents on any task; vote, merge, or pick the best result automatically |
| **6-layer memory** | Episodic (in-context), BM25 keyword, vector semantic, procedural (skill), goal tracking, and `LESSONS.md` permanent-failure moat that grows every session |
| **Voice** | Speech-to-text (Groq → OpenAI → local Whisper.cpp) + text-to-speech (Edge TTS → ElevenLabs → Windows SAPI); full offline voice loop |
| **Channel adapters** | Discord, Slack, Telegram, WhatsApp, Email, Webhook, Twilio — any channel triggers the same agent loop |
| **Computer use** | Screenshots, screen state reader, GUI automation via keyboard/mouse when asked — full OS control mode |

---

## Screenshots

### Terminal (TUI)

![TUI](docs/images/tui.png)

Full command palette, 56 skills, 80 tools, automatic provider
routing (Groq → BOA → Ollama). Runs in any terminal.

### Desktop app

![Desktop](docs/images/dashboard.png)

Full chat interface with live activity panel. Local-first,
connects to Ollama or any of 13 cloud providers via your
own API key.

### Memory graph

![Memory graph](docs/images/memory-graph.png)

6-layer memory visualized — every conversation, task, and
learned pattern becomes a node in the knowledge graph. Fully
local, persisted to disk, searchable.

---

## Architecture

```
User input (any channel)
        │
        ▼
  ┌─────────────┐
  │  Planner    │  ← breaks task into steps
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐     ┌──────────────────┐
  │  Agent loop │────▶│  Tool dispatcher │──▶ 60+ tools
  │  agentLoop  │     └──────────────────┘
  └──────┬──────┘
         │
         ▼
  ┌─────────────────────────────────┐
  │  Memory (6 layers)              │
  │  episodic · BM25 · vector ·     │
  │  procedural · goal · LESSONS.md │
  └─────────────────────────────────┘
         │
         ▼
  ┌─────────────┐
  │  Provider   │  ← self-healing chain, 13 providers
  │  router     │
  └─────────────┘
         │
         ▼
     Response (streamed to originating channel)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for a full layer-by-layer breakdown, data flow diagrams, and the skill system design.

---

## Configuration

Copy `.env.example` to `.env` in the Aiden data directory.

```bash
cp .env.example .env
```

Key environment variables:

| Variable | Default | Notes |
|---|---|---|
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Override if Ollama runs on a different host/port |
| `OLLAMA_MODEL` | `mistral-nemo:12b` | Default chat model |
| `ANTHROPIC_API_KEY` | — | Optional cloud fallback |
| `OPENAI_API_KEY` | — | Optional cloud fallback |
| `GROQ_API_KEY` | — | Free tier: fast Llama 3 inference |
| `DAILY_BUDGET_USD` | `5.00` | Hard cap on daily cloud API spend |

See `.env.example` for the full list of ~90 variables covering voice, messaging integrations, search, computer use, and more.

---

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

- Bug fixes and new skills are the easiest entry points
- All contributors sign the [CLA](.github/CLA.md) once via PR comment
- Follow [Conventional Commits](https://www.conventionalcommits.org/)
- Run `npx tsc --noEmit` before opening a PR

---

## License

| Component | License |
|---|---|
| Core (`src/`, `cli/`, `api/`, `core/`, `providers/`, `dashboard-next/`) | [AGPL-3.0-only](LICENSE) |
| Skills (`skills/`) | [Apache-2.0](LICENSE-SKILLS.md) |

## Commercial use

Aiden's core is **AGPL-3.0**. You can self-host, modify, and study it freely. Embedding it in a commercial product or offering it as a hosted service requires either releasing your modifications under AGPL-3.0 or purchasing a commercial license.

Skills in `skills/` are **Apache-2.0** and can be used in commercial products without copyleft obligations.

For commercial licensing and enterprise deployments: **[aiden.taracod.com/contact?type=enterprise](https://aiden.taracod.com/contact?type=enterprise)**

---

Built by [Taracod](https://taracod.com) · Made in India · AGPL-3.0
