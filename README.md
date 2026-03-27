# DevOS — Autonomous AI Execution System

> Copyright © 2026 Shiva Deore. All rights reserved.

DevOS is a personal AI operating system that runs on your Windows machine. It connects to any LLM provider and executes real tasks — web search, file I/O, code execution, computer control, and deep research — through a reliable three-step agent loop.

---

## What it can do

**Research & Data**
- Real-time web search and structured deep research (3-pass LLM-assisted)
- NSE/BSE stock data via `get_stocks` (gainers, losers, active)
- Automatic entity extraction and source ranking

**File & Code Execution**
- Write, read, and list files anywhere on your machine
- Execute Python and Node.js scripts on the fly
- PowerShell command execution with full stdout/stderr capture

**Computer Control**
- Mouse move, click (single + double), right-click
- Keyboard typing and key press (Enter, Tab, Ctrl+C, etc.)
- Full-screen screenshot via GDI+
- Vision loop: see → decide → act using Ollama llava or any vision-capable LLM

**Memory & Learning**
- Conversation memory with reference resolution ("that file", "the report")
- Semantic memory with 128-dim word-hash embeddings
- Entity graph tracking relationships between files, topics, and people
- Learning memory: records every task outcome to guide future planning
- Self-teaching: generates SKILL.md files from successful executions, promotes them after 3 successes

**Knowledge Base**
- Ingest text files (.txt, .md, .csv, etc.) and chunk them with local embeddings
- Cosine similarity search with decay scoring
- Prompt-injection sanitized — all ingested content is sandboxed

---

## Quick start

```bash
# Install dependencies
npm install

# Run TypeScript check
npx tsc --noEmit

# Start the API server (port 4200 by default)
npx ts-node api/server.ts

# Or build and run
npx tsc && node dist/api/server.js
```

Open the dashboard at `http://localhost:3000` (Next.js app in `dashboard-next/`).

The first run launches the onboarding wizard — choose a local Ollama model or add a cloud API key.

---

## Providers

DevOS supports multiple LLM providers simultaneously and rotates automatically on rate limits:

| Provider   | Free tier | Speed       | Best model                          |
|------------|-----------|-------------|-------------------------------------|
| Groq       | Yes       | ⚡ Blazing  | `llama-3.3-70b-versatile`           |
| Gemini     | Yes       | 🔥 Fast     | `gemini-1.5-flash`                  |
| OpenRouter | Credits   | 🔥 Fast     | `meta-llama/llama-3.3-70b-instruct` |
| Cerebras   | Yes       | ⚡ Blazing  | `llama3.1-8b`                       |
| NVIDIA NIM | Credits   | 💪 Powerful | `meta/llama-3.3-70b-instruct`       |
| Ollama     | Local     | Varies      | `qwen2.5:7b`, `phi4:mini`           |

Add API keys via `POST /api/providers/add` or through the Settings panel in the dashboard.

---

## Architecture

```
User message
    │
    ▼
┌─────────────┐
│  PLAN       │  planWithLLM() — LLM outputs structured JSON plan
│             │  Validates tool names against ALLOWED_TOOLS whitelist
│             │  Injects skill context + memory + knowledge base
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  EXECUTE    │  executePlan() — runs each tool step by step
│             │  Self-healing retry (2 attempts per step)
│             │  PREVIOUS_OUTPUT template resolution
│             │  Crash-recoverable: persists state to workspace/tasks/
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  RESPOND    │  respondWithResults() — streams natural language reply
│             │  Sees real tool outputs, not hallucinated summaries
│             │  Provider failover on 429 / timeout
└─────────────┘
```

**Core modules:**

| File | Purpose |
|------|---------|
| `core/agentLoop.ts` | Three-step loop: plan → execute → respond |
| `core/toolRegistry.ts` | All tool implementations |
| `core/computerControl.ts` | Mouse, keyboard, screenshot, vision loop |
| `core/skillLoader.ts` | Loads SKILL.md files and injects context |
| `core/skillTeacher.ts` | Self-learning: generates skills from task outcomes |
| `core/knowledgeBase.ts` | Local vector knowledge base |
| `core/taskState.ts` | Persistent step-level task state |
| `core/taskRecovery.ts` | Crash recovery on server restart |
| `core/conversationMemory.ts` | Per-session conversation tracking |
| `core/semanticMemory.ts` | Embedding-based semantic search |
| `core/entityGraph.ts` | Relationship graph between named entities |
| `core/learningMemory.ts` | Task outcome history for planning guidance |
| `api/server.ts` | Express REST API + WebSocket terminal |
| `coordination/livePulse.ts` | Real-time activity feed for the dashboard |

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/health` | Liveness check |
| `POST` | `/api/chat` | Send a message (SSE stream) |
| `GET`  | `/api/providers` | List configured API providers |
| `POST` | `/api/providers/add` | Add an API key |
| `POST` | `/api/providers/validate` | Test an API key |
| `GET`  | `/api/knowledge` | List knowledge base files |
| `POST` | `/api/knowledge/upload` | Ingest a file into the knowledge base |
| `DELETE` | `/api/knowledge/:id` | Remove a knowledge file |
| `GET`  | `/api/skills` | List all loaded skills |
| `GET`  | `/api/skills/learned` | List self-learned skills + stats |
| `GET`  | `/api/tasks` | List all tasks with status |
| `GET`  | `/api/tasks/:id` | Get single task detail |
| `POST` | `/api/tasks/:id/retry` | Retry a failed task |
| `GET`  | `/api/memory` | Conversation memory facts |
| `GET`  | `/api/memory/semantic` | Semantic memory search |
| `GET`  | `/api/memory/graph` | Entity relationship graph |
| `GET`  | `/api/doctor` | System health report |
| `POST` | `/api/automate` | Start a vision loop session |

---

## Self-teaching skills

After every successful task, DevOS generates a `SKILL.md` file capturing:
- The tool sequence that worked
- Key steps and tips
- Estimated duration

Skills accumulate in `workspace/skills/learned/`. After 3 successes, a skill is promoted to `workspace/skills/approved/` and injected into future planning prompts automatically.

---

## Crash recovery

Every task step is persisted to `workspace/tasks/<task_id>/state.json` as it runs. On server restart, DevOS automatically finds any tasks that were `running` at shutdown and resumes them from the last incomplete step. Tasks stuck for more than 1 hour are cleaned up automatically.

---

## License

Copyright © 2026 Shiva Deore. All rights reserved. Unauthorised copying, distribution, or use is prohibited.
