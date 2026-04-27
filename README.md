```
 █████╗ ██╗██████╗ ███████╗███╗   ██╗
██╔══██╗██║██╔══██╗██╔════╝████╗  ██║
███████║██║██║  ██║█████╗  ██╔██╗ ██║
██╔══██║██║██║  ██║██╔══╝  ██║╚██╗██║
██║  ██║██║██████╔╝███████╗██║ ╚████║
╚═╝  ╚═╝╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝

local-first AI operating system
1,400+ skills · 80+ tools · 15+ providers · AGPL-3.0
Windows · Linux · WSL · macOS (API mode)
```

<p align="center">
  <a href="https://github.com/taracodlabs/aiden-releases/releases/latest"><img src="https://img.shields.io/github/v/release/taracodlabs/aiden-releases?color=f97316&label=version" alt="Latest version" /></a>
  <a href="https://github.com/taracodlabs/aiden-releases/releases"><img src="https://img.shields.io/github/downloads/taracodlabs/aiden-releases/total?color=f97316&label=downloads" alt="Downloads" /></a>
  <a href="https://discord.gg/gMZ3hUnQTm"><img src="https://img.shields.io/badge/chat-discord-7289da?logo=discord&logoColor=white" alt="Discord" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-orange" alt="License: AGPL-3.0" /></a>
  <a href="https://github.com/taracodlabs/aiden/stargazers"><img src="https://img.shields.io/github/stars/taracodlabs/aiden?style=flat&color=f9d71c" alt="Stars" /></a>
</p>

<p align="center">
  <a href="https://aiden.taracod.com"><b>Website</b></a> &nbsp;·&nbsp;
  <a href="https://aiden.taracod.com/contact"><b>Contact</b></a> &nbsp;·&nbsp;
  <a href="https://discord.gg/gMZ3hUnQTm"><b>Discord</b></a> &nbsp;·&nbsp;
  <a href="https://github.com/taracodlabs/aiden-releases/releases/latest"><b>Download</b></a>
</p>

---

> **v3.11 — Custom provider routing + Claude Haiku 4.5**
> Full custom OpenAI-compatible provider support: plug in any endpoint via config with no code changes. BayOfAssets Claude Haiku 4.5 ships as the new default tier-1 provider. Fixes silent Groq fallback in `callLLM`, greeting memory double-label, and health endpoint missing custom providers. See [changelog](#changelog) below.

---

Aiden is a local-first AI operating system. It runs entirely on
your machine — no cloud account required, no telemetry, no data leaving your
hardware unless you configure a cloud provider. It ships with a signed Windows
installer, and runs in headless API mode on Linux, WSL, and macOS. Features:
1,400+ composable skills, 80+ built-in tools, a 6-layer memory architecture,
self-healing provider routing, and the ability to control your screen, browse
the web, run code, send emails, manage files, and hold a full conversation —
offline via Ollama.

## Platform support

| Platform | GUI app | API + CLI | Skills available |
|---|---|---|---|
| **Windows 10/11** | ✅ signed installer | ✅ | All 1,400+ (including Windows-only skills) |
| **Linux** | — | ✅ headless | ~1380 (Windows-only skills auto-skipped) |
| **WSL 2** | — | ✅ headless | ~1380 (Windows-only skills auto-skipped) |
| **macOS** | — | ✅ headless | ~1380 (Windows-only skills auto-skipped) |

Windows-only skills (clipboard history, Defender, OneNote, Outlook COM, registry, etc.) are tagged `platform: windows` and are silently skipped on other platforms at load time.

## Install

### Windows

```powershell
irm aiden.taracod.com/install.ps1 | iex
```

Or [download the installer](https://github.com/taracodlabs/aiden-releases/releases/latest) manually. Windows 10/11, 64-bit, ~500 MB disk space.

### Linux / WSL / macOS

```bash
curl -fsSL aiden.taracod.com/install.sh | bash
```

Or install manually:

```bash
# Prerequisites: Node.js 20+, git, Ollama (recommended)
git clone https://github.com/taracodlabs/aiden.git
cd aiden
cp .env.example .env          # configure OLLAMA_HOST, API keys, etc.
npm install
npm run build
npm start                     # starts the API server (headless)
# In a second terminal:
npm run cli                   # interactive TUI
```

Set `AIDEN_HEADLESS=true` to suppress the Electron GUI when running the packaged app.

## Screenshots

### Terminal (TUI)

![TUI](docs/images/tui.png)

Full command palette, 1,400+ skills, 80+ tools, automatic provider routing (Groq → BOA → Ollama). Runs in any terminal.

### Desktop app

![Desktop](docs/images/dashboard.png)

Full chat interface with live activity panel. Local-first, connects to Ollama or any of 15+ cloud providers via your own API key.

### Memory graph

![Memory graph](docs/images/memory-graph.png)

6-layer memory visualized — every conversation, task, and learned pattern becomes a node in the knowledge graph. Fully local, persisted to disk, searchable.

---

## Features

| Category | What Aiden does |
|---|---|
| **Inference & providers** | Local Ollama (Llama 3, Mistral, Qwen, Gemma, Phi…) with optional cloud fallback to OpenAI, Anthropic, Groq, Cerebras, NVIDIA NIM, OpenRouter, and more — 15+ providers including custom OpenAI-compatible endpoints |
| **80+ tools** | Web search, file read/write, shell execution, Playwright browser automation, screen capture & OCR, calendar, email (IMAP/SMTP), code execution sandbox, clipboard, system info |
| **1,400+ skills** | Composable plugins each with a `SKILL.md` prompt, tool implementations, and optional sandbox runner — install per-session or globally |
| **Subagent swarm** | Spawn N parallel agents on any task; vote, merge, or pick the best result automatically |
| **6-layer memory** | Episodic (in-context), BM25 keyword, vector semantic, procedural (skill), goal tracking, and `LESSONS.md` permanent-failure moat that grows every session |
| **Voice** | Speech-to-text (Groq → OpenAI → local Whisper.cpp) + text-to-speech (Edge TTS → ElevenLabs → Windows SAPI); full offline voice loop |
| **Channel adapters** | Discord, Slack, Telegram, WhatsApp, Email, Webhook, Twilio — any channel triggers the same agent loop |
| **Computer use** | Screenshots, screen state reader, GUI automation via keyboard/mouse when asked — full OS control mode |

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
  │  Agent loop │────▶│  Tool dispatcher │──▶ 80+ tools
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
  │  Provider   │  ← self-healing chain, 15+ providers
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

## Security & Sandbox

Aiden includes an opt-in Docker sandbox backend that runs `shell_exec` and `run_python` tool calls inside isolated containers instead of directly on the host.

### Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) or Docker Engine (Linux)

### Modes

| `AIDEN_SANDBOX_MODE` | Behaviour |
|---|---|
| `off` *(default)* | Tools run on the host — no Docker required |
| `auto` | Try Docker first; silently fall back to host if Docker is unavailable |
| `strict` | Require Docker — error if Docker is not available |

### Enable

```bash
# In .env
AIDEN_SANDBOX_MODE=auto
```

Or toggle live from the Aiden CLI without restarting:

```
/sandbox auto     # switch to auto mode
/sandbox strict   # require Docker
/sandbox off      # disable
/sandbox status   # show current mode + Docker availability
/sandbox build    # pre-build the container image
```

### What the container provides

- `--network=none` — no outbound network access (configurable per-call)
- `--memory=512m --cpus=1` — hard resource caps
- `--read-only --tmpfs /tmp` — immutable FS, only `/tmp` is writable
- `--rm` — container removed immediately after each tool call
- Host `workspace/` bind-mounted at `/workspace` so results are accessible

---

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

- Bug fixes and new skills are the easiest entry points
- All contributors sign the [CLA](.github/CLA.md) once via PR comment
- Follow [Conventional Commits](https://www.conventionalcommits.org/)
- Run `npx tsc --noEmit` before opening a PR

---

## Resources

| | |
|---|---|
| **Download installer** | [Latest release](https://github.com/taracodlabs/aiden-releases/releases/latest) |
| **Releases & changelog** | [github.com/taracodlabs/aiden-releases](https://github.com/taracodlabs/aiden-releases) |
| **License** | AGPL-3.0 core · Apache-2.0 skills |

---

## Changelog

### v3.11.0 — 2026-04-25

**Custom provider routing**
- Full support for custom OpenAI-compatible endpoints via `customProviders` in `devos.config.json` — add any endpoint with a `baseUrl`, `apiKey`, and `model`; no code changes required
- Fixed silent Groq fallback bug in `callLLM`: custom providers now correctly route to their configured `baseUrl` instead of falling back to the Groq URL
- Fixed `raceProviders` pin-first logic: `primaryProvider` is now resolved from `customProviders` list when not found in `providers.apis`
- Fixed health/status endpoint (`/api/providers`) to include custom providers in the returned list, tier-sorted

**BayOfAssets Claude Haiku 4.5 as default primary**
- Swapped default primary provider to BayOfAssets Claude Haiku 4.5 (`claude-haiku-4-5`) at tier 1
- Groq and Gemini remain as tier-2 fallback chain

**Memory & greeting**
- Fixed `buildGreetingPreamble` double-label bug: `"Active goals: Active goals:\n..."` → compact single-line goal titles
- Added empty-string guard on greeting reply: blank preamble no longer produces `"Currently tracking: . What do you need?"`

---

### v3.10.0 — 2026-04-09

See [releases page](https://github.com/taracodlabs/aiden-releases/releases) for older changelogs.

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

Built by [Taracod](https://taracod.com) · Built by Shiva Deore ·  AGPL-3.0
