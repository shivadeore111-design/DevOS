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

> **v3.16 — `npx aiden-os` single-command launch · programmatic API · in-process server + CLI**
> Run Aiden with one command — no clone, no build, no two terminals. `npx aiden-os` installs the runtime, runs the setup wizard on first use, then starts the server and CLI together in the same process. New `start()` / `run()` exports for embedding Aiden in your own Node.js apps. See [changelog](#changelog) below.

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

## Quick Start

### Fastest — `npx` (no install needed)

```bash
npx aiden-os
```

That's it. Node.js 18+ is the only prerequisite. On first run it asks which AI provider you want (Groq is free), validates your key, saves config to `~/.aiden/app/`, and starts both the server and CLI together in one terminal. Subsequent runs skip the wizard and go straight to the assistant.

Or install globally for the `aiden` command:

```bash
npm install -g aiden-os
aiden
```

### Prerequisites (for installer / manual builds)
- Node.js 18+
- Git
- Ollama (optional, for offline mode): [ollama.ai](https://ollama.ai)

### Windows — signed installer

```powershell
irm aiden.taracod.com/install.ps1 | iex
```

Or [download the signed installer](https://github.com/taracodlabs/aiden-releases/releases/latest) manually. Windows 10/11, 64-bit, ~500 MB disk space.

### Linux / WSL / macOS — one-line install

```bash
curl -fsSL aiden.taracod.com/install.sh | bash
```

### Manual install (all platforms)

```bash
git clone https://github.com/taracodlabs/aiden.git
cd aiden
npm install
cp .env.example .env
# Edit .env — add at minimum one API key (Groq is free: console.groq.com)
```

### Run (manual install)

```bash
# Terminal 1 — build and start server
npm run build
npm start

# Terminal 2 — start CLI
npm run cli
```

### After pulling updates (manual install)

```bash
git pull
npm run build
npm start
```

### Uninstall

**Windows**
Open *Settings → Apps* (or *Control Panel → Programs*) and uninstall **Aiden**.
To also remove user data:
```powershell
Remove-Item -Recurse -Force "$env:APPDATA\aiden"
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\aiden"
```

**Linux / macOS / WSL**
```bash
curl -fsSL aiden.taracod.com/uninstall.sh | bash
```
Or manually:
```bash
rm -rf ~/.local/share/aiden ~/.config/aiden
npm uninstall -g devos-ai   # if installed via npm
```

### Minimum .env to get started

```
GROQ_API_KEY=your_key_here   # free at console.groq.com/keys
```

Set `AIDEN_HEADLESS=true` to suppress the Electron GUI when running the packaged app.

---

## Troubleshooting

**"Cannot find module" or TypeScript errors**
```bash
npm run build   # always rebuild after git pull
```

**"npm run serve" not found**
There is no `serve` script. Use `npm start` instead.

**Server not responding**
```bash
# Check if server is running on port 4200
netstat -ano | findstr :4200   # Windows
lsof -i :4200                  # Linux/macOS
```

**Ollama not connecting**
```bash
ollama serve             # make sure Ollama is running
ollama pull qwen2.5:7b   # pull your chosen model
```

**Changing Ollama model or inference settings** (no recompile needed — edit `.env`):
```
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_TEMPERATURE=0.3
OLLAMA_CONTEXT_LENGTH=4096
OLLAMA_NUM_GPU=99
```

**Use with any OpenAI client (Open WebUI, Chatbox, Cursor, etc.)**
```
Base URL:  http://localhost:4200
API Key:   none required
Model:     aiden-3.13
```

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
| **80+ tools** | Web search, file read/write, shell execution, Playwright browser automation (`open_browser`, `browser_click`, `browser_type`, `browser_extract`, `browser_get_url`), screen capture & OCR, calendar, email (IMAP/SMTP), code execution sandbox, clipboard, LocalSend LAN transfer, system info |
| **1,400+ skills** | Composable plugins each with a `SKILL.md` prompt, tool implementations, and optional sandbox runner — install per-session or globally. Includes: LocalSend (AirDrop-style LAN transfer), Decepticon security scanner (opt-in), and more |
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

## Use with any OpenAI client

Aiden exposes an OpenAI-compatible API at `localhost:4200`. Point any OpenAI client at Aiden to get the full 89-tool agent instead of raw GPT:

| Setting | Value |
|---|---|
| **Base URL** | `http://localhost:4200` |
| **API Key** | *(none required locally)* |
| **Model** | `aiden-3.13` |

Works with: **Open WebUI** · **LibreChat** · **Chatbox** · **Continue.dev** · **Cursor** · **TypingMind** · any app using the OpenAI SDK.

```python
# Python example — zero config
from openai import OpenAI
client = OpenAI(base_url="http://localhost:4200", api_key="none")
response = client.chat.completions.create(
    model="aiden-3.13",
    messages=[{"role": "user", "content": "search news about AI agents"}]
)
print(response.choices[0].message.content)
```

Optional: set `AIDEN_API_KEY=your-secret` in `.env` to require Bearer token authentication.

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

### v3.16.0 — 2026-04-28

**One-command install**
- `npx aiden-os` — zero-install launcher; works on Windows, macOS, Linux (Node.js 18+)
- `aiden-os` npm package bootstraps `aiden-runtime` automatically, no git clone needed
- Setup wizard on first run with `--reconfigure` flag to re-run anytime

**Security**
- Shell blocklist — dangerous commands flagged before execution
- Permission mode — explicit user approval gate for destructive actions
- Token budget enforcement — per-request ceiling to prevent runaway loops

**Memory**
- Conflict resolution — contradictory memories detected and reconciled automatically
- `/memory` command — inspect, edit, and prune the memory store from the CLI

**UX**
- Aiden branded banner replaces DevOS; orange `#FF6B35` identity throughout CLI
- `--reconfigure` flag to re-run first-time setup without reinstalling

---

### v3.15.0 — 2026-04-28

**Browser & Automation**
- Centralised Playwright session (`core/playwrightBridge.ts`) — single persistent Chromium context shared across all browser tools, idle auto-close after 5 min, clean shutdown on SIGINT/SIGTERM
- `browser_get_url` — new tool to read the URL currently loaded in the browser
- All browser tools now in `ALLOWED_TOOLS` and `NO_RETRY_TOOLS`; `send_file_local` / `receive_file_local` added to planner allow-list

**Community & OSS**
- `CONTRIBUTING.md`, issue templates (bug, feature, skill submission), CLA workflow
- Public roadmap (`docs/ROADMAP.md`), architecture docs (`docs/ARCHITECTURE.md`), skill development guide
- GitHub labels automated + 5 good-first-issues pinned

**New skills**
- **LocalSend** — AirDrop-style LAN file transfer (`send_file_local` / `receive_file_local`); works over WiFi with no cloud
- **Security scanner** — opt-in Decepticon integration with safety guards for scanning your own servers

**Security**
- 9 npm audit vulnerabilities resolved (safe + vitest chain)
- Security headers + rate limiting on `aiden.taracod.com` landing worker (CSP, HSTS, X-Frame-Options)

---

### v3.14.0 — 2026-04-27

**Ecosystem & Interoperability**
- OpenAI-compatible API — `/v1/chat/completions` + `/v1/models`. Point Open WebUI, LibreChat, Cursor, or any OpenAI SDK at `localhost:4200` and get Aiden's full 89-tool agent (not just raw LLM inference)
- agentskills.io compatibility — skills now ship with `skill.json` manifest. Compatible with Hermes, OpenClaw, and any agentskills.io agent. 1,515 existing skills backfilled automatically
- Streaming tool output — shell commands, Python scripts, and browser extraction stream live progress lines as they execute. Set `AIDEN_SHOW_TOOL_OUTPUT=false` to suppress

---

### v3.13.0 — 2026-04-27

**Community & Intelligence**
- Public skill registry — `/install <skill>` pulls from [skills.taracod.com](https://skills.taracod.com); browse with `/skills registry <query>`; publish with `/publish <skill>`
- Deep GEPA — learns from failures, not just successes; `/failed` analyzes the exchange trace, writes a permanent lesson to `LESSONS.md`, degrades responsible skill confidence; skills failing 3× are auto-deprecated
- Honcho user modeling — structured cross-session profile (identity, projects, goals, preferences); only the relevant slice injected per query; view and edit with `/profile`
- Docker sandbox — opt-in sandboxed `shell_exec` and `run_python` execution; `AIDEN_SANDBOX_MODE=auto|strict|off`; containers run `--network=none --memory=512m --cpus=1 --read-only`
- GitHub CI/CD — TypeScript type-check + full build + secret scan on every PR to main
- CODEOWNERS — sensitive files auto-request maintainer review on every PR
- Sponsor button — Razorpay + GitHub Sponsors

---

### v3.12.0 — 2026-04-26

**Memory & Agents**
- Post-task skill writer (GEPA-lite) — writes a new skill after every multi-step success
- Session-end memory distillation — 5–15 durable facts extracted per session
- Progressive token budget — tool names only; schema loaded on demand
- Real parallel subagents — isolated context, LLM synthesis pass
- Streaming verbs — "Pondering…", "Hunting…" in real time
- Real scheduler — `remind me in N minutes` actually waits
- Path C-lite — YouTube/Google/DDG/Bing search + click first result
- Electron auto-updater
- Identity honesty — transparent about inference provider
- Capacity fallback — auto-switches provider on 503/rate-limit

---

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
