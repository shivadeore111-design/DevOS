## v3.19.3 — Behavioral Audit Patch (2026-05-02)

Fixes 11 bugs surfaced by Layer 2 behavioral testing
(50-prompt audit). Each fix has a regression test.

### Critical fixes
- C5: memory_store dispatch — 'remember X' now persists to
  records.jsonl
- C6: file_read fabrication — synthesis prompt rules guard
  against fabricating content for failed reads
- C7: shell safety — Remove-Item no longer blanket-allowed;
  destructive learned skills auto-rejected
- C3b: screenshot tool schema — outputPath now formal
  parameter, backslash double-escape removed
- C8: run_node/run_python path guard — destructive ops on
  protected system paths blocked at code level (closes #66)
- C9 + C9b: responder URL routing — custom providers
  (Together AI) no longer send keys to Groq URL; 0 raw
  OPENAI_COMPAT_ENDPOINTS lookups remain
- C10: null-plan guard — action intents don't short-circuit
  with hardcoded fallback
- C11: memory_forget tool — 'forget X' actually removes
  matching entries

### Behavioral audit progression
- Pre-patch: 33/50 PASS, 5 BLOCKERs (3 DANGEROUS lying)
- Post-v3.19.3: 33/50 PASS, 0 real BLOCKERs (2 reported but
  unrelated to v3.19.3 scope or test-scoring bugs)

### Test infrastructure
- 11 new regression test files in scripts/test-suite/regression/
- Total: ~80 regression tests
- Run: npm run test:audit

### Known issues deferred to v3.19.4
- #64: MemoryGuard hijacks dual-intent prompts
- #65: TOOL_REGISTRY counters don't include runtime tools
- #67: Planner sometimes splits screenshot into 2-step
- B2-01: file_write reliability (new issue filed)
- B7-02 test scoring (new issue filed)
- get_time clock bug
- Multi-step 90s timeout
- 6 missing TOOL_DESCRIPTIONS

### Architecture follow-ups for v3.20
- Consolidate planner + responder LLM call paths
- externalTools registry trust tiers
- IterationBudget formalization

## v3.19.1 — patch

- Fix: `cli/aiden.ts` handler extraction regression. `/new`, `/history`, `/export`
  referenced non-existent `state.messages` property — broke `npm run cli`.
  Now correctly uses `state.history`.
- No behavior changes for `npm start` / Electron `.exe` users.

## v3.19.0 — "ALIVE"

Aiden's character materially changed. Single-day ship of 5 phases targeting the "feels static" gap.

### Phase 1 — Source-of-truth tool registry
- 13 hand-maintained tool lists collapsed into single TOOL_REGISTRY
- Every list now derived; validator throws on drift at startup
- Adding a tool now requires editing ONE place
- 12 previously-orphaned tools now reachable by planner
  (fetch_url, cmd, ps, wsl, git_status, manage_goals,
  get_calendar, read_email, send_email, ingest_youtube,
  schedule_reminder, compact_context)

### Phase 2 — Per-turn protected context refresh
- SOUL/USER/GOALS/STANDING_ORDERS/LESSONS now refresh every
  turn instead of every 40 messages
- Hash-based file-level cache invalidation
- 24× token reduction on stable turns (3860 → 159)
- Edit USER.md mid-conversation, Aiden picks up changes
  within one turn

### Phase 3 — Honesty enforcement
- 5 fake InstantActions removed (screenshot, volume_up/down/
  mute, lock_screen) — now route to real handlers, surface
  real errors
- Action-verb planner guard: prevents respond-only plans for
  action intents
- Diagnostic failure messages: every failure names tool,
  provider, retries, fallback, error, suggestion
- Hidden bug fixed: fastPath was bypassing planner for short
  action messages

### Phase 4 — Real-time state via tools
- now_playing tool: live media query via Windows WinRT
  GlobalSystemMediaTransportControlsSessionManager
- Volatile startup state dump removed from system prompt
- SOUL.md lazy-state rule: model calls tools for current
  state instead of caching

### Phase 5 — Registry-backed slash completer
- commandCatalog single source-of-truth for slash commands
- 6 previously-invisible commands now in dropdown
  (/plugins, /profile, /failed, /install, /publish, /sandbox)
- Plugin contribution path live: plugins call
  commandCatalog.register() to add commands
- Generation-cached dropdown: rebuild only when catalog
  changes

### Provider chain expansion
- NVIDIA NIM promoted from executor-only to chat slots
  (nvidia-1, nvidia-2)
- Eliminates Groq+Gemini dual-failure mode
- Chain order: groq → gemini → nvidia → openrouter →
  together → ollama

### Deferred to v3.20
See docs/v3.20-candidates.md

### Migration
No breaking changes. Existing plugins continue to work.
npm-installed users will pick up changes on next pull.
