# ▲IDEN

**Your personal AI. Runs on your machine. Remembers everything.**

[![Release](https://img.shields.io/github/v/release/taracodlabs/aiden-releases?label=download&color=FF6B35)](https://github.com/taracodlabs/aiden-releases/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)](https://github.com/taracodlabs/aiden-releases/releases/latest)
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey)](LICENSE)

---

## What is Aiden?

Aiden is a local-first AI operating system that runs entirely on your machine via [Ollama](https://ollama.com) — no cloud required, no data leaving your hardware. It ships as a signed Windows installer with auto-updates, a full terminal UI, and a web dashboard.

It is built to be the only AI you need. Aiden remembers everything across sessions, learns permanently from its own mistakes via a LESSONS.md moat, and can delegate work to subagents, run code in a sandboxed SDK, control your screen, send emails, search the web, and more — all from one CLI.

At v3.6.0 Aiden reaches full feature parity with the best commercial agents on the market, while remaining completely private, local, and free to self-host.

---

## Features at a Glance

- **▲ run** — Execute JS directly in a sandbox with the full Aiden SDK injected (`aiden.web`, `aiden.file`, `aiden.shell`, `aiden.browser`, `aiden.screen`, `aiden.memory` and more)
- **▲ spawn / swarm** — Delegate sub-tasks to isolated subagents; run N agents in parallel with vote/merge/best aggregation
- **▲ search** — Hybrid BM25 + semantic search across all sessions and memory
- **Voice layer** — STT (Groq → OpenAI → local Whisper.cpp) + TTS (Edge TTS → ElevenLabs → Windows SAPI); `/voice on` to enable
- **Channel adapters** — Discord, Slack, and Webhook integrations out of the box
- **Self-healing provider chain** — Exponential backoff, keepalive, and fast-path routing across Anthropic, OpenAI, Groq, Ollama, and custom OpenAI-compatible endpoints
- **LESSONS.md moat** — Permanent failure rules auto-appended and injected every session so Aiden never makes the same mistake twice
- **60+ CLI commands** — Complete TUI with fuzzy tab-completion, `/help <command>` detail cards, live status bar, and themes

---

## Installation

### PowerShell one-liner (recommended)

```powershell
iwr https://aiden.taracod.com/install.ps1 -useb | iex
```

Opens a new terminal and type `aiden` to start. Auto-updates are built in — install once, stay current.

### Direct download

**[→ Download Aiden v3.6.0 for Windows](https://github.com/taracodlabs/aiden-releases/releases/tag/v3.6.0)**

Run `Aiden-Setup-3.6.0.exe` and follow the installer. After install, `aiden` is available in any terminal.

### winget *(coming soon)*

```powershell
winget install Taracod.Aiden
```

Submission to the Windows Package Manager Community Repository is in progress.
See [`packaging/winget/`](packaging/winget/) for manifest files.

### Scoop *(coming soon)*

```powershell
scoop bucket add taracod https://github.com/taracodlabs/scoop-bucket
scoop install aiden
```

See [`packaging/scoop/`](packaging/scoop/) for manifest and bucket setup instructions.

---

Requirements: Windows 10/11 (64-bit).

---

## Quick Start

After first launch, Aiden opens a terminal UI. A few commands to get oriented:

```
/help              See all commands
/tools             Browse built-in tools (grouped by category)
/skills            Browse available skills (install from registry)
/providers         Check your provider chain + API key status
/voice on          Enable voice mode — TTS reads every AI reply aloud
/run examples      Browse runnable SDK examples
```

Set your API keys in the `.env` file in the Aiden data directory (shown on first launch), or configure from the dashboard at `http://localhost:4200`.

---

## Running Aiden

### Desktop app (primary — recommended)

Double-click **Aiden** in your Start menu, or run:

```cmd
aiden pc
```

The Electron desktop app starts the API server automatically and loads the full UI.

### Terminal / TUI interface

The TUI requires the API server to be running first. Start both from the project directory:

```cmd
npm run serve          # start API server on port 4200
npm run cli            # start the TUI (in a second terminal)
```

Or from the packaged install, use the dev shortcut to start the API, then:

```cmd
npx ts-node cli/aiden.ts
```

> **Note:** `aiden tui` is not available as a one-command shortcut in v3.7. Run `npm run serve` + `npm run cli` instead. A single-command TUI launcher is planned for v3.8.

---

## Documentation

- **Landing page & docs:** [aiden.taracod.com](https://aiden.taracod.com)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)
- **Releases:** [taracodlabs/aiden-releases](https://github.com/taracodlabs/aiden-releases)

---

## Links

- [aiden.taracod.com](https://aiden.taracod.com)
- [Ship It Newsletter](https://shipit.taracod.com)

---

## License

Proprietary and confidential. See [LICENSE](LICENSE) for full terms.

---

Built by [Taracod](https://taracod.com) · Made in India
