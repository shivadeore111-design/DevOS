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
