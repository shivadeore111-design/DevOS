# Aiden Architecture

> Full layer-by-layer breakdown of the Aiden agent loop, memory system, skill system, and provider router.
> This document is a work in progress — contributions and corrections are welcome.

---

## High-level overview

Aiden is structured as an event-driven agent loop with six memory layers, a self-healing provider chain, and a composable skill/tool system.

```
Channel input (Discord / Slack / Telegram / Email / CLI / Desktop / Webhook)
        │
        ▼
  ChannelAdapter  →  normalised Message object
        │
        ▼
  Planner  (decompose into steps, select skills)
        │
        ▼
  AgentLoop  (core/agentLoop.ts)
    ├── ToolDispatcher  →  60+ built-in tools
    ├── SubagentManager  →  spawn / collect / merge parallel agents
    └── MemoryManager  →  read / write all 6 layers
        │
        ▼
  ProviderRouter  (providers/router.ts)
    ├── Ollama (local, priority 0)
    ├── OpenAI / Anthropic / Groq / Cerebras / NIM / OpenRouter / …
    └── Retry + keepalive + fast-path cache
        │
        ▼
  Responder  →  stream back to originating channel
```

---

## Memory layers

| Layer | Storage | Purpose |
|---|---|---|
| **Episodic** | In-context window | Recent turns; auto-trimmed by token budget |
| **BM25 keyword** | SQLite FTS5 | Fast exact-match retrieval across all past sessions |
| **Vector semantic** | SQLite + embeddings | Approximate nearest-neighbour for conceptual recall |
| **Procedural** | `skills/*/SKILL.md` | Skill prompts loaded on demand |
| **Goal** | JSON file | Persistent goals and sub-goals across sessions |
| **LESSONS.md** | Append-only markdown | Permanent failure moat; grows every session |

---

## Skill system

Each skill is a self-contained directory under `skills/`:

```
skills/
  stock-research/
    SKILL.md        ← system prompt fragment
    tools.ts        ← tool implementations (optional)
    sandbox.ts      ← isolated runner (optional)
    README.md
```

Skills are activated by the planner when the user's intent matches the skill's trigger phrases. Multiple skills can be active simultaneously. Skills are licensed Apache-2.0 regardless of the core license.

---

## Provider router

`providers/router.ts` tries each configured provider in priority order:

1. Check keepalive cache (< 30s old response from this provider → fast-path)
2. Attempt request with configured timeout
3. On failure: exponential backoff, then next provider in chain
4. Log latency + cost to session telemetry (local only)

The daily budget cap (`DAILY_BUDGET_USD`) is enforced per-provider and globally. Exceeding the cap routes to the next cheapest provider or returns a budget-exceeded error.

---

_Last updated: April 2026_
