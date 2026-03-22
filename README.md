# DevOS — Autonomous AI Operating System

> **Local. Private. Free.** An AI OS that thinks, builds, and ships software autonomously — running entirely on your machine with Ollama.

[![npm version](https://img.shields.io/npm/v/devos-ai.svg)](https://www.npmjs.com/package/devos-ai)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![Ollama](https://img.shields.io/badge/powered%20by-Ollama-orange)](https://ollama.ai)

---

## 1. What is DevOS?

DevOS is a self-hosted, autonomous AI operating system. You give it a goal in plain English — "Build a REST API with authentication," "Research top SaaS trends," "Monitor my competitors" — and DevOS breaks it into tasks, assigns specialized agents, executes them, and delivers working software or research reports.

It runs **100% locally** on your hardware using open-source LLMs through [Ollama](https://ollama.ai). No data leaves your machine. No API keys required. No subscription.

Two modes, one system:

- **Builder mode** — autonomous software development. Goals → missions → code shipped.
- **Personal mode** — always-on research pilots, daily dawn briefings, life canvas, task tracking.

---

## 2. The Pitch

Most AI tools are assistants — they wait for you to prompt them. DevOS is an operating system that **runs in the background**, monitors trends, builds features, and updates you. Think of it as a founding engineer that never sleeps.

- **Autonomous execution**: Multi-agent pipeline (Planner → Coder → Executor → Reviewer → Memory)
- **KV-cache optimized**: Static system prompt via `coreBoot.getSystemPrompt()` — identical bytes every call, Ollama reuses the prefill computation
- **Skill vault**: Auto-generates reusable TypeScript skills from completed goals
- **Always-on pilots**: Startup Scout, Market Monitor, AI Researcher, Competitor Tracker — running on cron
- **Echo mode**: Record workflows and replay them
- **Life Canvas**: Milestones, insights, reflections — your build journey, persisted

---

## 3. Quickstart

**Requirements:** Node.js 18+, [Ollama](https://ollama.ai) installed and running

```bash
# One-line install
npx devos-ai

# Or install globally
npm install -g devos-ai
devos serve
```

DevOS will:
1. Check your system (Node version, Ollama, models)
2. Initialize the workspace
3. Start the API server on port 4200
4. Open the dashboard at http://localhost:3000

**Pull recommended models first:**

```bash
ollama pull mistral-nemo:12b    # primary chat + planning model
ollama pull qwen2.5-coder:7b   # coding + code review model
```

---

## 4. Features

### Builder Mode
- **Goal Engine** — break any goal into a dependency graph of tasks
- **Multi-agent pipeline** — 5 specialized agents with role-colored live feed
- **Mission tracking** — projects with task pills, progress bars, real-time SSE updates
- **Skill auto-generation** — completed goals produce reusable `.ts` skill files
- **Knowledge base** — semantic memory with vector search across all outputs
- **QuickLaunch** — `Cmd+K` overlay to fire goals or check status instantly

### Personal Mode
- **Dawn Report** — good-morning briefing: overnight agent activity, task summary, one recommendation
- **Always-On Pilots** — startup-scout, market-monitor, ai-researcher, competitor-tracker run continuously
- **Life Canvas** — notes, milestones, insights, reflections tied to goals
- **Echo Mode** — record any workflow once, replay it on demand
- **Tasks** — personal task list with agent-assisted completion

### Infrastructure
- **SSE streaming** — real-time agent pulse events to the dashboard
- **KV-cache** — system prompt locked at boot, hit rate monitored by `devos doctor`
- **Docker sandbox** — optionally isolate skill execution in containers
- **Telegram / Slack / Discord** — notifications and approval gates
- **Multi-provider** — Ollama (default), OpenAI, Anthropic, Groq, DeepSeek

---

## 5. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard (Next.js)  ←── SSE ──  API Server (Express)      │
│  3-panel: Sidebar │ Chat │ LivePulse                         │
└────────────────────────────┬────────────────────────────────┘
                             │ REST + SSE
┌────────────────────────────▼────────────────────────────────┐
│                       DevOSMind                             │
│   intentEngine → voiceEngine → goalEngine → conversationLayer│
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                     Agent Pipeline                          │
│  Planner → Coder → Executor → Reviewer → MemoryWriter       │
│  (each agent calls Ollama via coreBoot.getSystemPrompt())   │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                       Ollama                                │
│  mistral-nemo:12b (chat/planning)                           │
│  qwen2.5-coder:7b  (code generation/review)                 │
└─────────────────────────────────────────────────────────────┘
```

**KV-cache guarantee**: `CoreBoot` reads `context/bootstrap/` once at startup and caches the result forever. Every agent call gets identical bytes as the system prompt → Ollama reuses the KV prefix computation across all calls.

---

## 6. CLI Reference

```bash
devos serve              # start API server
devos chat "..."         # one-shot chat with DevOS
devos goal "..."         # create and run a goal
devos mission "..."      # create a multi-goal mission
devos status             # show running goals and agents
devos agents             # list agents and their states
devos skills             # list registered skills

# Mode switching
devos personal           # switch to personal mode
devos builder            # switch to builder mode
devos dawn               # generate / show today's dawn report
devos dawn --force       # force-regenerate the dawn report

# Providers
devos provider status
devos provider set ollama
devos provider set openai  YOUR_KEY
devos provider set anthropic YOUR_KEY
devos provider set groq YOUR_KEY

# System
devos doctor             # full health check
devos models             # list available Ollama models
devos install            # first-time setup wizard
```

---

## 7. Docker

```bash
# Start DevOS + Ollama
docker compose up -d

# Start with dashboard UI
docker compose --profile full up -d

# View logs
docker compose logs -f devos

# Stop
docker compose down
```

**GPU acceleration** (NVIDIA): uncomment the `runtime: nvidia` block in `docker-compose.yml`.

**Default ports:**
- `4200` — DevOS API
- `11434` — Ollama
- `3000` — Dashboard (full profile only)

---

## 8. Hardware Requirements

| Tier | RAM | GPU VRAM | Models | Performance |
|------|-----|----------|--------|-------------|
| Minimum | 8 GB | None (CPU) | `qwen2.5:3b` | Slow but functional |
| Recommended | 16 GB | 6 GB VRAM | `mistral-nemo:12b` + `qwen2.5-coder:7b` | Good |
| Optimal | 32 GB | 12+ GB VRAM | Full stack + quantized 70B | Fast |

**Tested on:** Apple M2 (16 GB), RTX 3090 (24 GB), CPU-only (Ubuntu, 16 GB RAM)

DevOS automatically selects the best models for your hardware on first run via `devos models`.

---

## 9. Skills

Skills are reusable TypeScript functions that DevOS auto-generates from completed goals. They live in `skills/` and are loaded at startup.

```bash
devos skills              # list all skills
devos skills run <name>   # run a skill
```

**Always-on pilots** (Personal mode):

| Pilot | Schedule | What it does |
|-------|----------|-------------|
| `startup-scout` | daily 06:00 | Finds 5 new funded startups relevant to your interests |
| `market-monitor` | every 4h | Tracks market movements and trends in your sectors |
| `ai-researcher` | daily 08:00 | Summarizes AI papers and model releases from the past 24h |
| `competitor-tracker` | every 6h | Monitors product updates, pricing, and positioning changes |

Enable a pilot:
```bash
devos pilots enable startup-scout
devos pilots list
```

---

## 10. License

Apache 2.0 — see [LICENSE](./LICENSE).

```
Copyright (c) 2026 Shiva Deore
```

Built with [Ollama](https://ollama.ai) · [Mistral](https://mistral.ai) · [Qwen](https://huggingface.co/Qwen) · [Next.js](https://nextjs.org)
