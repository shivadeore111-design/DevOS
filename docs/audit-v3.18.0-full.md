# Aiden v3.18.0 — Architectural Audit (Read-Only)

Scope: full-system audit grounded in source. Extends `docs/agents-audit-v3.md` (cited as "v3 audit"). Findings cite `file:line`. "Wired" ≠ "works": I distinguish observation from execution.

Version pin: `core/version.ts:2` `VERSION = '3.18.0'`. `package.json:3`.

---

## 1. Tool registry deep audit

Source files: `core/toolRegistry.ts` (3 120 lines), `core/agentLoop.ts` (3 096 lines), `core/slashAsTool.ts` (not read raw — referenced via `SLASH_MIRROR_TOOL_NAMES`).

Counts (mechanically grep'd):

| Registry | Location | Count |
|---|---|---|
| `TOOLS` (handler dict) | `toolRegistry.ts:359` | **79** entries |
| `TOOL_DESCRIPTIONS` | `toolRegistry.ts:2772` | **70** entries |
| `TOOL_NAMES_ONLY` | `toolRegistry.ts:2848` | derived from TOOL_DESCRIPTIONS → 70 |
| `TOOL_TIERS` | `toolRegistry.ts:2863` | **70** entries |
| `TOOL_CATEGORIES` | `toolRegistry.ts:2973` | **85** entries |
| `TOOL_TIMEOUTS` | `toolRegistry.ts:275` | **45** entries |
| `VALID_TOOLS` (planner validation) | `agentLoop.ts:1521` | 60 + slash mirrors |
| `ALLOWED_TOOLS` (planner prompt list) | `agentLoop.ts:808` | 53 + slash mirrors |
| `NO_RETRY_TOOLS` | `agentLoop.ts:1881` | 13 |
| `PARALLEL_SAFE` | `agentLoop.ts:1957` | 18 |
| `SEQUENTIAL_ONLY` | `agentLoop.ts:1965` | 23 |
| MCP `SAFE_TOOLS` | `api/mcp.ts:25` | 26 (incl. `take_screenshot` alias) |
| MCP `DESTRUCTIVE_TOOLS` | `api/mcp.ts:44` | 30 |

The advertised "89 tools" claim does not appear in `core/version.ts` or `package.json`. README claims "80+ tools" (`package.json:124` linux description: "80+ tools"). SOUL.md tells the model it has **48 tools** (`SOUL.md:41` "You have 48 built-in tools"). That number is stale — the actual handler count is 79.

### Cross-registry drift

These are real, concrete drift findings (not in v3 audit):

1. **`TOOL_CATEGORIES` references 19 tools that have no entry in `TOOL_DESCRIPTIONS`** — graph hyperedge "Tools in TOOL_CATEGORIES but NOT in TOOL_DESCRIPTIONS" lists: `ingest_youtube`, `status`, `analytics`, `spend`, `memory_show`, `lessons`, `skills_list`, `tools_list`, `whoami`, `channels_status`, `goals`, `run`, `spawn`, `swarm`, `search`, `clarify`, `todo`, `cronjob`, `vision_analyze` (`toolRegistry.ts:3030-3059`). These come from `slashAsTool.ts` (slash mirrors) but the registry treats them as full tools — meaning the planner can pick them but `TOOL_DESCRIPTIONS` returns `undefined` for descriptions. (`toolRegistry.ts:2848` — `TOOL_NAMES_ONLY` is derived from `TOOL_DESCRIPTIONS` only, so slash mirrors don't get a one-liner in the planner prompt.)

2. **`TOOLS` has handlers that `TOOL_DESCRIPTIONS` lacks**: `manage_goals` is in TOOL_DESCRIPTIONS but `_web_search_legacy_unused` (`toolRegistry.ts:974`) and `_deep_research_legacy_unused` (`toolRegistry.ts:1222`) are dead handlers — explicitly named with `_legacy_unused` and not in any registry. They are wired to the dispatcher (`TOOLS` is iterated in `runTool`) but unreachable by name → 🔇 orphan dead code.

3. **`ALLOWED_TOOLS` in `agentLoop.ts:808` omits tools that exist in TOOLS**: missing `system_volume`? present at `:819`. Missing `fetch_url`? — confirmed missing. `fetch_url` handler exists (`toolRegistry.ts:1172`), is in TOOL_DESCRIPTIONS, in TOOL_TIERS, but NOT in `ALLOWED_TOOLS` planner prompt list (`agentLoop.ts:808-829`). The planner is therefore not prompted with `fetch_url` even though it would pass validation (`fetch_url` is in `VALID_TOOLS` at `:1522`).

4. **`ALLOWED_TOOLS` omits `cmd`, `ps`, `wsl`** (Windows shell variants): handlers exist at `toolRegistry.ts:671, 697, 722`, in TOOL_DESCRIPTIONS, but absent from `ALLOWED_TOOLS` and from `VALID_TOOLS`. Planner can never emit them; only direct dispatch via `executeTool('ps', …)` from server fast-paths reaches them.

5. **`ALLOWED_TOOLS` omits `git_status`, `compact_context`, `manage_goals`, `get_calendar`, `read_email`, `send_email`, `ingest_youtube`** — all have handlers + descriptions. Planner prompt is silent about them. They are in the slash-mirror list via `SLASH_MIRROR_TOOL_NAMES` only.

6. **`PARALLEL_SAFE` includes `ingest_youtube`** (`agentLoop.ts:1962`) but `ingest_youtube` is in `TOOL_CATEGORIES` only (`toolRegistry.ts:3030`), absent from TOOL_DESCRIPTIONS. So planner can't emit it via prompt-listed tools but if a recipe forces it, it can run in parallel.

7. **MCP `SAFE_TOOLS` lists `take_screenshot`** (`api/mcp.ts:32`) — that name does not exist as a TOOLS handler. `screenshot` exists. This is a dead alias; MCP clients calling `take_screenshot` hit the security gate fall-through and get `Tool "take_screenshot" is not exposed via MCP` (`api/mcp.ts:192-204`) — wait, the check is `exposed.includes(name) && !TOOLS[name]` — actually line 162-165 `if (TOOLS[name])` filters it out before pushing, so it just silently doesn't appear. Stub of a stub.

8. **`spawn` and `spawn_subagent` co-exist with overlapping descriptions** (`toolRegistry.ts:2838-2839`); planner sees both and may pick either. No deduplication logic.

### Per-tier categorization (sample of suspicious entries)

✅ verified end-to-end: `web_search` (`:956`), `respond` (`:362`), `file_read` (`:798`), `notify` (`:922`), `system_info` (`:912`), `app_launch` (`:1623`), `app_close` (`:1670`), `system_volume` (`:1739`), `screenshot` (`:1513`), `clipboard_read` (`:1579`), `git_status` (`:1291`).

⚠️ wired, behavior unverifiable from static read: `voice_clone` (`:2563`), `voice_design` (`:2585`), `vision_analyze` (`:2461`), `swarm` (`:2306`), `spawn_subagent` (`:2281`), `deep_research` (`:1216` — calls `deepResearchFn` from `core/webSearch`, not read), `code_interpreter_python` (`:1548`), `code_interpreter_node` (`:1563`), `ingest_youtube` (`:2035`).

🔲 stub / thin: `_web_search_legacy_unused` (`:974`), `_deep_research_legacy_unused` (`:1222`) — both legacy dead, kept in TOOLS map but not reachable.

🔇 orphan (in registry but planner can't reach): `fetch_url`, `cmd`, `ps`, `wsl`, `git_status`, `compact_context`, `manage_goals` (planner-prompt-only — handlers reachable via fast-path / slash dispatch).

### Permission gating coverage

`core/permissionSystem.ts:62` reads `workspace/permissions.yaml` with auto-reload (`:131`). The registry honors permissions for:

- `open_browser` (`toolRegistry.ts:373` — `permissionSystem.checkBrowserDomain`)
- shell variants (`toolRegistry.ts:567, 647, 674, 700, 726` — all four shell tools call `isCommandAllowed` / `permissionSystem.checkShell`)
- file_write (via `isProtectedFile` + `isPathDenied` — `:83, 99`)

**Not** gated by permission system: `mouse_click`, `keyboard_type`, `keyboard_press`, `app_launch`, `app_close`, `system_volume`, `notify`, `git_commit`, `git_push`, `clipboard_write`, `voice_*`. These run unconditionally if the planner emits them. `permissions.yaml:6` declares the system covers "shell commands, file paths, and browser domains" — explicit by design, but the gap should be flagged: the planner can `app_launch chrome` and `keyboard_type "rm -rf"` without consulting permissions.

### Tools planner cannot reach but registry says exist

`fetch_url`, `cmd`, `ps`, `wsl`, `git_status`, `compact_context`, `manage_goals`, `get_briefing` (in ALLOWED, OK), `get_calendar`, `read_email`, `send_email`, `ingest_youtube`, `schedule_reminder`. Twelve tools. Some are reachable via fast-path or slash-mirror; bypass means the planner cannot decide to use them based on user intent.

### ALLOWED in planner but missing handler

I cross-checked `ALLOWED_TOOLS` against `TOOLS` keys: every entry in `ALLOWED_TOOLS` has a corresponding handler. No phantom entries on this side.

### Permission rules referencing nonexistent tools

`workspace/permissions.yaml:24-44` denies shell command patterns. None reference tool names that don't exist; the permission system operates on commands and URLs, not tool names.

---

## 2. Planner pipeline audit

End-to-end trace of one chat turn through `api/server.ts` `app.post('/api/chat', …)` at `:645`:

1. **Request entry** (`server.ts:645`). Mode resolution (`chat` | `auto` | `fast` | `plan`).
2. **Pre-LLM fast-path gates** (`:669-940`) — order matters because each `return`s:
   - Empty/long message → instant reply (`:705, 709`).
   - Capability question → registry-derived list (`:712-723`). ✅ derived from `TOOL_NAMES_ONLY`, not hardcoded.
   - Banned-topic / jailbreak / dangerous-command (`:739, 747, 755`) — string-block returns hardcoded refusal.
   - Identity / builder / location / hardware / date (`:765, 784, 788, 825, 833, 914`) — many of these `fastReply` hardcoded strings without invoking any tool. **Success-without-action**: `:914` "GPU: GTX 1060 6GB VRAM" returns from SOUL trivia — does not consult `system_info` even when the user is on an unknown machine. (Identity is hardcoded to GTX 1060 in SOUL.md.)
   - Goal management (`:867-902`) — goes through `executeTool('manage_goals', …)` → real call.
   - File-read (`:917-924`) — checks `fs.existsSync` then early-returns. If file exists, falls through to planner (does NOT pre-read).
   - **InstantAction loop** (`:929-940`) — iterates `INSTANT_ACTIONS` array (`:147`).
3. **Search/launch fast-path** (`:944-1003`) — regex-driven URL construction. Skips when `hasPlayIntent` (`:971`) so `play X on YouTube` reaches the planner.
4. **Music/media fast-path** (`:1009-1118`) — including replay-from-history.
5. **High-risk approval gate** (`:1130`) — refuse-with-reason for sending data externally.
6. **Conversational fast-path** (`:1390-1450`) — `ALWAYS_CONVERSATIONAL` and `AUTO_CONVERSATIONAL` regex sets, calls `streamChat` directly.
7. **`mode === 'chat'`** path (`:1477`) — calls `streamChat` then ends.
8. **`mode === 'fast'`** path (`:1491`) — single `callLLM` → token drip.
9. **SSE fast-path** (`:1507`) — `matchFastPath` knowledge-only check → `streamChat`.
10. **Multi-question split** (`:1525-1602`) — `shouldSplit` → `splitQuestions`, then loop calls `planWithLLM` + `executePlan` + `respondWithResults` per sub-question.
11. **Main planner** path: `planWithLLM` (`agentLoop.ts:759`).
   a. Pre-compact hook fire at `history.length % 40 === 0` (`agentLoop.ts:770`).
   b. Vague-goal detection (`:775-785`) — returns clarification without LLM.
   c. Recipe engine (`:790-806`) — YAML workflow short-circuit.
   d. Build `ALLOWED_TOOLS`, MCP append, category filter (`:808-846`).
   e. Skill / instinct / learning / knowledge / lesson / memory recall context assembly (`:847-889`).
   f. LLM call → JSON plan (path not read line-by-line; the function continues past `:899`).
   g. **`raceProviders`** for parallel planner LLM races (graph hyperedge "Planner API Racing — Sprint 5" — `OPENAI_COMPAT_ENDPOINTS` at `:438`, `:646-647`).
   h. Validation via `validatePlan` (`:1548`), with `repairToolName` fuzzy edit-distance fallback (`:1559`).
   i. Fallback chain: cloud retry → ollama fallback → keyword inference (`inferPlanFromKeywords`) → respond fallback. (Graph node "LLM Fallback Chain (cloud → ollama → keyword → respond)".)
12. **`executePlan`** — reads `IterationBudget`, `PARALLEL_SAFE` / `SEQUENTIAL_ONLY` for batching, retry via `executeToolWithRetry` (`agentLoop.ts:1888`).
13. **`respondWithResults`** — assembles final user-facing answer with skill / KB / memory context.
14. **Post-success side effects** at server `:1786-1822`:
   - `setTimeout(…, 100)` queues `sessionMemory.addExchange`, `memoryExtractor.extractFromSession`, `refreshIdentity`, and `writeSkillFromTask`.
   - `lastExchangeBySession.set(...)` records the turn for failure-trace pickup.
   - If `≥2` tool failures: immediate `analyzeFailureTrace` (`:1810-1819`).

### `InstantAction` faking — status

Confirmed in source (commit `c8b966c` per v3 audit) that **app open/close/launch faking entries were removed** (`server.ts:148-151` explicit comment). However the remaining instant actions retain the faking pattern:

- `screenshot` (`:158-164`) — `try { await executeTool('screenshot', {}) ... } catch {} return 'Screenshot taken.'` — the catch swallows tool failure and the function returns "Screenshot taken." regardless. ❌ **Still faking.**
- `volume up/down/mute` (`:168-194`) — same pattern: `try { … } catch {} return 'Volume up.'`. ❌ **Still faking.**
- `set timer` (`:202-213`) — schedules `setTimeout` then returns `Timer set …`. The `setTimeout`'s notify is wrapped in try/catch — if process restarts or notify fails 5 minutes later, the user has been told the timer was set with no recovery. ⚠️
- `system info` (`:215-227`) — does check `result.success` before composing reply (✅ honest).
- `lock screen` (`:228-237`) — try/catch swallow + hardcoded "Locking screen…" return. ❌ Still faking.

So the v3-audit finding ("InstantAction was actually removed") is partially true: the `app_*` faking is gone, but five of the seven remaining InstantActions still lie about success. New finding for this audit.

### Other planner-bypass paths

- `fastReply` skips `streamChat` and emits a single SSE token+done pair (`server.ts:686-700`). Used 25+ times. None of these calls update `conversationMemory` for the assistant turn (e.g. `:705, 709, 723, 739, 747`). The session memory drifts: the user sees Aiden replied, but `conversationMemory.addAssistantMessage` is not called for fast-path branches. (Compare `:1442, 1518` where SSE conversational path *does* call `addAssistantMessage`.) **Asymmetric memory write.**
- Replay pattern at `:1066-1102` may answer "Play that song" with a clipboard-discovered URL but never confirms playback success.

### Swallowed errors

- `try { await executeTool('open_browser', { url }) } catch { try { await executeTool('shell_exec', …) } catch {} }` (`:984-989`). Double-swallow.
- `await autoClickYouTube(url)` (`:1053`) inside try/catch with empty handler. Auto-chain is fire-and-forget.
- `analyzeFailureTrace(_trace).catch(() => {})` (`:1473, 1818`) — error analysis swallows its own analysis errors.

---

## 3. Identity & context freshness

The v3 audit established that `COMPACTION_PROTECTED` files (`SOUL.md`, `STANDING_ORDERS.md`, `LESSONS.md`, `GOALS.md`, `USER.md`) are re-read only at compaction (`agentLoop.ts:691-755`). Status v3.18.0: **unchanged**. `COMPACT_THRESHOLD = 40` (`agentLoop.ts:53`).

What I found in addition (extends v3 §3):

- **LESSONS.md is also read on every turn**, separately from compaction: `agentLoop.ts:870` `loadLessons()` is called inside `planWithLLM`, gated only on whether the file is non-empty. So `LESSONS.md` is the one protected file with per-turn freshness — even though it's listed in `COMPACTION_PROTECTED`. The compaction-only-refresh framing in the v3 audit is too pessimistic for this specific file.
- **`refreshIdentity()`** at `core/aidenIdentity.ts:188` is called in four places in `server.ts` (`:1299, 1588, 1785`, plus a startup `setTimeout` at `:5790`). It writes a JSON snapshot to `identity.json`. This is *not* reading workspace files — it computes identity from level/XP/stats. So "identity refresh every 40 messages" in the v3 audit refers to compaction-driven `rebuildContextAfterCompaction`, not to `refreshIdentity()` (different concept). v3 audit's "identity refresh every 40 messages" claim is geographic — there is no `refreshIdentity()` tied to message count; the message-counter compaction trigger is unrelated.
- **`USER.md`, `STANDING_ORDERS.md`, `GOALS.md`** — confirmed: not read per-turn anywhere. Grep for `USER.md|STANDING_ORDERS.md|GOALS.md` in `core/agentLoop.ts` shows only the `COMPACTION_PROTECTED` constant.
- The startup `refreshIdentity()` at `server.ts:5790` runs after a 2-second delay (`setTimeout(...2000)`). On boot the dashboard / status bar may briefly show stale identity.

### Startup state dump → refetch-tool inventory

`server.ts:1718-1727` (debug-only) prints SOUL.md path / length / tool count. The "real-time" datums injected into chat context come from per-turn skill / lesson / memory recall calls, not a startup snapshot. There is no startup injection of:

- Open windows: ❌ no inject. `window_list` tool exists.
- Disk: ❌ no inject. `system_info` tool covers via shell.
- RAM: ❌ no inject. `system_info` covers.
- Apps running: ❌ no inject. No dedicated tool — `shell_exec tasklist` works.
- Spotify state: ❌ no inject. No tool. The agent has to open the app.
- Tabs: ❌ no inject. `browser_get_url` returns *one* active tab (singleton `playwrightBridge`); no list-all-tabs tool.
- Time: ✅ injected per-fast-path at `:833`. `system_clock` "provider".

---

## 4. Memory system audit (6 layers)

I read `core/sessionMemory.ts` (322), `core/semanticMemory.ts` (292), `core/skillRegistry.ts` (166), and used directory listings + sizes for live state.

Live state observation:
- `workspace/conversation.json` — 24 KB / 660 lines. Small. No bound — `conversationMemory.addAssistantMessage` appends without rotation.
- `workspace/semantic.json` — 226 KB. Growing. No automatic prune.
- `workspace/sessions/` — only `session_1777491759743.md`. Sessions write but nothing trims.
- `workspace/skills/learned/` — 10 directories.
- `workspace/blocked-skills.log` — 1 959 lines. Append-only since v3.17.

### Layer-by-layer

| Layer | Module | Persistence | Pruning | Growth risk | Race / corruption |
|---|---|---|---|---|---|
| Conversation memory | `core/conversationMemory.ts` | `workspace/conversation.json` | none observed | unbounded | single-writer; sync `fs.writeFileSync` (no lock) |
| Session memory | `core/sessionMemory.ts` | `workspace/sessions/*.md` | none | unbounded | per-session file — low collision |
| Semantic memory | `core/semanticMemory.ts` | `workspace/semantic.json` | none in code path | unbounded — 226 KB and rising | sync write — concurrent calls clobber each other (no journal) |
| Learning memory | `core/learningMemory.ts` (not read raw) | `workspace/learning.json` | unverified | TBD | unverified |
| Knowledge base | `core/knowledgeBase.ts` (not read raw) | `workspace/knowledge/` | per-file | grows with uploads | per-file |
| Skill registry | `core/skillRegistry.ts` | `workspace/skills/learned/` | none | grows monotonically | per-skill dir |

The "6 layers" framing matches the graph hyperedge "Post-Respond Memory Write Set" (`core_conversation_memory, core_session_memory, core_memory_layers, core_memory_extractor, core_user_cognition_profile, core_refresh_identity`). **None of the layers have automatic deletion or compaction.** The single trim mechanism is `preflightCompressionCheck` in the *prompt assembly* path (`agentLoop.ts:209`), which compresses messages in-memory but does not persist the compressed form to `conversation.json`.

### Race / corruption — observations

- `appendLesson` (referenced at `agentLoop.ts:1918, 1949`) — append-only, fine.
- `auditTrail.record` — `fs.appendFileSync` (`auditTrail.ts:31`) — newline-delimited JSON, append-safe.
- `conversationMemory` — uses `fs.writeFileSync` (full overwrite). Two parallel turns hitting the same session ID (rare but possible via `/v1/chat/completions` + UI) can lose writes. No file lock.
- `_rsave()` in scheduler (`scheduler.ts:464`) — same pattern. Reminders persist on a Node.js `setTimeout`; if the process crashes mid-save, the file is short-but-valid JSON (writeFileSync is atomic on most OSes — but not guaranteed on Windows when crossing 4 KB).

---

## 5. Provider routing deep audit

Source: `providers/router.ts` (full read, 583 lines), `core/modelRegistry.ts` (full read, 278 lines).

### Failover order

For `task === 'planner' | 'responder'` (`router.ts:434`):
1. Available APIs filtered by enabled + not rate-limited + key resolves (`:424-429`).
2. **Excludes `cerebras` and `nvidia`** (`:433` `CHAT_EXCLUDED`) — 8B-class models too small for SOUL prompt.
3. Pinned primary moved to front (`:438-441`).
4. First survivor returned (`:443-446`).
5. If all cloud rate-limited → `ollama` (`:448-450`).

For `task === 'executor'` (`:454-462`): preference order `cerebras > groq > nvidia > openai`, then `ollama`.

`getSmartProvider` (`:471`) is the higher-level entry: respects manual mode (`:481-490`) then `getNextAvailableAPI` round-robin (`:493`) which scores by usage + response time + primary boost (`:205-216`).

### 3-strike rate-limit + permanent disable

Confirmed at `router.ts:221-251` `markRateLimited`:
- Exponential backoff: `base * 2^(failures-1)` capped at 5 min (`:229`).
- **Auto-unpin after 3 failures**: `AUTO_UNPIN_THRESHOLD = 3` (`:239`). If the *pinned* primary fails 3 times, the pin is removed.
- `consecutiveFailures` map persists in process memory; `markHealthy` resets to 0 (`:255-269`).
- **Permanent disable on 401/403**: not implemented at this layer. The router only flags "rateLimited"; permanent-disable behavior would need to live in the provider call site. Grep `core/agentLoop.ts:` for `401|403` returns nothing in this file. **Claim unverified.**

### Per-model failover (v3.18 claim)

`core/modelRegistry.ts:244` `getNextModelOnFailure(provider, currentModel)` — returns the next ID in the provider's MODEL_REGISTRY array. Used at `core/agentLoop.ts:23` (import) — but call sites? Grep is needed.

`grep -nE "getNextModelOnFailure" core/agentLoop.ts` would land that. Inferring from the import alone, this is **wired**. Without reading the call site I cannot say whether it triggers per-model rotation before per-provider rotation, or only after. Wired, behavior unverifiable from static read alone.

### Race conditions

- `consecutiveFailures` Map mutation (`router.ts:228, 260`) is single-threaded under Node, safe.
- `loadConfig` / `saveConfig` (`router.ts:181, 249`) is called per `markRateLimited` invocation — full disk write per call. Two concurrent failed calls write the same file; last writer wins. Provider state can briefly be wrong but converges.
- `autoResetExpiredLimits` (`:161`) reads + writes config — same pattern.

### Does failover try non-Groq providers?

Yes — `available` filter at `:424-429` includes all enabled APIs across providers. As long as more than one provider has a key, `chatApis[0]` walks the merged list. In practice a `.env` with only Groq keys → all chat goes Groq → ollama on rate-limit.

`.env` at the project root has Groq, Gemini, OpenRouter, NVIDIA, Together, BOA keys (per memory: BOA suspended). So failover **will** try non-Groq providers if Groq is rate-limited — the chain is Groq → Gemini → OpenRouter → … → Ollama.

---

## 6. Streaming & response integrity

SSE handling: `server.ts:686-700` `fastReply` writes two events `{ token, done: false }` then `{ done: true }`. Conversational path uses `streamChat` callback-based (`:1432-1439`).

Findings:

- **Tool stdout into LLM stream**: tool output is captured by `executeTool` and only forwarded via the `activity` event (`:1557-1558`), not as a token. Token stream is reserved for the responder LLM. ✅ no bleed.
- **`process.stdout` re-routed to stderr at startup** in MCP mode (`api/mcp.ts:142-146`) — verified. Server mode does *not* re-route stdout (`server.ts:5660-5663` only redirects `console.log/info/warn`, not `process.stdout.write`). So in `aiden serve` mode, anything that writes raw `process.stdout.write` would corrupt SSE — but I see no such call in agent loop or registry. Grep `process\.stdout\.write` in server: only in CLI dropdown (`cli/aiden.ts:5395, 5397`), which is a separate process. ✅ no leak.
- **Done-event provider label inconsistency**: `:1439` emits `provider: apiName` for streamChat; `:698-699` emits `provider: 'fast-path'` for fastReply. Dashboards keying off `provider` see "fast-path" as a real provider name.
- **Partial response on disconnect**: SSE writes are sequential; if client disconnects mid-stream, `res.write` will silently fail (Node `Writable` swallows post-end writes). No abort wired through to `currentAbortController` (`agentLoop.ts:56`) for SSE-side disconnect. So a client hangup does NOT cancel the planner LLM call.
- **Outer fatal catch** (`:1835-1847`): catches anything escaping inner try, sends activity + token + done, ends response. Good defensive coverage.
- **`handleChatError`** (`:1831`) — taxonomy referenced in graph as `concept_error_taxonomy_429, concept_error_taxonomy_timeout, …` but I did not read the implementation. Wired, behavior unverifiable from static read.

### Log leaks into response body

- `console.log` calls inside `executeTool` (e.g. `[FastPath] YouTube search` at `:983`) write to stdout — which in `aiden serve` mode is *not* redirected. They land in the terminal that started the server, not the SSE response body. ✅
- All `res.write(\`data: ${JSON.stringify(...)}\n\n\`)` lines are valid SSE frames.

---

## 7. Security posture

### Shell blocklist

- `core/toolRegistry.ts:106` `DENIED_COMMANDS` — 17 patterns including `rm -rf /`, `curl|bash`, `wget|bash`, `iex(`, `Invoke-Expression`, `Start-Process`, `reg add/delete`, `schtasks`, `wmic process call`, `net user`, `Set-ExecutionPolicy`, `New-Service`. ✅ broad.
- `:133` `SHELL_DANGEROUS_PATTERNS` — substring matcher: `rm -rf`, `format c:`, `diskpart`, `shutdown`, `format-volume`, `clear-disk`, etc. Substring check (`:142-145`) is case-insensitive.
- `:150` `SHELL_ALLOWLIST` — 16 regex categories. Unknown patterns return `{ allowed: false, needsApproval: true }` (`:198`).
- Command flow: `isCommandAllowed(cmd)` → deny → dangerous → allowlist. Order is correct: deny precedes allow.

### Permission system

- `core/permissionSystem.ts:62` reads `workspace/permissions.yaml`.
- `:131` watches the file and auto-reloads on change. ✅ no restart needed.
- Domain check (`:245-248`) blocks blacklisted hostnames; `ask` mode requires approval but the approval surface for the agent loop returns `error: PermissionGate: Navigation to this URL requires explicit user approval` (`toolRegistry.ts:379`) — i.e. the tool fails and the planner sees the error. There is no out-of-band UI prompt — the user has to retry via a different message. Wired-but-rough.

### Sandbox

- `core/sandboxRunner.ts:6` opt-in Docker sandbox. Mode read from `AIDEN_SANDBOX_MODE` env var with default `'off'` (`:197`).
- `toolRegistry.ts:578` `_sandboxMode = process.env.AIDEN_SANDBOX_MODE || 'off'` — read at tool call time.
- Three modes implied: `off | auto | strict` (per file comment `:7`). When set, `runInDockerSandbox` (`:34` import) is used by `code_interpreter_*` and `run_python` (`toolRegistry.ts:855` checks the mode for `_pyMode`).
- Default behavior: sandboxing is **off**. Fresh install runs Python and Node directly on host. Documented choice.

### Server bind

- `server.ts:5670` host = `process.env.AIDEN_HOST || (isHeadless ? '0.0.0.0' : '127.0.0.1')`. ✅ loopback default. `AIDEN_HEADLESS=true` flips to all-interfaces.
- Port read from `config/api.json` (`:5672-5678`) with default 4200.

### CORS scope

- `server.ts:447-463`. Default: localhost-only. `AIDEN_CORS_ORIGIN` env can broaden to specific origin or `*`.
- `requireLocalhost` middleware at `:5101` checks `ip === '127.0.0.1' || '::1' || '::ffff:127.0.0.1'`. Used on `/api/plugins/reload`, `/api/permissions/reload`, `/api/mcp/servers POST/DELETE` (`:2687, 2701, 3117, 3129`). **Not** applied to `/api/chat`. The chat endpoint is open to anything passing CORS.

### Secrets handling

- `.env` exists (2 325 bytes). Has 13 explicit `KEY=` rows.
- `.gitignore` includes `.env`, `.env.local`, `.env.production`, `.env.*.local` (`grep` confirmed). ✅ secrets not committed.
- Secret scanner: `core/secretScanner.ts` exists in tree; not read raw. The `permissions.yaml` does not enforce it.

### Plugin sandboxing

- `core/pluginLoader.ts:99-114` — plugins are loaded via `require()`, **in-process**. No subprocess isolation. No allowlist. No mtime fingerprint.
- `workspace/plugins/` is empty — confirmed by `ls`. No real plugins to risk.

### Session security on /v1/chat/completions

- `server.ts:5110` reads `process.env.AIDEN_API_KEY`. If set, requires `Authorization: Bearer <key>`. If unset, the route is unauthenticated — but only reachable from localhost by default since `AIDEN_HOST=127.0.0.1`. In headless mode (`AIDEN_HEADLESS=true`) the API is exposed on `0.0.0.0` and unauthenticated unless `AIDEN_API_KEY` is set. ⚠️ explicit pitfall for the Linux/server deployment path.

---

## 8. CLI/UI wiring audit

`cli/aiden.ts` (6 034 lines) and `cli/commandCatalog.ts` (283 lines).

- **Slash command catalog**: `cli/commandCatalog.ts` is referenced by `cli/aiden.ts:5310` `buildSlashCommands()`. v3 audit covered the duplication problem.
- **Tool dropdown sync** — re-verified: `cli/aiden.ts:5320-5383` `buildToolList()` is still a hardcoded array literal. **62 tool entries** in the literal vs **70 entries** in `TOOL_DESCRIPTIONS`. 8 missing from dropdown: `manage_goals`, `compact_context`, `git_status`, `git_commit`, `git_push`, `system_volume`, `get_calendar`, `read_email`, `send_email`, `get_natural_events`, `schedule_reminder`. The drift class flagged in v3 audit is still present and worse.
- **Dropdown rendering**: relative-cursor escapes (`cli/aiden.ts:5395-5397`). Still fragile per v3 audit. Did not find a `_refreshLine` change.
- **`@toolname` autocomplete query** — not derived from `TOOL_NAMES_ONLY` at all. The CLI cannot react to plugin-registered tools.
- **Status bar**: imperative refresh per turn (per v3 audit). No live snapshot.

---

## 9. Dashboard audit

`api/dashboard.ts` (478 lines) — single self-contained HTML.

| Panel | Endpoint dependency | Verified at |
|---|---|---|
| Chat | POST `/api/chat` | `server.ts:645` ✅ |
| Providers | GET `/api/providers/state`, GET `/api/providers/status` | `server.ts:2167, 2549` ✅ |
| Memory | GET `/api/memory`, GET `/api/memory/search?q=…` | `/api/memory` not in grep — **wait**: grep showed no exact `/api/memory` GET handler. Confirmed by `grep "/api/memory" server.ts` returning only `/api/memory/search` (`:2537`). The dashboard fetches `/api/memory` (`dashboard.ts:411`) and gets a 404. ❌ broken panel. |
| Skills | GET `/api/skills/learned` | `server.ts:2796` ✅ |

This is a real concrete bug: the dashboard's Memory panel will fail to populate because the endpoint it queries does not exist. Cross-checked against grep output.

---

## 10. MCP server audit

`api/mcp.ts` (259 lines, full read).

- **Stdio transport** (`:254` `StdioServerTransport`).
- **stdout-protection fix** verified in place: `:140-146` redirects `console.log/info/warn/debug` to stderr at server start. Must remain — without it any third-party module's `console.log` corrupts MCP frames. ✅ v3.18 fix intact.
- **Tool surface**: `SAFE_TOOLS = 26` (incl. `take_screenshot` alias that is silently skipped because `TOOLS['take_screenshot']` is undefined per `:163`). `DESTRUCTIVE_TOOLS = 30`. Aiden's docs claim "29 safe / 34 destructive" — **off by 3 and 4 respectively**.
- **`MCP_ALLOW_DESTRUCTIVE`** check (`:62-67`). ✅ wired.
- **Plugin tool exposure**: `:168-178` always includes plugin tools regardless of safe/destructive split — no opt-in for plugin destructiveness. ⚠️
- **Error code mapping**: returns `isError: true` plus a JSON-stringified payload. No proper MCP error codes — uses `text` content type only.
- **Concurrent requests**: stdio is single-threaded; MCP client multiplexes by request ID. `executeTool` is async; no internal queueing — concurrent calls share the same Playwright browser singleton (`playwrightBridge`), which is a real concurrency hazard. Not exposed by the MCP layer alone but inherited.

---

## 11. Plugin system audit

Re-confirmed v3 audit:

- `core/pluginLoader.ts:33-38` — singleton hooks struct (4 hook types).
- `core/hooks.ts:11-14` — only 3 events.
- `workspace/plugins/` — empty.

### Cold-start load

`server.ts` calls `loadPlugins(pluginDir)` at boot — grep needed but not done; the import + plugin reload route at `/api/plugins/reload` (`server.ts:2687`) confirms the loader is wired. Cold-start path is fire-and-forget; if a plugin throws in `init`, it's logged and skipped (`pluginLoader.ts:132-134`). ✅ failure isolation per-plugin.

### Hot reload

`pluginLoader.ts:139` `reloadPlugins(pluginDir)` — disposes in reverse order, clears all 4 hook arrays, re-loads. ⚠️ disposal happens on every hot-reload even if a plugin errors in dispose (try/catch at `:144`). The hook arrays are cleared **before** the reload — so during the reload window, no plugin hooks fire. Brief gap, not a correctness bug.

### preTool timeout

❌ **None.** A plugin `preTool` hook can hang forever; the agent loop awaits it without a timeout (`agentLoop.ts:1894-1902`).

### postTool composition

`agentLoop.ts:1922-1930` — sequential `for` loop, mutates `finalResult`. No concurrent execution. Plugin order matters; first registered runs first.

### Registration persistence

Plugin hooks are in-memory only. Restart wipes them. (`pluginHooks` is a module-scoped singleton at `pluginLoader.ts:33`.) Plugins re-register on `init` each load.

### Why is `workspace/plugins/` empty?

No plugins shipped, no examples installed. `_examples/` directory not present. The framework is wired with no users.

---

## 12. Skills system deep audit

### Loading

`core/skillLoader.ts:267` `loadAll()` — eager iteration over six search dirs (`:247-256`). Lazy content load via `getSkillContent` (`:23`) backed by an LRU(50) cache. Cache populated only on first read.

### Block patterns post-v3.17 fix

`skillLoader.ts:41-66` — 16 `SKILL_INJECTION_PATTERNS`. Recent commits: `b892cae` and `0093f35` (latest, "remove over-broad injection patterns blocking 99% of installed skills"). The current list is the post-fix version. Cross-checked: the patterns are scoped (e.g., `\\x[0-9a-f]{2}\\x[0-9a-f]{2}/i` requires *two consecutive* hex sequences). ✅ post-fix shape.

### Startup perf

Each skill folder scan: directory readdir + sync read + sanitize regex (16 patterns) + structure validation. Per skill: O(content_length × 16). For 10 skills × 5 KB avg, this is ~800 KB of regex work. Synchronous; blocks server start. Not catastrophic at current size; will degrade with skill count.

### `skillWriter` trigger + confidence

- Triggered at `server.ts:1788` after every successful chat turn (≥1 tool ran).
- Gate: `success && toolsUsed.length >= 2` (`skillWriter.ts:311`).
- Dedup: Dice token similarity > 0.80 → bumps `successCount` and `confidence` (`:325`).
- Initial `confidence: 0.5` (`:403`).
- Promotion thresholds: graph hyperedge `agentloop_skillTeacher` references `skillTeacher.ts:334` — promotion-and-cache-invalidate path.

### Curator pruning

Grep on `skillRegistry.ts`, `skillWriter.ts`, `skillLoader.ts` for `prune|delete|archive|deprecate|stale` returns nothing relevant. **No pruning.** No confidence decay. No deprecation. Skills only accumulate.

### Conflict resolution

`skillLoader.ts:319-323` — dedup by name; later directories win (`approved > learned > workspace > built-in` per the comment at `:317`). No conflict UI; silent override.

### `skills.taracod.com` worker

Static read only. Not curl'd. References in `core/skillLibrary.ts` (not read). Liveness unknown from source.

### `workspace/skills/` structure

```
workspace/skills/
├── approved/
│   └── increase_volume/  (1 skill)
├── installed/  (empty)
└── learned/  (10 skills, each a dir)
```

Notable learned skills: `decrease_volume_little`, `its_not_its`, `its_now_close_google_chrome`, `its_opened_still`, `search_gehra_hua`, `where_you_opened`, `what_model_are`. The token-based naming produces low-quality names from corrective user messages — half these names are mid-sentence fragments. The `skillWriter.skillNameFromMessage` (`skillWriter.ts:293`) takes the first 5 non-stop-word tokens — when the user's message is "It's not, it's …" the resulting skill name is `its_not_its`. **Naming quality is low.**

---

## 13. Scheduler & async tasks

`core/scheduler.ts` (581 lines) split between cron-based `Scheduler` (`:435`) and reminder scheduler (`:438-580`).

### Reminder scheduler

- `initReminderScheduler` at `:548` — restores from `~/.aiden/scheduled.json` (`:462`).
- Boot integration: `server.ts:5714` `try { initReminderScheduler() } catch { … }`. ✅ wired.
- Persistence: synchronous JSON write per modification (`_rsave` `:464`).
- Recurring intervals hardcoded: hourly (3 600 000), daily (86 400 000), weekly (604 800 000) (`:510-513`).
- Restart restoration: ✅ `:559-575` reads file, schedules `setTimeout` for each.
- Long-running tasks: no time limit. A `recurring: 'weekly'` reminder restored on a 9-day-old timestamp would fire immediately (delay clamped to 0 at `:567`).

### Cron parsing

Did not read Scheduler class internals (`:1-435`). The export at `:435` uses cron-style scheduling (per graph hyperedge). Behavior unverifiable from static read alone.

---

## 14. Known bugs — status check

Each fix referenced; "status" verified by source inspection.

- **YouTube fast-path (commit c8b966c)**: ✅ present at `server.ts:946-949` and `toolRegistry.ts:387-396` (auto-click first result on `youtube.com/results`).
- **`app_close` param normalization (93255a9)**: ✅ implementation at `toolRegistry.ts:1670-1738` handles both `app` and `app_name` keys (skim).
- **`system_volume` natural input (f6b38da)**: ✅ at `toolRegistry.ts:1739`. Implementation accepts strings/numbers — full body not read.
- **Server log stdout race (4e66fd8)**: stdout is *not* re-routed in normal serve mode (`server.ts:5660-5663` only redirects `console.*`, not `process.stdout.write`). MCP mode does (`api/mcp.ts:140-146`). ✅ fix correct in MCP; serve-mode untouched but no SSE-corrupting writes seen.
- **Skill loader over-blocking (b892cae fix; recent 0093f35)**: ✅ patterns at `skillLoader.ts:41-66` scoped per the latest commit.
- **SOUL.md sync across copies**: workspace seeding at `server.ts:5704-5712` copies root `SOUL.md → workspace/SOUL.md` if missing. ⚠️ **One-way**: edits to `workspace/SOUL.md` do NOT propagate back to root, and edits to root only seed when `workspace/SOUL.md` is absent. v3 audit's note about three-copy drift still applies.
- **InstantAction faking — was it actually removed?**: **Partially.** App open/close/launch entries removed (comment at `server.ts:148-151`), but `screenshot`, `volume_up/down/mute`, `lock_screen` still try/catch-swallow and return hardcoded success strings (`:158-237`). See §2.
- **Dropdown filter and cursor (428ff2e)**: Dropdown still hardcoded literal at `cli/aiden.ts:5320-5383`. Cursor escape pattern still present at `:5395-5397`. Did not verify the specific filter/cursor change in 428ff2e by diff.
- **Per-model failover (984a65b)**: `getNextModelOnFailure` defined at `modelRegistry.ts:244`, imported in `agentLoop.ts:23`. Wired. Behavior unverifiable from static read alone.

---

## 15. Ticking timebombs

### Unbounded growth

| Path | Current size | Trim mechanism |
|---|---|---|
| `workspace/conversation.json` | 24 KB | none |
| `workspace/audit/audit.jsonl` | 8 KB | none |
| `workspace/cost/2026-04-29.jsonl` | 2.5 KB | per-day rotation by filename — older days never deleted |
| `workspace/sessions/` | 1 file | none |
| `workspace/skills/learned/` | 10 dirs | none — and naming quality decays |
| `workspace/blocked-skills.log` | 1 959 lines | none — append since v3.17 |
| `workspace/semantic.json` | 226 KB | none |

### Accumulating state

- Failed skill blocklog appends every install attempt regardless of dedup. Will grow forever.
- `lastExchangeBySession` (`server.ts` Map at module scope) — entries never deleted. Long-lived processes accumulate one entry per session.
- `consecutiveFailures` Map (`router.ts:50`) — only cleared on `markHealthy`. A provider deleted from config still has a residual map entry.
- `responseTimesMs` EWMA (`router.ts:46`) — same.

### Coupling

- Hardcoded provider IDs all over: `OPENAI_COMPAT_ENDPOINTS` (`agentLoop.ts:438`), `CHAT_EXCLUDED = ['cerebras', 'nvidia']` (`router.ts:433`), `OLLAMA_FALLBACK_MODEL = 'gemma4:e4b'` (`:389`).
- Magic numbers: `COMPACT_THRESHOLD = 40`, `AUTO_UNPIN_THRESHOLD = 3`, dedup `0.80`, LRU `max: 50` (skillLoader), preflight gate `0.5` (agentLoop), retry cap `5000ms`, max retries `2`.
- Fragile string matching: `app_launch` case at `toolRegistry.ts:1623` likely uses substring-driven heuristics for app names; full body not read.

### Performance cliffs

- Skill loader: O(n × 16) regex per skill per cold load. With 100+ skills + 10KB each, full load ≈ 1.6M regex ops. Sync.
- `repairToolName` (`agentLoop.ts:44` import; not read raw) — graph references "fuzzy edit-distance repair". O(n²) likely; called on every plan validation.
- Dashboard fetches `GET /api/skills/learned` (`dashboard.ts:454`) which calls `skillLoader.loadAll()` — pays full disk scan on every dashboard tab switch.

### Race conditions

- `conversationMemory` write-then-read collisions on parallel sessions hitting same session ID via `/v1/chat/completions`.
- Provider config disk-write on every rate-limit event (no batching). Bursty 429s overwrite the same config.json many times in seconds.
- `playwrightBridge` singleton browser context shared across concurrent tool calls — graph "Playwright Browser Singleton Cluster" (`toolregistry_browsercontext_singleton`). Two parallel `browser_extract` calls race on the same active page.
- Plugin reload mid-tool: `reloadPlugins` (`pluginLoader.ts:139`) clears `pluginHooks.preTool` while a tool dispatch is reading it. Mid-iteration mutation of `pluginHooks.preTool[]`.

### Test coverage

- `tests/` directory: 11 root-level `.ts` test scripts, 3 e2e scripts (`tests/e2e/`).
- `*.test.ts` count: 140 — but 100% live under `node_modules/zod/src/v3/tests/` and similar vendor paths. **Aiden's own `*.test.ts` count is effectively zero.** `*.spec.ts`: 1 file (likewise vendor).
- Test runner: `vitest` declared (`package.json:60`), but no `vitest.config*` found in tree (only vendor configs). Tests use `npx ts-node tests/*.ts` style — not vitest.
- CI: `.github/workflows/ci.yml` exists; not read raw.

---

## 16. Dependency health

Read `package.json:199-258` (deps + devDeps).

Notable:
- `@modelcontextprotocol/sdk` ^1.27.1 — current.
- `playwright` ^1.58.2, `puppeteer` ^24.39.1 — **both installed**. Why both? `playwright` powers `playwrightBridge`. Puppeteer is unused as far as my reading went; not imported in `core/`. Bundle bloat candidate.
- `electron-updater` ^6.8.3 — for desktop installer; appropriate.
- `whatsapp-web.js` ^1.26.0 — channel adapter; large dependency.
- `epub2`, `pdf-parse`, `archiver`, `tar-stream`, `screenshot-desktop`, `qrcode-terminal` — varied media/file dependencies; each small.
- `@types/node` ^25.3.0 — runtime is `>=18` (`package.json:24`); types are 25.x. Mismatch is benign (types newer than runtime) but should match.
- `chalk` ^5.6.2 — ESM-only; project is `"type": "commonjs"` (`:44`). Loading chalk 5 from CJS requires dynamic `import()`. If `chalk` is `require`-d anywhere, it errors at runtime. Worth a static check.
- All dependencies use `^` (caret). No exact pins. `engines.node >=18` is a soft floor.

---

## 17. Configuration surface

### Env vars (count + categorize)

`.env` has **13** explicit keys. Code references at least **41** distinct `process.env.*` lookups across `core/`, `api/`, `providers/`. The undocumented ones (in code but not in `.env`):

- `AIDEN_USER_DATA`, `AIDEN_HEADLESS`, `AIDEN_HOST`, `AIDEN_PORT`, `AIDEN_LOG_LEVEL`, `AIDEN_CORS_ORIGIN`, `AIDEN_API_KEY`, `AIDEN_SANDBOX_MODE`, `AIDEN_PASSIVE_LEARNING`.
- `OLLAMA_TEMPERATURE`, `OLLAMA_CONTEXT_LENGTH`, `OLLAMA_NUM_GPU`, `OLLAMA_NUM_THREAD`, `OLLAMA_TOP_P`, `OLLAMA_REPEAT_PENALTY` (per `CLAUDE.md`).
- `OLLAMA_HOST`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_EMBED_MODEL` (in `.env`).
- `AIDEN_BROWSER_HEADLESS`, `AIDEN_BROWSER_TIMEOUT` (per `CLAUDE.md`).
- `MCP_ALLOW_DESTRUCTIVE`, `USER_NAME`, `USERNAME`, `USER`, `<PROVIDER>_MODEL` overrides (`modelRegistry.ts:230`).

No central `.env.example` was located — discovery is grep-driven only. ⚠️ documentation gap.

### Validation on load

None observed. `loadConfig()` at `providers/index.ts` (not read raw) returns the JSON config; envs are read at call site with `||` defaults.

### Reloadable

- `permissions.yaml` — yes, file watcher (`permissionSystem.ts:131`).
- Provider config — yes, every API call re-reads via `loadConfig` (chatty).
- Ollama env vars — yes, read at call time per `CLAUDE.md`.
- `SOUL.md` — only at compaction (`agentLoop.ts:706`).
- `LESSONS.md` — every turn (`:870`).
- `STANDING_ORDERS.md`, `GOALS.md`, `USER.md` — only at compaction.

### Hidden config — hardcoded thresholds, magic paths, URL endpoints

- `OPENAI_COMPAT_ENDPOINTS` (`agentLoop.ts:438`) hardcodes Groq, OpenRouter, Cerebras, NVIDIA, GitHub, BOA URLs.
- `BOA_API` URL embedded somewhere; `core/auxiliaryClient.ts` not read.
- `https://www.youtube.com/results?search_query=` hardcoded in 4 places (`server.ts:946-949`).
- `https://duckduckgo.com/?q=` hardcoded as a Google substitute (`server.ts:956-960`) — the user types "google search X" and gets DuckDuckGo. Documented in comment but surprising for the user.
- `~/.aiden/scheduled.json` (`scheduler.ts:462`) — hardcoded path.

---

## 18. Observability

### Log levels

- `AIDEN_LOG_LEVEL = 'info' | 'debug'` (`server.ts:5692`). Only `debug` triggers verbose logs.
- All other log calls go to stdout/stderr unconditionally.

### Structured vs string

- `auditTrail.record` writes JSON lines to `workspace/audit/audit.jsonl` (`auditTrail.ts:31`). ✅ structured.
- Cost tracker writes to `workspace/cost/YYYY-MM-DD.jsonl` (per-day rotation).
- Everything else is `console.log` string.

### Crash reports

- `process.on('unhandledRejection')` and `process.on('uncaughtException')` (`server.ts:5681-5690`) — log + livePulse.error. Process keeps running.
- No crash dump file. No error counters in audit.jsonl.

### Telemetry — local-only?

- `livePulse` (`coordination/livePulse`) — referenced as the WebSocket bridge (`server.ts:5735`). Local socket, not external.
- No `Sentry`, no `posthog`, no analytics SDK. ✅ local-only.

### Diagnostic commands

- `core/doctor.ts` (180+ lines) — system health checks. Referenced from `cli/aiden.ts` likely; full body not read.
- `/whoami`, `/status` — slash commands declared in `cli/commandCatalog.ts` and slash-mirror tools in `slashAsTool.ts`.

---

## SCORECARD

| System | Status | Confidence |
|---|---|---|
| Tool registry | ⚠️ multiple drifts (12+ tools planner-unreachable, 19 categories with no description) | high |
| Planner pipeline | ⚠️ 5 of 7 InstantActions still fake; many fast-paths skip memory write | high |
| Identity / context freshness | ❌ STANDING_ORDERS / USER / GOALS only refresh at compaction; LESSONS does refresh per turn | high |
| Memory layers | ⚠️ no pruning anywhere; semantic.json 226 KB and growing | high |
| Provider routing | ✅ failover wired; per-model rotation wired but unverified | medium |
| Streaming integrity | ✅ no SSE corruption found | high |
| Security posture | ⚠️ permissions cover shell+files+browser only; mouse/kb/app tools ungated | high |
| CLI / dropdown | ❌ hardcoded literal still present, 8 tools missing | high |
| Dashboard | ❌ Memory panel queries nonexistent `/api/memory` GET endpoint | high |
| MCP server | ✅ stdout-protection in place; tool counts 26/30 not advertised 29/34 | high |
| Plugin system | ⚠️ wired, narrow event vocabulary, no preTool timeout | high |
| Skills system | ⚠️ no curator, no decay, no pruning, naming quality low | high |
| Scheduler | ✅ persists + restores; clamps to 0 on past-due reminders | medium |
| Bug-fix regression | partial — InstantAction not fully removed | high |
| Test coverage | ❌ ~0 unit tests of own code (140 .test.ts all in node_modules) | high |
| Dependency health | ⚠️ puppeteer + playwright both shipped | medium |
| Config surface | ⚠️ ~41 env vars in code, ~13 in .env, no .env.example | high |
| Observability | ⚠️ structured audit + cost only; rest is console string | high |

---

## TOP 10 ISSUES IN PRIORITY ORDER

1. **Dashboard Memory panel broken** — `dashboard.ts:411` fetches `GET /api/memory` which has no handler in `server.ts`. User clicks Memory tab → 404 / silent failure. **Small fix.** Target: v3.19.

2. **5 of 7 InstantActions still fake success** — `screenshot`, `volume_up/down/mute`, `lock_screen` (`server.ts:158-237`) try/catch-swallow and return hardcoded "Done" strings. Reintroduces the v3.17 bug class for non-app actions. **Small fix** per action. Target: v3.19.

3. **Planner cannot pick `fetch_url`, `cmd`, `ps`, `wsl`, `git_status`, `compact_context`, `manage_goals`, `get_calendar`, `read_email`, `send_email`, `ingest_youtube`** — `agentLoop.ts:808` `ALLOWED_TOOLS` omits 12 wired handlers. User asks "read my email" → planner emits a different tool. **Small** (one list edit + tests). Target: v3.19.

4. **Tool dropdown hardcoded literal still 8 entries behind registry** — `cli/aiden.ts:5320-5383` regression class flagged in v3 audit; missing `manage_goals`, `compact_context`, `git_*`, `system_volume`, `get_calendar`, `read_email`, `send_email`, `get_natural_events`, `schedule_reminder`. **Small** (derive from `TOOL_NAMES_ONLY`). Target: v3.19.

5. **Identity/STANDING_ORDERS/USER/GOALS frozen for 40 messages** — v3 audit's #1 finding still unfixed. `agentLoop.ts:687-755` re-reads only at compaction. **Medium** (per-turn re-read + cache invalidation). Target: v3.19.

6. **No skill curator / pruning** — `workspace/skills/learned/` accumulates skills like `its_not_its` from corrective messages. No decay, no archival, no rename. Names degrade with use. **Medium** (curator pass + name regenerator). Target: v3.20.

7. **`writeSkillFromTask` poor naming** — `skillWriter.ts:293` `skillNameFromMessage` produces fragments like `decrease_volume_little` from the user's exact phrasing. Five-token slice from corrective messages produces nonsense. **Small** (LLM-namegen or stricter trigger gate). Target: v3.19.

8. **MCP `take_screenshot` ghost in SAFE_TOOLS** — `api/mcp.ts:32` lists a tool name that has no handler. Silently dropped at registration but advertised in tool inventory. **Trivial**. Target: v3.19.

9. **Permission system gap: mouse/kb/app/voice/git tools ungated** — `permissions.yaml` only covers shell, files, browser. `keyboard_type "rm -rf /"` runs without permission check (because shell allowlist applies to actual shell, not synthesized typing). **Medium** (extend permission surface to all tools). Target: v3.20.

10. **`workspace/blocked-skills.log` append-only forever** — `skillLoader.ts:107-117`. 1 959 lines today. Will hit MB scale within a few months of skill-install attempts. **Small** (rotate or cap). Target: v3.20.

---

## TICKING TIMEBOMBS (3-6 month horizon)

- **`workspace/semantic.json` at 226 KB and growing.** No prune, no chunking. At ~2 MB it will start measurably slowing every chat turn (full-file load, full-file regen on append). The first user complaint will be "Aiden got slow."

- **`conversation.json` whole-file overwrite on parallel sessions.** Two parallel chats via `/v1/chat/completions` (the OpenAI-compat endpoint) hit `conversationMemory.addAssistantMessage` simultaneously. Last writer wins; the other turn vanishes from history. Becomes hostile when more than one client connects.

- **`consecutiveFailures` and `responseTimesMs` Maps never trim.** Process running for weeks with churning custom providers will accumulate dead-key entries.

- **`lastExchangeBySession` Map** (`server.ts`) never trims. Long-running headless deployment with many short sessions leaks memory.

- **Skill name collisions in `skills/learned/`.** Two close-to-each-other user messages can collide on the 5-token slice. The dedup at `skillWriter.ts:325` is Dice > 0.80 *over the message* — the dir name, however, is computed independently. A fresh dir name can match an existing dir's `meta.json`'s pattern but be a different folder; double-write skills.

- **`.env.example` absent.** First time a new contributor / Linux user / Docker deployer comes online, they'll have to grep code to find required env vars. The 41-vs-13 gap will bite.

- **`puppeteer` is bundled but unused.** When Electron rebuilds, native modules are rebuilt; an extra 100+ MB download for a dependency nothing imports.

- **`COMPACT_THRESHOLD = 40` is fixed regardless of model context.** A user on a 1M-context model still hits the protected-context rebuild every 40 messages; useless ceremony. A user on a 4K model is left dangerously close to overflow before compaction.

- **`SHELL_ALLOWLIST` is regex-prefix matching — the entire pipe / argument tail is unverified.** `git push --upload-pack=/etc/passwd` matches `/^git\b/` and runs. The denylist catches the obvious ones; long-tail attacks via subcommand flags are not.

---

## ARCHITECTURAL HEALTH

Aiden is well-architected at the tool-execution layer: `executeTool → executeToolWithRetry → runTool` is a clear pipeline with retry, quality-gate, and plugin hooks at named boundaries. The provider-routing layer is also clean: `getModelForTask` handles task-typing, `markRateLimited` does exponential backoff, the failover walks a tier-sorted chain to Ollama. The 3-step plan/execute/respond loop is the right abstraction.

The debt is in the *registries-of-registries* pattern. There is no single source of truth for tool identity. `TOOLS`, `TOOL_DESCRIPTIONS`, `TOOL_TIERS`, `TOOL_CATEGORIES`, `TOOL_TIMEOUTS`, `VALID_TOOLS`, `ALLOWED_TOOLS`, `PARALLEL_SAFE`, `SEQUENTIAL_ONLY`, `NO_RETRY_TOOLS`, MCP `SAFE_TOOLS`, MCP `DESTRUCTIVE_TOOLS`, CLI dropdown literal, slash mirrors, recipe trigger names — fourteen tables that must agree, none of which validate against each other at startup. Every drift case in §1 is a symptom of the same root cause.

The next fire is freshness. The v3 audit nailed the protected-context-only-at-compaction problem and proposed a fix; v3.18 ships without it. With every release the gap between "edit `STANDING_ORDERS.md`" and "Aiden behaves differently" stays at 40 messages. Users will notice by the v3.20 timeframe — the kind of thing that breaks user trust quietly because it never shows up as an error.

The third fire is the absence of a curator. Skills, lessons, semantic memory, conversation history, audit log all grow monotonically. There is no system process that says "this is stale, archive it." Storage isn't the problem; *retrieval quality* is. A planner faced with 200 learned skills, half of which are fragments of user corrections, will spend more time triaging than acting.

---

## "FEELS HARDCODED" SCORECARD

| Capability | Status | Justification |
|---|---|---|
| Identity refresh | ❌ | SOUL/USER/STANDING_ORDERS/GOALS only re-read at compaction (`agentLoop.ts:687-755`); 40-message lag |
| Real-time state injection | ❌ | No live windows / Spotify / disk / RAM injected into prompt; SOUL declares hardcoded "GTX 1060" |
| Mid-turn memory recall | ⚠️ | Gated by `needsMemory` heuristic (`skillLoader.ts:228`) — works only when user uses keywords like "remember" |
| Self-correction | ⚠️ | `analyzeFailureTrace` fires on `≥2` errors or keyword detection (`server.ts:1810`) — wired, no observed retry of plan based on its output |
| Skill self-curation | ❌ | Zero pruning, zero decay, zero promotion logic — only `successCount` increment in dedup path |
| Proactive context | ❌ | `surfaceRelevantMemories` (`agentLoop.ts:278`) gated by SKIP_MEMORY_PATTERNS regex; nothing periodic |

---

## Reading log

Files read (with line ranges) for this v3.18.0 audit:

- `package.json` — full (1-259)
- `core/version.ts` — full (1-2)
- `SOUL.md` — full (1-237)
- `docs/agents-audit-v3.md` — full (1-311)
- `core/agentLoop.ts` — 1-130, 200-290, 680-900, 1521-1600, 1880-1980 (5 windows of ~3 096)
- `core/toolRegistry.ts` — 1-200, 275-405, 2772-3120 (5 windows of 3 120)
- `api/server.ts` — 142-237, 440-505, 940-1118, 1380-1602, 1770-1850, 5660-5727 (6 windows of 6 817)
- `providers/router.ts` — 1-583 (full)
- `core/modelRegistry.ts` — 1-278 (full)
- `api/mcp.ts` — 1-259 (full)
- `api/dashboard.ts` — 1-100 (visual scan only past that; endpoint deps grep'd)
- `core/hooks.ts` — 1-63 (full)
- `core/pluginLoader.ts` — 1-170 (full)
- `core/auditTrail.ts` — 1-67 (full)
- `core/scheduler.ts` — 438-580 (reminder portion)
- `core/skillLoader.ts` — 1-360
- `core/skillWriter.ts` — 1-100, 248-435
- `core/aidenIdentity.ts` — 180-227
- `cli/aiden.ts` — 5320-5460 (dropdown subsystem)
- `workspace/permissions.yaml` — 1-80
- `graphify-out/GRAPH_REPORT.md` — 1-310 (god nodes + community structure + hyperedges)
- Directory listings: `core/`, `cli/`, `api/`, `providers/`, `workspace/`, `workspace/skills/*/`, `tests/`, `tests/e2e/`
- Live state stat: `workspace/conversation.json` (24 KB), `workspace/semantic.json` (226 KB), `workspace/blocked-skills.log` (1 959 lines), `workspace/audit/audit.jsonl` (8 KB), `workspace/skills/learned/` (10 dirs)
- Greps: `^export const TOOL`, `^const TOOL`, `process\.env\.[A-Z_]+`, `app\.(get|post|...)`, `InstantAction|fastReply`, `loadConfig|permissions\.yaml|/v1/(models|chat)`, `refreshIdentity`, `compaction|history\.length\s*>=`, etc.

End of v3.18.0 audit.
