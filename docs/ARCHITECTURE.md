# Aiden Architecture

## Overview
Aiden is a local-first AI OS. TypeScript + Node.js + Electron.
The core is a planner-executor loop with 6-layer memory.

## Execution Flow
```
User input (CLI or OpenAI API)
  → api/server.ts (Express + SSE, port 4200)
    → fast-path matcher (<50ms, no LLM)
    OR
    → planWithLLM() — LLM generates JSON plan
      → executePlan() — runs steps sequentially
        → executeToolWithRetry() — calls tool handler
      → respondWithResults() — final LLM synthesis
  → SSE stream → CLI renders
```

## Key Files
| File | Purpose |
|------|---------|
| api/server.ts | Express server, SSE, session mgmt (~5500 lines) |
| core/agentLoop.ts | Planner + executor + ReAct loop (~3500 lines) |
| core/toolRegistry.ts | All 89+ tools (~2500 lines) |
| cli/aiden.ts | TUI + commands (~800 lines) |
| SOUL.md | Identity rules, loaded at boot |

## Memory Layers
1. Fast-path cache — sub-50ms
2. Session (sessionMemory.ts) — current session
3. Conversation (conversationMemory.ts) — cross-session
4. Semantic (semanticMemory.ts) — BM25/TF-IDF vectors
5. Skills (workspace/skills/) — learned + approved + installed
6. Permanent (LESSONS.md + user-profile.json)

## Provider Chain
providers/router.ts → tier-sorted chain → callLLM
Auto-failover on 429/503. /switch to change primary live.

## Adding a New Tool
1. Add handler to core/toolRegistry.ts
2. Add to TOOL_REGISTRY with name, description, inputSchema
3. Add to TOOL_DESCRIPTIONS (one-liner)
4. Add to TOOL_TIERS (tier 0-4)
5. Add to ALLOWED_TOOLS in agentLoop.ts
6. npm run build
See docs/TOOL-DEVELOPMENT.md for full guide.

## Adding a New Provider
1. Add to config/devos.config.json
2. Implement in providers/
3. Register in providers/router.ts
See docs/PROVIDER-DEVELOPMENT.md for full guide.
