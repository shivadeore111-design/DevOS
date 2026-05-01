# CLAUDE_CHAT_BRIEFING — Aiden v3.19 Phase 5 SHIPPED
Generated: 2026-04-30. Updated: 2026-05-01 (Phase 5 complete — v3.19 DONE).

---

## SECTION 0 — v3.19 PHASE 1 GROUND TRUTH (final)

Phase 1 objective: make `TOOL_REGISTRY` (`core/toolRegistry.ts`) the single source of truth for all 13 hand-maintained tool-name lists.

### Registry counts (authoritative post-Phase-1)

| Name | Count | Notes |
|------|-------|-------|
| `TOOL_REGISTRY` | **77** | 71 user-facing + 6 intentionally excluded (`run`, `vision_analyze`, `clarify`, `todo`, `search`, `cronjob` — all `mcp:'excluded'`) |
| `TOOL_DESCRIPTIONS` | **71** | User-facing tools only; drives `/api/tools` endpoint and CLI banner |
| `SOUL.md` tool claim | **71** | "You have 71 built-in tools" — matches TOOL_DESCRIPTIONS |
| CLI banner count | **81** | 71 (TOOL_DESCRIPTIONS) + 10 slash mirrors (`status`, `analytics`, `spend`, `memory_show`, `lessons`, `skills_list`, `tools_list`, `whoami`, `channels_status`, `goals`) |
| `TOOLS` handler dict | **79** | 77 TOOL_REGISTRY + 2 legacy stubs (`_deep_research_legacy_unused`, `_web_search_legacy_unused`) |
| Slash mirror tools | **10** | Registered via `registerExternalTool` in `core/slashAsTool.ts`; external to TOOL_REGISTRY |

### What was derived (all 13 hand-maintained lists now auto-derived)

| Registry | Derived from | Commit |
|----------|-------------|--------|
| `ALLOWED_TOOLS` | `TOOL_REGISTRY` keys + `SLASH_MIRROR_TOOL_NAMES` | C4 |
| `VALID_TOOLS` | `TOOL_REGISTRY` keys + `SLASH_MIRROR_TOOL_NAMES` | C4 |
| `PARALLEL_SAFE` | `TOOL_REGISTRY[parallel='safe']` | C5 |
| `SEQUENTIAL_ONLY` | `TOOL_REGISTRY[parallel='sequential']` | C5 |
| `NO_RETRY_TOOLS` | `TOOL_REGISTRY[retry=false]` | C5 |
| CLI `TOOL_NAMES` | `TOOL_DESCRIPTIONS` keys (via `TOOL_NAMES_ONLY`) | C5 |
| MCP `SAFE_TOOLS` | `TOOL_REGISTRY[mcp='safe']` | C6 |
| MCP `DESTRUCTIVE_TOOLS` | `TOOL_REGISTRY[mcp='destructive']` | C6 |

### Validator throw-mode (active)

`core/registryValidator.ts` checks 8 invariants at startup. Any drift throws; `api/server.ts` catches and calls `process.exit(1)` — server aborts startup on violation. Zero violations on clean start.

### Phase 1 commits (in order)

```
cded9c6 fix(api): /api/tools returns TOOL_DESCRIPTIONS keys (71) not TOOLS handlers (79)
35e3478 fix: add ingest_youtube to TOOL_DESCRIPTIONS, update tool count 70 -> 71
59595fa fix(validator): process.exit(1) on registry violation — throw-mode was silently swallowed
25847fa feat(v3.19-p1-c7): validator throw mode + SOUL.md tool count/list update
e20c73a feat(v3.19-p1-c6): derive MCP SAFE_TOOLS + DESTRUCTIVE_TOOLS from TOOL_REGISTRY
4e75ae2 feat(v3.19-p1-c5): derive PARALLEL_SAFE, SEQUENTIAL_ONLY, NO_RETRY_TOOLS, CLI TOOL_NAMES
2a1dbbf feat(v3.19-p1-c4): derive ALLOWED_TOOLS + VALID_TOOLS from TOOL_REGISTRY
a016742 docs: update BRIEFING.md audit section with Commit 3 validator ground truth
423e7a9 add warn-only registry migration guard (registryValidator.ts)
7f87d06 feat(registry): add _generation counter and 12 deriver functions
```

---

## SECTION 1 — AUDIT SUMMARIES

### docs/agents-audit-v3.md (v3 audit)

- CLI dropdown (`cli/aiden.ts:5320-5383` `buildToolList()`) is a hardcoded 50-entry array literal, not derived from `core/toolRegistry.ts`. Adding a tool elsewhere does not surface it in the dropdown until the literal is hand-edited.
- Aiden has only 3 hook events (`core/hooks.ts:11-14`: `pre_compact`, `session_stop`, `after_tool_call`) vs Hermes' 11. No `matcher` field — `preTool` hooks fire for every tool and must self-filter.
- ~~`COMPACTION_PROTECTED` files (SOUL.md, STANDING_ORDERS.md, GOALS.md, USER.md, LESSONS.md) are re-read only at compaction (`core/agentLoop.ts:687-755`), every 40 messages. Identity changes have a ~40-message lag.~~ **Fixed Phase 2**: all 5 files injected per-turn via hash-cached `ProtectedContextManager`; SOUL.md uses Option-B reference line when hash unchanged (24× cheaper steady-state). See Section 5.
- No `workspace/plugins/` inhabitants — framework wired, no installed plugins, no examples.
- `buildDependencyGroups` (`core/agentLoop.ts:1935`) has no path-overlap detector; no `_DESTRUCTIVE_PATTERNS` equivalent. Parallel batches touching the same path can race.
- ~~Hermes re-reads SOUL.md every turn (`agent/prompt_builder.py:970-979`); Aiden does not.~~ **Fixed Phase 2**: Aiden now re-reads all 5 protected files per-turn (hash-cached); SOUL.md injected as reference line on stable-hash turns.
- Priority order for v3.19: (1) per-turn protected context refresh, (2) expand hook vocabulary + matchers, (3) derive CLI dropdown from `TOOL_NAMES_ONLY`, (4) plugin slash-command surface, (5) path-overlap guards.

### docs/audit-v3.18.0-full.md (v3.18 full audit)

- ~~Tool registry has 14 distinct enumerations that must agree; none validate against each other at startup. (`toolRegistry.ts:359` TOOLS=79, TOOL_DESCRIPTIONS=70, TOOL_TIERS=70, TOOL_CATEGORIES=85.)~~ **Phase 1 complete**: 9 of 14 registries now derived from TOOL_REGISTRY; validator throws on drift at startup. Current counts: TOOL_REGISTRY=77, TOOL_DESCRIPTIONS=71, TOOLS=79 (77+2 legacy stubs).
- ~~SOUL.md tells the model it has 48 tools (`SOUL.md:41`) — actual handler count is 79. Stale claim.~~ **Fixed Phase 1 C7**: SOUL.md now claims 71 tools (matches TOOL_DESCRIPTIONS).
- **19 tools planner cannot reach** via `ALLOWED_TOOLS` despite having wired handlers (per Commit 3 validator output — briefing was stale): `manage_goals`, `compact_context`, `run_agent`, `fetch_url`, `ingest_youtube`, `run_powershell`, `cmd`, `ps`, `wsl`, `run`, `get_natural_events`, `schedule_reminder`, `git_status`, `git_commit`, `git_push`, `get_calendar`, `read_email`, `send_email`, `search`. Additionally 10 entries in `ALLOWED_TOOLS` are slash-mirror tools (`status`, `analytics`, `spend`, `memory_show`, `lessons`, `skills_list`, `tools_list`, `whoami`, `channels_status`, `goals`) that do not belong there — they route through `slashAsTool.ts` injection path. (`agentLoop.ts` module-level post Commit 3 hoist)
- 5 of 7 remaining `INSTANT_ACTIONS` still fake success by swallowing errors and returning hardcoded strings: `screenshot`, `volume_up/down/mute`, `lock_screen`. (`api/server.ts:158-237`)
- Dashboard Memory panel is broken: `dashboard.ts:411` fetches `GET /api/memory` which has no handler in `server.ts`. Returns 404 silently.
- `fastReply` (used 25+ times) skips `conversationMemory.addAssistantMessage`, causing asymmetric memory writes. (`api/server.ts:686-700`)
- No pruning anywhere — `workspace/semantic.json` at 226 KB growing unbounded; `workspace/blocked-skills.log` at 1959 lines append-only since v3.17.
- Zero own unit tests. All 140 `*.test.ts` files are under `node_modules/`. Vitest declared in `package.json:60` but no `vitest.config*` found.
- `puppeteer` and `playwright` both installed; puppeteer unused. Bundle bloat candidate.
- Plugin `preTool` hooks have no timeout — can hang the agent loop forever. (`agentLoop.ts:1894-1902`)

### docs/research/manus/ (all .md files)

Not found — directory is empty.

---

## SECTION 2 — THE 14 REGISTRIES

| # | Name | File:line | Purpose | Derived from TOOL_REGISTRY? |
|---|------|-----------|---------|---------------------------|
| 1 | `TOOLS` (handler dict) | `core/toolRegistry.ts:359` | Maps tool name → executor function (79 entries = 77 registry + 2 legacy stubs) | Source of truth — hand-maintained |
| 2 | `TOOL_DESCRIPTIONS` | `core/toolRegistry.ts:2772` | Tool name → one-line description (**71 entries**) | Hand-maintained; TOOL_NAMES_ONLY derived from this |
| 3 | `TOOL_NAMES_ONLY` | `core/toolRegistry.ts:2848` | Name→description map for planner prompts | Derived from TOOL_DESCRIPTIONS (auto) |
| 4 | `TOOL_TIERS` | `core/toolRegistry.ts:2863` | Tool name → tier (1-3) for rate/priority | Hand-maintained (71 entries) |
| 5 | `TOOL_CATEGORIES` | `core/toolRegistry.ts:2973` | Tool name → category for context filtering | Hand-maintained (85 entries; some extras vs TOOL_DESCRIPTIONS) |
| 6 | `TOOL_TIMEOUTS` | `core/toolRegistry.ts:275` | Tool name → ms timeout | Hand-maintained (45 entries) |
| 7 | `ALLOWED_TOOLS` | `core/agentLoop.ts` | Planner prompt tool list | **Derived from TOOL_REGISTRY** ✅ (Phase 1 C4) |
| 8 | `VALID_TOOLS` | `core/agentLoop.ts` | Planner validation allowlist | **Derived from TOOL_REGISTRY** ✅ (Phase 1 C4) |
| 9 | `NO_RETRY_TOOLS` | `core/agentLoop.ts` | Tools that don't retry on failure | **Derived from TOOL_REGISTRY[retry=false]** ✅ (Phase 1 C5) |
| 10 | `PARALLEL_SAFE` | `core/agentLoop.ts` | Tools safe for parallel execution | **Derived from TOOL_REGISTRY[parallel='safe']** ✅ (Phase 1 C5) |
| 11 | `SEQUENTIAL_ONLY` | `core/agentLoop.ts` | Tools that must run sequentially | **Derived from TOOL_REGISTRY[parallel='sequential']** ✅ (Phase 1 C5) |
| 12 | MCP `SAFE_TOOLS` | `api/mcp.ts` | Tools exposed to MCP clients without opt-in | **Derived from TOOL_REGISTRY[mcp='safe']** ✅ (Phase 1 C6) |
| 13 | MCP `DESTRUCTIVE_TOOLS` | `api/mcp.ts` | Tools requiring `MCP_ALLOW_DESTRUCTIVE` | **Derived from TOOL_REGISTRY[mcp='destructive']** ✅ (Phase 1 C6) |
| 14 | `TOOL_NAMES` (CLI dropdown) | `cli/aiden.ts` | Dropdown suggestions for `@tool` trigger | **Derived from TOOL_DESCRIPTIONS keys** ✅ (Phase 1 C5) |

**Hand-maintained (drift risk):** #1, #2, #4, #5, #6 — 5 of 14. (#1 is intentional; #4/#5/#6 are Phase 2 candidates.)
**Derived (safe):** #3, #7, #8, #9, #10, #11, #12, #13, #14 — 9 of 14.

Phase 1 complete. Phase 2 targets: `TOOL_TIERS` (#4), `TOOL_CATEGORIES` (#5), `TOOL_TIMEOUTS` (#6).

---

## SECTION 3 — PROVIDER CHAIN ACTUAL STATE

Source: `providers/router.ts` (full, 583 lines) + `config/devos.config.json`.

| Order | Provider | Model | Status | Notes |
|-------|----------|-------|--------|-------|
| 1 | groq-1 (pinned primary) | llama-3.3-70b-versatile | live | `usageCount:63`; `env:GROQ_API_KEY`; pinned via `primaryProvider: "groq-2"` but groq-1 also active |
| 2 | groq-2 | llama-3.3-70b-versatile | live | `usageCount:79`; pinned primary in config |
| 3 | groq-3 | llama-3.3-70b-versatile | live | `usageCount:37` |
| 4 | groq-4 | llama-3.3-70b-versatile | live | `usageCount:11` |
| 5 | gemini-1 | gemini-2.5-flash | live | `usageCount:16`; `env:GEMINI_API_KEY`; router comment: "Gemini free tier hits 15 RPM aggressively" |
| 6 | gemini-2 | gemini-2.5-flash | live | `usageCount:9` |
| 7 | gemini-3 | gemini-2.5-flash | live | `usageCount:9` |
| 8 | gemini-4 | gemini-2.5-flash | live | `usageCount:9` |
| 9 | openrouter-1 | meta-llama/llama-3.3-70b-instruct:free | live | `usageCount:0`; free tier |
| 10 | openrouter-2 | meta-llama/llama-3.3-70b-instruct:free | live | `usageCount:0` |
| 11 | openrouter-3 | meta-llama/llama-3.3-70b-instruct:free | live | `usageCount:0` |
| 12 | together-1 | meta-llama/llama-3.1-405b-instruct | live | custom provider; `env:TOGETHER_API_KEY` |
| 13 | nvidia-1 | nvidia/llama-3.3-nemotron-super-49b-v1 | live (executor-only) | Excluded from planner/responder (`CHAT_EXCLUDED`); executor chain only |
| 14 | boa-1 | gemini-3-flash | deactivated | `enabled:false`; account suspended per memory |
| 15 | boa-2 | gpt-4o-mini | deactivated | `enabled:false`; account suspended |
| 16 | bayofassets-haiku | claude-haiku-4-5 | deactivated | `enabled:false`; custom provider; BOA suspended |
| 17 | bayofassets | gemini-3-flash | deactivated | `enabled:false`; custom provider |
| 18 | ollama | gemma4:e4b (responder/planner), llama3.2 (executor) | fallback-only | Always available; `fallbackToOllama:true`; `router.ts:389` |

**Executor chain (cerebras absent — no key):** groq → nvidia → ollama. (`router.ts:454-461`)

**Planner/responder chain:** groq-1-4 → gemini-1-4 → openrouter-1-3 → together-1 → ollama.

**Rate-limit windows** (`router.ts:24-41`): groq=15s, gemini=90s, openrouter=30s, ollama=0 (never). Exponential backoff with auto-unpin at 3 consecutive failures (`router.ts:239`).

### providers/ TODO/FIXME

No TODO/FIXME/XXX/HACK found in `providers/` TypeScript files.

---

## SECTION 4 — RECENT COMMIT CONTEXT (last 30 days)

Full list (newest first):
```
33585c6 docs: agent architecture audits — v3.19 planning foundation
f7d03ca docs: Hermes-style structured README — command reference, parity table, docs index
064f546 chore: bump version to 3.18.0
f92f48d fix: remove InstantAction fake responses for app actions, route to planner
984a65b feat: smart model selection — free tier defaults, per-model failover
4e66fd8 fix: redirect server console.log to stderr — stops [Router] logs bleeding into CLI response
0ec79f5 fix: planner prompt no longer allows respond-only for system actions
9426518 fix: prevent planner from faking system actions (app_launch + SOUL anti-confab rule)
f6b38da fix: system_volume detects intent from any natural param
93255a9 fix: app_close accepts app_name/appName/app/process/name/target
647ba55 fix: /tools shows all tools expanded by category
428ff2e fix: dropdown prefix-match filter + cursor position
887738d fix: dropdown render scope — use _activeRL module-level reference
102d98e fix: dropdown staircase rendering + ASCII fallback for Windows terminal
546d090 fix: app_close + system_volume accept natural param names
9addf0b feat: real PC control — system_volume, fixed app_close, taskkill allowlist
8c99643 feat(cli): Hermes-style live dropdown for / and @ triggers
c8b966c fix(fast-path): skip play/listen/watch intents — route to planner + Playwright auto-chain
4ad80df fix: auto-chain YouTube click + extend tab completer to tool names
d895b6b fix: T.warn → T.warning in CLI (property does not exist on Theme)
0093f35 fix(skills): remove over-broad injection patterns blocking 99% of installed skills
cf481bc fix: CommandGate hallucination + expand shell allowlist for app control
7acc5db fix: use [char]27 for ANSI escapes in uninstall.ps1 (PS5.1 compat)
6505128 fix: remove em-dashes from uninstall.ps1 (PS5.1 encoding compat)
7a4c2ba fix: uninstall.ps1 PS5.1 compat (?? operator, string interpolation)
4f913cb feat: add uninstall command (npm run uninstall / aiden uninstall / /uninstall)
1bbb19f feat: permission system v1 — YAML-configurable shell/fs/browser rules
4327796 refactor: unify plugin systems — single pluginLoader
ae502ea security: bind 127.0.0.1, fix CORS, requireLocalhost on destructive endpoints
a9cfa7c feat: deploy skill registry to skills.taracod.com
```

### 5 Most Significant Commits

**f92f48d** — fix: remove InstantAction fake responses for app actions, route to planner
- Files: `api/server.ts`
- Why: Removed 8 hardcoded fake app-launch entries that silently swallowed errors and returned "Opening X..." regardless of actual success. Planner now handles these correctly.

**984a65b** — feat: smart model selection — free tier defaults, per-model failover
- Files: `cli/aiden.ts`, `core/agentLoop.ts`, `core/modelRegistry.ts`, `providers/router.ts`
- Why: Added `core/modelRegistry.ts` with curated per-provider model lists and per-model failover before marking whole provider rate-limited. Prevents unnecessary provider blackouts.

**8c99643** — feat(cli): Hermes-style live dropdown for / and @ triggers
- Files: `cli/aiden.ts`
- Why: Introduced interactive dropdown for slash commands and `@tool` names. Hand-rolled on ANSI escapes — the list is still a hardcoded literal (drift risk documented in audit).

**1bbb19f** — feat: permission system v1 — YAML-configurable shell/fs/browser rules
- Files: `api/server.ts`, `cli/aiden.ts`, `cli/commandCatalog.ts`, `core/permissionSystem.ts`, `core/toolRegistry.ts`, `workspace-templates/permissions.yaml`
- Why: First YAML-driven permission layer covering shell/file/browser. Gap: mouse/keyboard/app/voice tools still ungated.

**4327796** — refactor: unify plugin systems — single pluginLoader
- Files: not detailed (refactor commit)
- Why: Consolidated dual plugin systems into single `core/pluginLoader.ts`. Prerequisite for the plugin ecosystem that `workspace/plugins/` is still empty of.

---

## SECTION 5 — KNOWN BROKEN / DEFERRED

### docs/v3.20-candidates.md

Not found.

### @deprecated in own code (non-vendor)

- `core/skillLoader.ts:130` — `@deprecated Use getSkillContent(skill.filePath) for full content. Kept for compat.` — backward compat shim; no stated removal target.

No `TODO(v3.`, `TODO(post`, or `FIXME.*later` patterns found in own TypeScript files.

### Known broken items (from audit)

- `dashboard.ts:411` — Memory panel fetches `GET /api/memory` which has no handler. Silent 404.
- `api/server.ts:158-237` — 5 InstantActions (`screenshot`, `volume_up`, `volume_down`, `mute`, `lock_screen`) try/catch-swallow and return hardcoded success strings regardless of actual result.
- `api/mcp.ts:32` — `take_screenshot` in `SAFE_TOOLS` has no handler in `TOOLS`; silently skipped at registration.
- ~~`cli/aiden.ts:5257` — `TOOL_NAMES` literal was 10 entries behind `TOOL_DESCRIPTIONS`.~~ **Fixed Phase 1 C5** — now derived from TOOL_DESCRIPTIONS.
- ~~`core/agentLoop.ts` — `ALLOWED_TOOLS` omitted 19 tools; contained 10 stray slash-mirror entries.~~ **Fixed Phase 1 C4** — derived from TOOL_REGISTRY.

---

## SECTION 6 — PH LAUNCH STATUS

No PH launch tracking docs found.

---

## SECTION 7 — CURRENT VERSION FACTS

### core/version.ts (full)
```typescript
// AUTO-GENERATED by scripts/inject-version.js — do not edit by hand
export const VERSION = '3.18.0'
```

### Package versions
- `package.json`: `"version": "3.18.0"`
- `packages/aiden-os/package.json`: `"version": "3.18.0"`

### Git tags (most recent 3)
```
v3.18.0
v3.17.0
v3.16.0
```

### SOUL.md
- Size: **13,553 bytes**
- First 5 lines:
```
# Aiden — Soul File
# This file defines who Aiden is. It is loaded at
# startup and prepended to every system prompt.
# It cannot be overridden by user messages.
```
- Note: ~~Line 41 claimed "You have 48 built-in tools"~~ — **updated Phase 1 C7** to "You have 71 built-in tools". TOOL_DESCRIPTIONS=71, TOOL_REGISTRY=77 (71 user-facing + 6 excluded).

---

## SECTION 8 — v3.19 PHASE 2 GROUND TRUTH (final)

Phase 2 objective: per-turn protected context refresh — the 5 protected files injected into every system prompt, not just at compaction.

**Status: SHIPPED** — 2026-04-30. Commits: C1–C5 (see below).

### What changed

| Before Phase 2 | After Phase 2 |
|----------------|---------------|
| Protected files re-read only at compaction (every ~40 messages) | Re-read every turn, hash-cached (disk read only on change) |
| Identity changes had ~40-message lag | Changes visible within 1 turn, no restart |
| SOUL.md (~3,860 tokens) re-injected at compaction only | SOUL.md: full on first turn or hash change; reference line (~20 tokens) on stable turns |
| No per-turn visibility into injection decisions | `[ProtectedCtx]` structured log line on every turn (stderr) |

### Token cost

| Scenario | Tokens injected | Notes |
|----------|----------------|-------|
| First turn / after any file edit | ~3,860 | SOUL full + all 4 context files |
| Steady-state (no file changes) | ~159 | SOUL reference line + USER/GOALS/SO/LESSONS |
| Savings (steady-state) | **24× cheaper** | Option-B hash-aware injection |

### Protected files (5)

| File | Location | Role |
|------|----------|------|
| `SOUL.md` | `workspace/SOUL.md` or `./SOUL.md` | Identity, personality, hard rules |
| `USER.md` | `workspace/USER.md` | User profile |
| `GOALS.md` | `workspace/GOALS.md` | Active goals |
| `STANDING_ORDERS.md` | `workspace/STANDING_ORDERS.md` | Persistent instructions |
| `LESSONS.md` | `workspace/LESSONS.md` | Learned lessons |

### Hash mechanism (Option B)

- `ProtectedContextManager` maintains per-file SHA-1 cache; composite hash = SHA-1 of 5 file hashes
- `getProtectedContext()` calls `isStale()` per file; re-reads only changed files from disk
- `buildProtectedContextBlock(ctx, previousHash?, sessionId?)`:
  - `previousHash === undefined` → first turn → SOUL full inject
  - `ctx.hash === previousHash` → hash match → SOUL reference line only
  - `ctx.hash !== previousHash` → any file changed → SOUL full inject
- Per-session hash tracked via `Map<sessionId, hash>` in both `server.ts` and `agentLoop.ts`
- `changedFiles[]` in `ProtectedContext` identifies which files triggered re-read (visible in `files=` log field)

### Per-turn log format (stderr, always-on)

```
[ProtectedCtx] sessionId={8-char} cacheHit={bool} soul={FULL|REF|EMPTY} tokens={n} hash={8-char} files={name,...|none}
```

Example from alive test:
```
[ProtectedCtx] sessionId=c5-goals cacheHit=false soul=FULL  tokens=3880 hash=d2458fc9 files=goals
[ProtectedCtx] sessionId=c5-so-te cacheHit=false soul=FULL  tokens=3923 hash=aa4a574b files=standingOrders
[ProtectedCtx] sessionId=c5-so-te cacheHit=true  soul=REF   tokens=222  hash=aa4a574b files=none
```

### getMetrics() (for future /api/health)

`protectedContextManager.getMetrics()` returns:
```typescript
{ totalReads: number, cacheHits: number, lastRefreshMs: number, currentHash: string }
```

### Alive test results (2026-04-30)

**GOALS.md test:**
- T1: "Tell me my current goals" → "I don't see any current goals" (GOALS.md empty)
- [External edit: added "Phase 2 alive test goal" to GOALS.md]
- T2: "What's my newest goal?" → "Your newest goal is to 'Ship Phase 2 of DevOS v3.19' and another goal is 'Phase 2 alive test goal'." ✅ PASS
- Log: `soul=FULL tokens=3880 hash=d2458fc9 files=goals` — hash flip detected, GOALS listed in `files=`

**STANDING_ORDERS.md test:**
- T1: "Tell me my current standing orders" → model sees GOALS content (STANDING_ORDERS.md still empty)
- [External edit: added "Phase 2 alive test standing order: confirm this is live"]
- T2: "What is my newest standing order?" → "Your newest standing order is to always respond in under 3 sentences for simple queries, and there's also a Phase 2 alive test standing order to confirm this is live." ✅ PASS
- Log: `soul=FULL tokens=3923 hash=aa4a574b files=standingOrders` — correct file identified

### Phase 2 commits

| Commit | Description |
|--------|-------------|
| C1 (pre-session) | `core/protectedContext.ts` — ProtectedContextManager with hash cache |
| C2 (pre-session) | `core/contextHandoff.ts` — buildProtectedContextBlock (initial) |
| C3 `80ac81b` | Wire into server.ts, agentLoop.ts, aidenPersonality.ts; Option-B hash tracking |
| C3 `41e878b` | Add C4-preview stderr log to contextHandoff (validated alive test) |
| C4 `2e12e8b` | Structured [ProtectedCtx] metrics + changedFiles[] + getMetrics() |
| C5 (this commit) | Formal alive test pass + briefing update |

---

## SECTION 9 — v3.19 PHASE 3 GROUND TRUTH (final)

Phase 3 objective: honesty enforcement — eliminate all fake InstantAction responses and surface real errors with structured diagnostics.

**Status: SHIPPED** — 2026-04-30. Commits: C2–C5 (see below).

### What changed

| Before Phase 3 | After Phase 3 |
|----------------|---------------|
| 5 InstantActions returned hardcoded success strings regardless of outcome | All 5 route to real tool handlers; real path/error returned |
| Short action intents (< 20 chars) silently bypassed the planner via fast-path | `isActionIntent()` checked first in `matchFastPath()` — action intents always go to planner |
| PlannerGuard never fired — `matchFastPath` bypassed `planWithLLM` entirely | PlannerGuard now fires for all action intents; retries with concrete tool-call prompt |
| Provider/tool failures returned `"Unknown error"` or generic "I'm temporarily unavailable" | `buildDiagnostic()` surfaces tool name, provider, retry count, and actionable suggestion |
| `!parsed` early-return in `planWithLLM` bypassed all guards | Converted to fallback plan that flows through PlannerGuard |

### New files

| File | Role |
|------|------|
| `core/actionVerbDetector.ts` | 21-verb regex; exports `isActionIntent()` + `detectActionVerb()` |
| `core/fastPathExpansion.ts` (modified) | `isActionIntent()` guard added as first check in `matchFastPath()` |
| `core/diagnosticError.ts` | `DiagnosticInfo` type + `buildDiagnostic()` pure function |

### Hidden bug found + fixed

`matchFastPath("open notepad")` returned `true` (11 chars < 20, no exec keywords in the short-message guard) — silently bypassed the planner for ALL action intents under 20 chars. Root cause of `[PlannerGuard]` never appearing in logs despite being wired. Fixed by adding `isActionIntent(trimmed)` as the very first check.

### Diagnostic format (buildDiagnostic)

```
Couldn't {tool}: {error}
Provider: {provider}, retries: {retries}
[Fell back to {name} → {outcome}]
[Suggestion: {suggestion}]
```

Wired into 3 callsites:
1. `agentLoop.ts` `!parsed` fallback — all LLM attempts fail
2. `agentLoop.ts` PlannerGuard `!guardMatch` — retry returns no JSON (providers exhausted)
3. `api/server.ts` router exhaustion — both cloud and ollama fail in `streamChat`

### Phase 3 formal test results (2026-04-30)

**Test A — Screenshot (InstantAction real path):**
```
curl POST /api/chat {"message":"screenshot"}
→ {"message":"Screenshot saved: C:\\Users\\shiva\\DevOS\\workspace\\screenshots\\screenshot_1777562617070.png (307kb)"}
```
✅ PASS — real file path, real size, no hardcoded string.

**Test B — App not found (action intent + planner failure):**
```
curl POST /api/chat {"message":"open NonExistentApp"}
→ {"message":"Couldn't planner: Could not generate tool plan for action intent\nProvider: unknown, retries: 1\nSuggestion: Provider chain may be rate-limited. Try again in 1–2 minutes or use a more specific instruction.","provider":"groq-5"}
```
✅ PASS — PlannerGuard fired, retry failed → buildDiagnostic surfaced. No fake success.

```
curl POST /api/chat {"message":"launch NonExistentApp123"}
→ {"message":"Couldn't planner: All LLM attempts failed\nProvider: unknown, retries: 3\n...","toolsUsed":["app_launch","respond"]}
```
✅ PASS — app_launch tool DID execute; post-execution summarization LLM exhausted → buildDiagnostic. No fake success.

**Test C1 — Provider chain failure (cloud disabled, ollama active):**
```
curl POST /api/chat {"message":"what is the latest tech news today"}
→ {"message":"Couldn't planner: All LLM attempts failed\nProvider: unknown, retries: 3\nSuggestion: Provider chain may be rate-limited. Try again in 1–2 minutes or rephrase your request.","provider":"ollama"}
```
✅ PASS — ollama returned invalid JSON for planner → `!parsed` fallback → buildDiagnostic. Honest.

**Test C2 — Full exhaustion (cloud disabled + ollama stopped):**
```
→ {"message":"Couldn't planner: All LLM attempts failed\nProvider: unknown, retries: 3\nSuggestion: ..."}
```
✅ PASS — same structured diagnostic, no fake success, no crash.

### Phase 3 commits

| Commit | Description |
|--------|-------------|
| C1 (audit) | `docs/phase3-instantaction-audit.md` — identified 5 fake InstantActions |
| C2 `f92f48d` | Remove 5 fake InstantActions, route to real handlers, surface errors |
| C3 `0fef546` | `core/actionVerbDetector.ts` + fastPath fix + PlannerGuard `!parsed` fix |
| C4 `0278bbb` | `core/diagnosticError.ts` + buildDiagnostic wired to 3 callsites |
| C5 `2d970bc` | Phase 3 formal tests + briefing update |

---

## SECTION 7 — v3.19 PHASE 4: STALE STATE FIX (SHIPPED 2026-05-01)

### Objective

Aiden was injecting volatile system state (open windows + RAM + disk usage + hardware info) into every new session's system prompt at startup. By message 2 that snapshot was stale, but the model would still answer questions about RAM and disk from cached context rather than re-querying.

Phase 4 fixes this via the Manus lazy-eval principle: **volatile state belongs behind a tool call, not in the session-start context**.

### What changed

| Before Phase 4 | After Phase 4 |
|----------------|---------------|
| `firstMessageContext` block ran 3 tool calls at session start: `system_info`, `Get-Process`, `Get-PSDrive` | Block deleted entirely — zero startup tool calls |
| First response latency: +200–600 ms (3 parallel shell calls before responding) | First response: immediate — no blocking pre-flight |
| "What windows are open?" answered from session-start snapshot | Must call `shell_exec` or `system_info` per-turn to get live state |
| No `now_playing` tool existed | `now_playing` registered — queries Windows SMTC live per call |
| SOUL.md had no lazy-state rule | SOUL.md instructs: call tool every time for music/RAM/disk/windows |
| `detectToolCategories()` missed music-status queries | Added patterns: `now.?playing`, `what.*playing`, `what.*song`, `what.*music`, `is.*playing`, `music.*paused`, `current.*track` → `system` category |

### Root-cause bug found during C4 testing

After rebuilding the bundle with Phase 3+4 changes, `now_playing` was registered and the startup block was removed — but test queries like "What music am I playing right now?" returned `"I'll check what's playing. Done."` without actual song data.

Investigation: `detectToolCategories("What music am I playing right now?")` returned only `['core']`. The `system` category pattern did not match "music" or "playing". Since `now_playing` is category `['system']`, it was absent from `plannerTools`, so the planner never saw it as an option and the responder improvised.

Fix: added music-query patterns to the `system` category branch in `detectToolCategories` (`core/toolRegistry.ts:3783`).

### New tool: `now_playing`

| Field | Value |
|-------|-------|
| File | `core/tools/nowPlaying.ts` |
| Registry key | `now_playing` |
| Category | `['system']`, tier 1 |
| Method | PowerShell WinRT via `GlobalSystemMediaTransportControlsSessionManager` |
| Bridge | `System.WindowsRuntimeSystemExtensions.AsTask` (PS5.1 can't await WinRT natively) |
| Returns | `{ isPlaying, app, title, artist, album, playbackStatus, message? }` |
| Timeout | 5000 ms |
| App normalization | Spotify, Edge, Chrome, Firefox, VLC, Groove, Windows Media Player |

### Deleted from `api/server.ts streamChat()`

```typescript
// DELETED (Phase 4 C3):
const isFirstMessage = history.length === 0
let firstMessageContext = ''
if (isFirstMessage) {
  try {
    const [sysResult, ...] = await Promise.all([
      executeTool('system_info', {}),           // hardware
      executeTool('shell_exec', { command: 'Get-Process | ...' }),  // open windows
      executeTool('shell_exec', { command: 'Get-PSDrive C | ...' }) // disk
    ])
    firstMessageContext = `\n\nSYSTEM CONTEXT...`
  } catch { }
}
// Also removed: ${firstMessageContext} from template literal
```

### SOUL.md lazy-state rule (added Phase 4 C3)

```
For current system state — what music is playing, which windows are open, current RAM/disk
usage — call the appropriate tool every time. Never answer from session context or prior
observations. State changes between messages:
- "what's playing" / "what song is this" / "is music paused" → `now_playing`
- "how much RAM" / "disk space" / "what's running" → `system_info` or `shell_exec`
```

### Supporting files

| File | Change |
|------|--------|
| `scripts/sync-soul.ps1` | Fixed parse error (Unicode em dash → `--`; single-quoted strings); removed stale 4th target `packages/aiden-os/templates/SOUL.md` (never existed); hard `exit 1` instead of skippable warning |
| `docs/phase4-state-audit.md` | Full audit of all 12 injection sites in `streamChat()` — 4 REMOVE, 8 KEEP |
| `docs/v3.20-candidates.md` | `browser_tabs` deferred (3 reasons) + `system_state` tool deferred |
| `SOUL.md` + `workspace/SOUL.md` + `workspace-templates/SOUL.md` | Tool count 71→72; `now_playing` added to System & Data section; lazy-state rule added |

### Phase 4 test results (2026-05-01)

**Test: Trim verification (no volatile startup calls):**
Server log on fresh startup shows zero `[system_info]`, `[Get-Process]`, or `[Get-PSDrive]` calls before first user message.
✅ PASS

**Test: now_playing alive-test:**
✅ PASS (2026-05-01, session `phase4-alive14`)
Response: `"All My Love" by Elderbrook, album "Why Do We Shake In The Cold?" — Spotify, isPlaying: true`
Full end-to-end confirmed: instant dispatch → tool executed → real song data → LLM formatted response.

**Architectural debt note:**
The music query path uses a **regex-based instant dispatch** in `agentLoop.ts` that bypasses the LLM planner entirely. This was necessary because `llama-3.3-70b-versatile` (Groq) ignored explicit prompt rules and selected `run_powershell` for media queries across 5 prompt iterations. The dispatch is tagged `TODO(v3.20): TEMPORARY`. The proper fix (few-shot examples, per-tool `instant_dispatch_pattern` registry metadata, or model switch to gemini-2.5-flash) is documented in `docs/v3.20-candidates.md`.

Additionally: `now_playing` was missing from `NO_INPUT_TOOLS` in the executor, causing the `{}` input to be treated as an error and the step skipped. Fixed in `4391add`.

### Phase 4 commits

| Commit | Description |
|--------|-------------|
| C1 `docs` | `docs/phase4-state-audit.md` — volatile vs stable injection site audit |
| C2 `cb31388` | `core/tools/nowPlaying.ts` + `now_playing` in TOOL_REGISTRY (71→72 tools) |
| C3 `38c6f07` | Delete `firstMessageContext` startup block; update SOUL.md ×3; fix sync-soul.ps1; `docs/v3.20-candidates.md` |
| C4 `9254ab7` | Fix Ollama fallback model: `cfg.model.activeModel` → `cfg.ollama.model` |
| C4 `1848270` | `fastPathExpansion.ts`: add music/media to PLANNER_REQUIRED_PATTERNS |
| C4 `68fac14` | Planner prompt: tier-0 + media rule for `now_playing` |
| C4 `6493977` | Planner prompt: rule-0 live-state override |
| C4 `e20faa2` | Instant dispatch for now_playing (correct plan schema) |
| C4 `b5d851f` | `docs/v3.20-candidates.md`: planner debt + TODO(v3.20) comment |
| C4 `4391add` | Fix: add `now_playing` to `NO_INPUT_TOOLS` — executor was skipping `{}` input |

---

## SECTION 5 — v3.19 PHASE 5: Registry-backed slash completer

**Status: SHIPPED** — 2026-05-01. Commits: C1–C4 (see below).

### Objective

Make `commandCatalog` (`cli/commandCatalog.ts`) the single source of truth for all
slash commands — catalog schema, runtime registry, Tab-dropdown, and plugin contribution
path. Mirrors what Phase 1 did for `TOOL_REGISTRY`.

### What shipped

| Item | Detail |
|------|--------|
| Single-source command catalog | `COMMAND_DETAIL` (91 entries) is the canonical definition; all consumers derive from it |
| 6 previously-invisible commands | `/plugins`, `/profile`, `/failed`, `/install`, `/publish`, `/sandbox` — were missing from catalog, now added |
| Runtime registry API | `register()`, `unregister()`, `list()`, `get()`, `generation()` — live Map backed by COMMAND_DETAIL at startup |
| Generation-cached dropdown | `buildSlashCommands()` re-builds only when `generation()` changes; O(1) on every keystroke |
| 19 core handler pre-registrations | `registerCoreCommands(rl)` in `aiden.ts` registers 19 handlers as catalog closures (preview for v3.20 full extraction) |
| Plugin contribution path | `ctx.commandCatalog` injected into every plugin's `init(ctx)` via `PluginServices` parameter on `loadPlugins()` |
| Example plugin | `workspace/plugins/hello.js` + `workspace/plugins/_examples/hello/` — registers `/hello`, includes README |

### What was deferred to v3.20

| Item | Reason |
|------|--------|
| Full 72-handler extraction from `handleCommand()` if-chain | Scope/risk — complex multi-hundred-line handlers (/run, /voice, /provider). Dedicated v3.20 commit. |
| Unified dispatch (replace if-chain with catalog lookup) | Depends on full extraction. |
| `buildSlashCommands()` CLI-side generation cache (CLI path) | Already done server-side; CLI Tab completer also updated (C3). |

### Architecture

```
commandCatalog.ts  ←── source of truth (COMMAND_DETAIL + _registry Map)
      │
      ├── register/unregister/list/get/generation   ← runtime API
      │
      ├── getCatalog()           ← used by /help, palette
      ├── buildSlashCommands()   ← generation-cached, drives Tab dropdown
      │
      └── pluginLoader.ts (PluginServices.commandCatalog)
                │
                └── plugin init(ctx) → ctx.commandCatalog.register('/name', {...})
```

### Plugin contribution path (v3.19+)

Plugins in `workspace/plugins/*.js` receive `ctx.commandCatalog` in `init(ctx)`.
Any `ctx.commandCatalog.register()` call bumps `_generation`, which the dropdown
cache detects on the next keystroke — no restart needed when hot-reload is used.

```js
exports.init = async function(ctx) {
  ctx.commandCatalog.register('/mycommand', {
    desc: 'Does something', section: 'tools', origin: 'plugin',
    handler: async (args) => { /* ... */ },
  })
  return () => ctx.commandCatalog.unregister('/mycommand')  // dispose
}
```

### Smoke test results (C4 verification)

```
[Plugin:hello] /hello registered
gen after load:    1
/hello present:    YES — Hello from example plugin!
total commands:    92  (91 catalog + 1 plugin)
[Plugin:hello] /hello unregistered
gen after dispose: 2
/hello after dispose: GONE
```

### Phase 5 commits

| Commit | Description |
|--------|-------------|
| C1 `a260463` | `docs/phase5-command-audit.md` — full dispatch-site audit, 85 commands mapped |
| C2 `947fc72` | `commandCatalog.ts` rewrite: CmdDetail+handler/origin/parallel, registry API, 6 missing entries, 19 handler preview |
| C3 `1d7f05b` | `buildSlashCommands()` → `commandCatalog.list()` + generation cache (`_slashGen`, `_slashCache`) |
| C4 `(this)` | `pluginLoader.ts` PluginServices injection, `server.ts` wiring, `hello.js` example plugin, BRIEFING update |
