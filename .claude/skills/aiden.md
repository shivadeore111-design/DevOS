# Aiden Codebase Skill
# Used by Claude Code for architecture-aware edits

## File Ownership Map
Who owns what — go here first before grepping:

PLANNING:          core/agentLoop.ts (planWithLLM, fast-path)
TOOLS:             core/toolRegistry.ts (TOOL_REGISTRY, TOOL_DESCRIPTIONS)
SERVER:            api/server.ts (routes, SSE, session)
CLI:               cli/aiden.ts (TUI, commands)
MEMORY:            core/conversationMemory.ts, core/semanticMemory.ts
SKILLS:            core/skillWriter.ts, workspace/skills/
DISTILLATION:      core/memoryDistiller.ts
FAILURE LEARNING:  core/failureAnalyzer.ts, workspace/LESSONS.md
USER PROFILE:      core/userProfile.ts, workspace/user-profile.json
SCHEDULER:         core/scheduler.ts, workspace/scheduled.json
SUBAGENTS:         core/spawnManager.ts, core/swarmManager.ts
PROVIDERS:         providers/router.ts, config/devos.config.json
STREAMING:         core/statusVerbs.ts, api/server.ts (emitStatus)
SANDBOX:           core/sandboxRunner.ts
SKILL REGISTRY:    core/skillRegistry.ts, cloudflare-worker/skill-registry.js
IDENTITY:          SOUL.md (4 copies — see dangerous files)
ELECTRON:          electron/main.ts, package.json (build config)
LANDING:           cloudflare-worker/landing.js + wrangler-landing.toml
LICENSE:           cloudflare-worker/ + wrangler.toml (devos-license-server)

## Import Graph (simplified)
api/server.ts
  ├── core/agentLoop.ts
  │     ├── core/toolRegistry.ts
  │     ├── core/conversationMemory.ts
  │     ├── core/semanticMemory.ts
  │     ├── core/skillWriter.ts
  │     ├── core/memoryDistiller.ts
  │     ├── core/failureAnalyzer.ts
  │     ├── core/userProfile.ts
  │     ├── core/spawnManager.ts
  │     └── providers/router.ts
  ├── core/scheduler.ts
  └── core/statusVerbs.ts (via emitStatus)

## Planner Prompt Sections (in order)
1. SOUL.md identity rules
2. REMEMBERED CONTEXT (distilled facts from semanticMemory)
3. LESSONS LEARNED (last 10 from LESSONS.md)
4. USER PROFILE slice (from userProfile.ts)
5. SKILL DISCOVERY rule
6. TOOL DISCOVERY rule
7. TIER 0 tools (lookup_skill, lookup_tool_schema, web_search, notify)
8. TIER 1 tools (schedule_reminder, spawn_subagent, browser chain)
9. TIER 2 tools (swarm, complex orchestration)
10. SCHEDULER CRITICAL rule
11. BROWSER CHAIN CRITICAL rule
12. SUBAGENTS rule

## Token Budget (approximate per session)
- SOUL.md: ~400 tokens
- Tool names only: ~300 tokens (progressive loading)
- Conversation history (6 exchanges): ~800 tokens
- Distilled facts (top 5): ~200 tokens
- User profile slice: ~150 tokens
- Lessons (last 10): ~500 tokens
Total planner prompt: ~2,350 tokens (down from ~6,000 pre-v3.12)

## Known Line Numbers (approximate — verify with grep)
planWithLLM():          agentLoop.ts ~line 800
executePlan():          agentLoop.ts ~line 1200
executeToolWithRetry(): agentLoop.ts ~line 1600
respondWithResults():   agentLoop.ts ~line 2500
callLLM():              agentLoop.ts ~line 2670
TOOL_REGISTRY:          toolRegistry.ts ~line 1
TOOL_DESCRIPTIONS:      toolRegistry.ts ~line 2200
TOOL_TIERS:             toolRegistry.ts ~line 2380
emitStatus():           api/server.ts ~line 200
/api/chat handler:      api/server.ts ~line 900
SSE close hook:         api/server.ts ~line 1280

## Dangerous Files (read 20 lines of context before any edit)
- api/server.ts — one wrong edit breaks all SSE
- core/agentLoop.ts — planner prompt changes affect ALL behavior
- core/toolRegistry.ts — TOOL_TIERS order matters for planner
- SOUL.md — identity rules; 4 copies must stay in sync:
    SOUL.md
    workspace/SOUL.md
    workspace-templates/SOUL.md
    release/win-unpacked/resources/workspace-templates/SOUL.md
- cloudflare-worker/ — license server; don't break Pro users

## Common Bug Patterns (from LESSONS.md)
- Planner uses wait loops for reminders → use schedule_reminder tool
- browser_click fires before JS renders → waitForSelector visible state
- Fast-path eats "search news" → should use web_search not open_browser
- SOUL.md rule too broad → identity misapplied to provider questions
- Template literal backticks in planner prompt string → use single quotes
- Stale server PID after restart → verify port 4200 free before starting
- SOUL.md edits: always update all 4 copies, not just root file
- cloudflare-worker/landing.js ≠ devos-license-server → separate workers

## How to Start a Session Efficiently
Instead of:
  "look at my codebase and understand it"  ← wastes ~3000 tokens

Say:
  "In core/toolRegistry.ts around line 2059, add a new tool called X"
  "In the planner prompt in agentLoop.ts, add a rule after SCHEDULER CRITICAL"
  "Fix the emitStatus call in api/server.ts around line 200"

This skips all discovery and goes straight to the edit.

## Quick Dev Commands
```powershell
node dist-bundle/index.js          # start server (port 4200)
npx ts-node cli/aiden.ts           # start CLI / TUI
npm run build                       # TypeScript + esbuild
npm run dist                        # Electron installer (release/)
wrangler deploy --config wrangler-landing.toml
wrangler deploy --config wrangler-skill-registry.toml
```

## Version
Current: 3.13.0
Next planned: 3.14.0 (always-on daemon mode — core/serviceManager.ts)
