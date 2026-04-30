# CLAUDE_CHAT_BRIEFING — Aiden v3.19 Phase 2 SHIPPED
Generated: 2026-04-30. Updated: 2026-04-30 (Phase 2 complete).

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
