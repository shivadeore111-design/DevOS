# DevOS — Personal AI OS

> Free. Local. Private. Runs on your machine.

## Install

```bash
npx devos
```

Or install globally:

```bash
npm install -g devos
devos serve
```

**Requirements:** Node.js 18+ · Ollama with any model pulled · Windows, macOS, or Linux

## Providers

DevOS runs free with Ollama by default. Optionally use any cloud provider:

| Provider | Speed | Cost | Command |
|---|---|---|---|
| Ollama | Medium | Free | default |
| Groq | Very Fast | Free tier | `devos provider set groq YOUR_KEY` |
| DeepSeek | Fast | Very cheap | `devos provider set deepseek YOUR_KEY` |
| OpenAI | Fast | Pay per use | `devos provider set openai YOUR_KEY` |
| Anthropic | Best quality | Pay per use | `devos provider set anthropic YOUR_KEY` |
| Gemini | Fast | Free tier | `devos provider set gemini YOUR_KEY` |
| Together AI | Fast | Pay per use | `devos provider set together YOUR_KEY` |
| OpenRouter | Any model | Pay per use | `devos provider set openrouter YOUR_KEY` |

## What DevOS Does

DevOS turns goals into working software. You describe what you want. A team of AI agents — CEO, Engineer, Researcher, Operator — breaks it down, researches it, builds it, and deploys it. No prompting each step. No babysitting.

```
devos mission "Build a SaaS expense tracker with auth and Stripe"
```

DevOS will research competitors, plan the architecture, write the backend, build the frontend, run tests, and deploy — autonomously.

## Quick Start

Requirements: Node.js 18+, Ollama

```bash
# 1. Clone
git clone https://github.com/shivadeore111-design/DevOS.git
cd DevOS

# 2. Install
npx ts-node index.ts install

# 3. Pull models
ollama pull mistral-nemo:12b
ollama pull qwen2.5-coder:7b

# 4. Start
npx ts-node index.ts serve

# 5. Open dashboard
npx ts-node index.ts dashboard
# → http://localhost:3000
```

## Core Commands

```bash
# Goals
devos goal "Build a REST API" "Express with auth and CRUD"
devos goals

# Missions (multi-agent)
devos mission "Research top SaaS trends 2025"
devos missions

# Pilots (scheduled autonomous agents)
devos pilot list
devos pilot enable researcher
devos pilot run researcher

# Chat
devos chat
devos chat "what are you working on?"

# System
devos doctor
devos serve
devos dashboard
devos api
```

## Architecture

```
DevOS
│
├── Execution Core      Planner, executor, control kernel, workspace isolation
├── Goal Engine         Goal → Project → Task hierarchy with confidence scoring
├── Agent Layer         CEO, Engineer, Researcher, Operator, Designer, QA, Marketing
├── Coordination Loop   Mission orchestration, task bus, human-in-the-loop
├── Pilots System       Scheduled autonomous agents (Researcher, Coder, Monitor, Builder)
├── Personality Layer   Dialogue engine, intent classifier, conversation memory
├── Knowledge Engine    Ingestion, vector store, knowledge graph
├── REST API            30+ endpoints at http://127.0.0.1:4200
├── Mission Control UI  Next.js dashboard at http://localhost:3000
├── Telegram Bot        Chat with DevOS from anywhere
└── Docker Sandbox      Isolated skill execution
```

## Modes

**Builder mode** (default) — builds software autonomously

```bash
devos builder
```

**Personal mode** — research, tasks, monitoring, morning briefings

```bash
devos personal
devos briefing
```

## Security

DevOS runs locally by default (`127.0.0.1` only). API keys are SHA-256 hashed. Role-based permissions (admin, automation, read-only). Full audit log at `logs/audit.log`.

```bash
devos api keygen admin "my key"
```

## License

- **DevOS Core** — Apache 2.0 (free to use and self-host)
- **DevOS Pro** — Business Source License 1.1 (commercial license required)
- **DevOS Cloud** — Proprietary

Commercial licensing: devosxprojects@gmail.com

## Contributing

See `CONTRIBUTING.md`. Good first issues are labeled on GitHub.

---

Built by [Shiva Deore](mailto:devosxprojects@gmail.com)
