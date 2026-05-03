## v3.19.9 — Hotfix: PACKAGE_ROOT for template copies (2026-05-03)

Manual verification of v3.19.8 fresh install via npx revealed that C22's skill
bundle copy still didn't fire. Templates were sourced from WORKSPACE_ROOT
(user's temp dir) instead of the npm package root.

### Patch

**C24 — PACKAGE_ROOT constant**

api/server.ts now defines PACKAGE_ROOT that resolves to the npm package install
directory via __dirname (with fallbacks for esbuild bundle, tsc output, and dev
mode). All three template copy blocks (permissions.yaml, SOUL.md, skills) now
source from PACKAGE_ROOT.

### What this fixes

Fresh `npx aiden-os@3.19.9` installs now correctly:
- Copy workspace-templates/SOUL.md to workspace/SOUL.md
- Copy workspace-templates/skills/ (40 skills) to workspace/skills/learned/
- Copy default permissions.yaml

v3.19.8 had the right fix logic but wrong source path. This hotfix completes the
v3.19.6 skill bundle delivery that's been broken across v3.19.6/v3.19.7/v3.19.8
publishes.

### Affected installs

If you installed Aiden via npx between v3.19.6 and v3.19.8, you got 0 skills
despite the bundle. v3.19.9 fixes this. Re-run: npx aiden-os@latest

---

## v3.19.8 — Skill bundle fix + CLI noise reduction (2026-05-03)

Two patches addressing real fresh-install bugs surfaced during v3.19.7 manual
verification.

### Patches

**C22 — Skill bundle path mismatch**
v3.19.6 shipped 40 starter skills but they didn't load on fresh installs. Three
components used different root paths:
- scripts/postinstall.js wrote to npm install dir
- api/server.ts initWorkspaceDefaults wrote SOUL.md to LOCALAPPDATA but not
  skills
- core/skillLoader.ts scanned process.cwd()

Boot logs showed soul=FULL but skills=0 because SOUL.md had two copy mechanisms
targeting AIDEN_USER_DATA while skills had only the npm-install-dir copy.

Fix:
- core/skillLoader.ts: SkillLoader respects AIDEN_USER_DATA env var (fallback to
  process.cwd())
- api/server.ts: initWorkspaceDefaults() now copies workspace-templates/skills/
  to workspace/skills/learned/ on first boot (idempotent, mirrors SOUL.md
  pattern)

Fresh installs now correctly load 40 starter skills. 8 regression tests
(groupAB).

**C23 — CLI noise reduction**
[Router] [Planner] [ProtectedCtx] [Memory] [Tools] log lines were appearing
inline with chat in CLI window. Made product look broken even when functioning.

Quick fix (full logger rewrite is v3.20 Investigation C):
- api/server.ts: _toStderr replaced with _gatedLog (level-aware:
  debug/info/warn/error/silent)
- Bracket-prefixed informational logs suppressed when level >= warn (default for
  CLI mode)
- console.warn always writes (real warnings stay visible)
- coordination/livePulse.ts: 6 redundant console calls removed (SSE is real
  delivery channel)
- packages/aiden-os/bin/aiden.js: Sets AIDEN_CLI_MODE=1 + AIDEN_LOG_LEVEL=warn
  by default

Users can opt into verbose: AIDEN_LOG_LEVEL=debug npx aiden-os

10 regression tests (groupAC).

### Coming in v3.19.9
- Setup wizard auto-trigger on fresh install (Investigation B)
- User identity bootstrap with name + pronouns (Investigation F)
- /skills install + agentskills.io integration
- Update notification banner on boot

### Architecture follow-ups for v3.20 ROBUST
- Full logger rewrite with separate stderr pane (Investigation C — current C23
  is minimal fix)
- Browser automation cascade (F13)
- Skills system Hermes-imbibe (agentskills.io frontmatter)
- /goal persistent loop
- Checkpoints + /rollback
- SQLite session storage
- Linux + macOS port
- "Do it again" workflow feature

---

## v3.19.7 — Honesty Patches (2026-05-03)

Four patches eliminating Aiden's biggest trust-breaking bugs on fresh installs.

### Patches

- **C18 — SkillTeacher trigger spam**: Per-session rejection cache prevents
  repeated quality-gate cycles on same rejected name+task combos. 8 regression
  tests (groupL).

- **C19 — Self-knowledge fabrication**: "How many skills do you have" now
  returns dynamic counts from real state, not hardcoded "48 tools, 31 specialist
  agents, 500+ memories" template. Removed non-existent "31 specialist agents"
  and "6-layer memory system" claims entirely. 9 regression tests (groupO).

- **C20 — Fabricated tool execution**: Synthesis prompt now includes explicit
  "NO TOOLS WERE EXECUTED THIS TURN" + 8 specific DO NOT rules when results
  array is empty. Aiden no longer claims to have written files it didn't write.
  9 regression tests (groupP).

- **C21 — Ollama identity context**: workspace-templates/SOUL.md ships in npm
  package, copies to user workspace on first install. MINIMUM_SOUL fallback in
  protectedContext.ts ensures identity even on corrupted installs. All LLM paths
  (cloud + Ollama + direct_response) now inject Aiden identity, tool list,
  honesty rules. Fresh install on Ollama-only correctly identifies itself. 11
  regression tests (groupAA).

### Context

This release is part of the v3.19.x stabilization arc following extensive
manual testing of v3.19.5/v3.19.6. Manual sessions surfaced patterns where
Aiden lied about capabilities or fabricated tool execution — particularly on
fresh installs running Ollama-only fallback. v3.19.7 addresses the four
highest-impact instances.

### Known trade-off

C21 routes direct_response through streamChat for identity injection, adding
~1-3s latency to simple greetings. v3.20 will optimize by injecting identity
into the planner's direct_response generation prompt instead.

### Coming in v3.19.8

- Setup wizard auto-trigger on fresh install (Investigation B)
- User identity bootstrap with name + pronouns (Investigation F)
- /skills install <name> with agentskills.io integration

### Architecture follow-ups for v3.20 ROBUST

- CLI noise / logger rewrite (Finding C)
- Browser automation cascade (Finding F13)
- Optimize direct_response identity injection (remove C21 latency)
- Workflows feature ("do it again button")
- Skills system (Hermes-imbibe)
- /goal persistent loop
- Checkpoints + /rollback (shadow git)
- SQLite session storage with FTS5
- Linux + macOS port

---

## v3.19.6 — 40 Starter Skills Bundle (2026-05-03)

New users now get a working skill library on first install. 40 curated
skills ship inside the npm tarball and are auto-copied to workspace/skills/
on `npm install`. No manual skill installation needed to start using Aiden.

### What ships

**25 Category A skills** (no API keys needed — work immediately):
architecture-diagram, arxiv, ascii-art, blogwatcher, clipboard-history,
crt-sh, cveapi, docker-management, excalidraw, explainshell,
financial_research, github-auth, github-issues, github-pr-workflow,
github-repo-management, jupyter-live-kernel, nano-pdf, obsidian,
ocr-and-documents, p5js, research-paper-writing, securityheaders,
songsee, ssllabs, systematic-debugging

**15 Category B skills** (need API key or credentials to function):
censys, gif-search, google-workspace, greynoise, haveibeenpwned,
linear, notion, shodan, stable-diffusion-image-generation,
test-driven-development, urlscan, virustotal, web_research,
xitter, youtube-content

### How it works

- Skills bundled in `workspace-templates/skills/` (new npm files entry)
- `scripts/postinstall.js` copies them to `workspace/skills/` on first install
- Idempotent: skips copy if user already has skills (checks for SKILL.md)
- Tarball delta: +100 KB (11.3 → 11.4 MB)

### Other fixes

- **SkillLoader installed/ path**: `workspace/skills/installed/` was written
  by skillRegistry.ts but never scanned by SkillLoader. Added to scan paths.
- **License audit**: 11 security skills had missing `license:` frontmatter.
  All now have `license: Apache-2.0`. Zero GPL/LGPL skills in bundle.

### Excluded (Category C)

27 skills not shipped: code_execution and file_operations (redundant with
built-in tools, leaked personal paths, Windows-only without platform gate),
plus India-specific financial tools, game integrations, platform-specific
system tools, and experimental bridges.

### Known issues deferred to v3.19.7

- Setup wizard not auto-triggered on fresh install (Investigation B)
- User identity bootstrap missing (Investigation F)
- `/skills install` command for agentskills.io (Part 2 of skills work)
- Aiden self-knowledge fabrication (Finding F9)
- Fabricated tool execution claims (Finding F11)
- SkillTeacher trigger spam (Finding F12)

---

## v3.19.5 — UX patches + first-real-runtime ship (2026-05-03)

This release ships three patches AND fixes a critical npm delivery gap.
v3.19.0-v3.19.4 published the launcher (aiden-os) to npm correctly, but
the runtime package (aiden-runtime) stayed pinned at v3.18.0 -- meaning
users who ran `npx aiden-os` between May 1-3 got the v3.18.0 runtime
without 11 bug fixes. v3.19.5 is the first release where both packages
publish atomically via the new release-npm.ps1 script.

### Patches

**C14 -- Disable together-1 (Llama 405B)**
Together AI moved meta-llama/llama-3.1-405b-instruct off the serverless
tier, returning HTTP 400 on every request. callLLM() only marked 429 as
rate-limited, so together-1 silently failed every cycle. Set enabled:
false on this provider entry. (config change only, ships via npm publish)

**C15 -- TOOL_REGISTRY handler stubs**
A-12 audit failure pre-existing since C5. memory_store and memory_forget
handlers lived only in core/slashAsTool.ts MIRROR_TOOLS, registered at
runtime into private externalTools map. Added static stubs in TOOLS map
that lazy-import real handlers from slashAsTool (avoids circular dep).
Audit now 100% on A-group.

**C16 -- Rate-limit message accuracy**
Fresh install with no API keys was showing "all cloud providers
rate-limited" -- misleading. Router now distinguishes 'unconfigured',
'rate-limited', and 'mixed' states via new diagnoseProviderPool() helper.
Users without API keys see "No API keys configured -- add keys in
Settings > API Keys or set env vars" instead.

### Release infrastructure

New scripts/release-npm.ps1: 9-step atomic dual-publish pipeline.
Refuses to ship unless both aiden-runtime and aiden-os publish
successfully and version-verify post-publish.

### Known issues deferred to v3.19.6

- Setup wizard not auto-triggered on fresh install (Investigation B)
- User identity bootstrap missing (Investigation F)
- Aiden self-knowledge fabrication (Finding F9)
- Ollama identity context loss (Finding F10)
- Fabricated tool execution claims (Finding F11)
- SkillTeacher trigger spam (Finding F12)
- Skill installer + agentskills.io integration (new scope)

### Architecture follow-ups for v3.20 ROBUST

- CLI noise / logger rewrite (Finding C, ~400+ LOC)
- Browser automation cascade (Finding F13)
- Hermes-imbibe: skills system, /goal loop, checkpoints, SQLite session storage
- Linux + macOS port

---

## v3.19.4 — Manual Test Findings Patch (2026-05-02)

Two bugs found in post-v3.19.3 manual CLI testing, both fixed
with regression coverage.

### Critical fixes

**C12 — Skill pollution prevention + cleanup**
SkillTeacher quality gates added. validateSkillName() rejects
garbage names with question-word/pronoun prefixes, personal
identifiers, or >4 underscore-separated words. validateSkillTask()
rejects tasks shorter than 30 chars, tasks ending in "?", and
tasks that are verbatim copies of user messages.

49 polluted skills purged from workspace/skills/learned/ and
approved/. Pre-purge state preserved in backup commit ec2d2ad
(recoverable via git revert if needed).

16 regression tests prevent recurrence.

**C13 — Cross-platform app launching**
app_launch tool rewritten to handle UWP/Store apps. Previously
"open spotify" tried to exec literal "spotify" command and
failed with Windows error popup. New resolveLaunchCommand()
helper uses URI schemes for UWP apps on Windows (spotify:,
discord:, msteams:, slack:, zoommtg:), bare exe for system
apps (notepad.exe, calc, chrome), graceful fallback for
unknown apps.

macOS uses 'open -a' for all apps. Linux uses bare command
or xdg-open. Foundation for v3.20 cross-platform support.

17 regression tests cover platform-specific resolution.

### Test infrastructure

13 new regression test files total in v3.19.x patches. Suite
is now ~110 tests across 12 group letters. Run with:
npm run test:audit

### Known issues deferred to v3.19.5+
- Provider chain rate-limit cascades (groq/openrouter/together
  all 429 simultaneously in manual test)
- together-1 Llama 405B "non-serverless model" HTTP 400
  (Together changed model availability)
- Context window 8192 limit hitting 106-107% on every turn
- Multi-step plan timeout cascade
- /cmd approval flow doesn't execute
- CLI rendering bugs (cursor, dropdown, wrap) — issue #38

### Architecture follow-ups for v3.20 ROBUST
- Skills system with agentskills.io frontmatter
- /goal persistent loop
- Checkpoints + /rollback
- SQLite session storage with FTS5
- Linux + macOS port (foundation laid by C13)
- Plugin hook timeouts
- Single-source registry

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
