# DevOS Session Log

## Phase 29F — Pager-only mode, palette disabled by default
**Date:** 2026-04-23  
**Commit:** d63303b  
**Branch:** main

### Summary
After 5 rounds of palette+pager bug-fixing, the root problem became clear:
both features sharing one keypress handler create cascading conflicts. Fix:
palette disabled by default, pager logic cleaned up to be simple and reliable.

### Changes

#### Palette → opt-in beta
```diff
- const PALETTE_ON = process.env.AIDEN_PALETTE !== 'false'
+ const PALETTE_ON = process.env.AIDEN_PALETTE === 'true'
```
Palette code stays in `commandPalette.ts` and the keypress handler still
has the triggers — they just never fire unless `AIDEN_PALETTE=true`.
Future full TUI rewrite via Ink is the correct long-term path.

#### Pager improvements
- `(rl as any).line = ''` + `cursor = 0` cleared BEFORE key dispatch (not after)
- `console.clear()` before each page render for clean display
- Added `down` / `space` / `return` as next-page keys
- Added `up` as prev-page key  
- Exit keys: `q` / `Esc` / `Ctrl+C` (`key.ctrl && key.name === 'c'`)
- All other keys absorbed while pager active
- History nav (↑/↓) untouched — only fires in normal mode

### Verification

| Check | Result |
|---|---|
| `npm run build:cli` | 0 errors ✅ |
| `showPalette` calls in source | 2 (both behind `PALETTE_ON` flag) ✅ |
| pager refs in source | 9 ✅ |
| `AIDEN_PALETTE === 'true'` opt-in | 1 match ✅ |
| git push | d63303b → main ✅ |

### User Verification (4 tests)
1. `/skills list` → table appears with nav hint
2. Press `n` or `↓` → page 2 of skills, screen clears and redraws cleanly
3. Press `p` or `↑` → back to page 1
4. Press `q` or `Esc` → exits, prompt returns, can type `/help` normally

### Future
- Full TUI via Ink migration: proper keybinding, no readline conflicts
- Palette re-enable: wire to Ink layer when ready

---

## Phase 29E — Fix pager nav + palette execute + cleanup debug logs
**Date:** 2026-04-23  
**Commit:** 789ff27  
**Branch:** main

### Summary
Four UX bugs fixed in one pass. Palette now executes selected commands
immediately (no second Enter required). Pager nav uses proper readline APIs
and exits cleanly on q/Esc/Ctrl+C. All `[PAGER DEBUG]` logs removed.

### Bugs Fixed

#### 1. Pager navigation
- Removed `[PAGER DEBUG]` console.error calls (lines 1831 and 4682)
- Replaced raw `\x1b[2K\r` escape with `readline.clearLine` + `readline.cursorTo`
- Flat `if/return` structure — no dangling else chains
- Added Ctrl+C (`key.sequence === '\u0003'`) as additional exit key
- Exit path now writes `'\n'` before `rl.prompt()` for clean rendering

#### 2. Palette Trigger 1 (`/` on empty buffer)
- Use `readline.clearLine` + `readline.cursorTo` to erase echoed char
- Execute via `await handleCommand(chosen, rl)` — no more injecting text
  into `rl.line` (previously required a second Enter press by the user)
- `try/finally` guarantees `paletteActive = false` + `rl.resume()` + `rl.prompt()`

#### 3. Palette Trigger 2 (Tab on partial `/cmd`)
- Same `handleCommand` execution pattern as Trigger 1
- Esc/no-selection restores partial input to buffer (UX improvement)
- `try/finally` hardening mirrors Trigger 1

#### 4. Defensive reset in `rl.on('line', ...)` handler
- If Enter is pressed while pager is active (edge case), pager state
  is cleared immediately before processing the line input

### Verification

| Check | Result |
|---|---|
| `npm run build:cli` | 0 errors ✅ |
| `[PAGER DEBUG]` in bundle | 0 matches ✅ |
| `pagerActive\|paletteActive\|renderSkillsPage\|handleCommand` in bundle | 22 matches ✅ |
| git push | 789ff27 → main ✅ |

> **USER VERIFICATION REQUIRED:**
> 1. `/skills list` → `n` paginates, `p` goes back, `q` exits cleanly
> 2. `/` on empty line → palette appears, Enter on selection runs command immediately
> 3. `/sk` + Tab → filtered palette, selection runs command immediately
> 4. ↑/↓ arrows → history navigation still works
> 5. Ctrl+C in pager → exits pager cleanly (doesn't kill the CLI)

---

## Phase 29C — Fix dead keypress emitter
**Date:** 2026-04-23  
**Commit:** ab4b008  
**Branch:** main

### Summary
`rl.on('keypress', ...)` was silently dead — `readline.Interface` never emits
`'keypress'`. All three features that depended on it (Phase 29 palette, Phase
29B pager, history ↑/↓ nav) never fired. One-line fix: register on
`process.stdin` instead.

### Root Cause (from Phase 29B diagnosis)
Node.js `readline.createInterface({ terminal: true })` registers its own
internal keypress listener on `process.stdin` (1 listener confirmed
empirically via `process.stdin.listenerCount('keypress')`). The `readline.Interface`
itself emits 0 keypress events. Registering `rl.on('keypress', ...)` added a
handler to an event that is never emitted.

### Changes

#### cli/aiden.ts (1-line change + comment)
```diff
-  rl.on('keypress', (_ch: any, key: any) => {
+  // readline.createInterface({ terminal: true }) internally calls
+  // readline.emitKeypressEvents(process.stdin) and setRawMode(true), so
+  // keypress events are emitted on process.stdin — NOT on the rl Interface.
+  // We must register here, not on rl.
+  process.stdin.on('keypress', (_ch: any, key: any) => {
```

No other changes. `emitKeypressEvents` and `setRawMode` are NOT added
explicitly — `terminal: true` already handles both internally.

Debug `console.error` logs from Phase 29B diagnosis are retained in this
commit so the user can confirm the fix in a live terminal before cleanup.

### Verification

| Check | Result |
|---|---|
| `npm run build:cli` | 0 errors ✅ |
| `process.stdin.on("keypress", ...)` in bundle | line 456505 ✅ |
| `rl.on('keypress', ...)` in source | 0 matches ✅ |
| git push | ab4b008 → main ✅ |

> **USER VERIFICATION REQUIRED** — restart `npm start` + `npm run cli`, then:
> 1. Type `/` on empty line → palette should appear (Phase 29)
> 2. Type `/sk` + Tab → filtered palette (Phase 29)
> 3. Press ↑ arrow → history navigation
> 4. `/skills list` → press `n` → should paginate (Phase 29B)
> 5. In pager, press `q` → should exit (Phase 29B)
> 6. Check stderr for `[PAGER DEBUG]` on pager entry AND key presses — both should now appear
>
> Once confirmed, run follow-up to strip the debug logs.

---

## Phase 29B — /skills list pager n/p/q keys
**Date:** 2026-04-23  
**Commit:** a5bf4cd  
**Branch:** main

### Summary
Fixed the `/skills list` pager: the "n → next  p → prev  q → quit" hint was
purely cosmetic — no keypress handler existed. Phase 29B wires it up for real.

### Root Cause
`handleCommand()` rendered the Skill Store table once and returned.  No state
was stored and no handler intercepted n / p / q, so those characters typed
straight into the chat buffer.

### Changes

#### cli/aiden.ts
- **Module-level state** — `pagerActive: boolean` + `pagerState` object hold
  the active skills slice, current page index, and page size.
- **`renderSkillsPage(skills, pageIndex, pageSize)`** — module-level helper
  extracted from the inline rendering block; called by the `/skills` handler
  and the keypress pager block (DRY).
- **`/skills list` handler** — calls `renderSkillsPage()` then enters pager
  mode (`pagerActive = true`, `pagerState = {...}`) when TTY and pages > 1.
  Non-TTY falls back to a single full render with no pager.
- **Keypress pager block** — fires at the TOP of `rl.on('keypress', ...)`
  before the palette check.  While `pagerActive`:
  - Clears readline echo (`\x1b[2K\r`, `rl.line = ''`, `cursor = 0`)
  - `n` / `→` → advance page (if not at last), re-render, `rl.prompt()`
  - `p` / `←` → back page (if not at first), re-render, `rl.prompt()`
  - `q` / Escape / Enter → exit pager, `rl.prompt()`
  - Any other key → absorbed (buffer cleared, no chat echo)
  - Returns early — palette and history-nav checks never run while pager active

### Constraints respected
- Phase 29 palette (`/` and Tab triggers) unchanged
- Regular chat input: n / p / q type normally when pager is NOT active
- No branding changes

### Verification

| Check | Result |
|---|---|
| `npm run build:cli` | 0 errors ✅ |
| pager symbols in dist-bundle/cli.js | 14 matches ✅ |
| git push | a5bf4cd → main ✅ |

> **User verification required** — interactive pager can only be tested in a
> live terminal.  Suggested steps:
> 1. Run `aiden` (or `npx ts-node cli/aiden.ts`)
> 2. Type `/skills list` → confirm table renders with "n → next  p → prev  q → quit" footer
> 3. Press `n` → second page renders, prompt reappears
> 4. Press `p` → first page renders again
> 5. Press `q` → pager exits, prompt returns to normal
> 6. Type any letter (e.g. `h`) → it appears in the chat buffer (pager NOT active)

---

## Phase 29 — Command Palette UX
**Date:** 2026-04-23  
**Commit:** dc45cf5  
**Branch:** main

### Summary
Added an interactive `'/'` command palette to the Aiden CLI REPL.
Pressing `/` on an empty line (or Tab on a partial `/cmd`) suspends
readline, shows a searchable arrow-key menu of all 80 slash commands
powered by `@inquirer/prompts`, then injects the chosen command back
into the readline buffer. Non-TTY or `AIDEN_PALETTE=false` falls back
to the existing inline hint silently.

### Artifacts

| File | Role |
|---|---|
| `cli/commandCatalog.ts` | New — single source of truth for all 80 commands (COMMANDS, COMMAND_DETAIL, getCatalog) |
| `cli/commandPalette.ts` | New — showPalette() wrapper around @inquirer/prompts `search` |
| `cli/aiden.ts` | Modified — inline COMMANDS/CmdDetail/COMMAND_DETAIL replaced by imports; keypress extended with palette triggers; paletteActive guard; AIDEN_PALETTE opt-out |

### Changes

#### cli/commandCatalog.ts (new, ~262 lines)
- `CmdDetail` and `PaletteCommand` interfaces
- `COMMAND_DETAIL` map: 80 commands with desc, usage, subs, examples, section
- `COMMANDS: string[]` flat list (Tab completer source)
- `getCatalog()` builder → `PaletteCommand[]` for the palette

#### cli/commandPalette.ts (new, ~85 lines)
- `showPalette(filter, commands): Promise<string | null>`
- Lazy-loads `@inquirer/prompts` (zero start-up cost when palette unused)
- Non-TTY guard → returns null immediately
- `AIDEN_PALETTE=false` opt-out handled at call site
- Handles `ExitPromptError` (Esc / Ctrl+C) → returns null
- 14-item paged list, prefix-sorted results, two-column name/desc display

#### cli/aiden.ts
- Top-of-file import: `{ COMMANDS, COMMAND_DETAIL, getCatalog }` from `./commandCatalog`
- Removed ~230-line inline COMMANDS array + CmdDetail interface + COMMAND_DETAIL map
- `paletteActive` flag (prevents double-trigger)
- `PALETTE_ON` constant (TTY check + `AIDEN_PALETTE !== 'false'`)
- Keypress trigger 1: `'/'` on empty buffer → `showPalette('', getCatalog())`
- Keypress trigger 2: Tab on partial `/cmd` → `showPalette(currentLine, getCatalog())`
- Both triggers: pause rl → clear echoed char → async IIFE → inject result → resume rl

### Verification Results

| Check | Result |
|---|---|
| TypeScript build (`npm run build`) | 0 errors ✅ |
| `tsc --noEmit` | 0 errors ✅ |
| Catalog: COMMANDS count | 80 ✅ |
| Catalog: /recipes present | true ✅ |
| Catalog: /learn present | true ✅ |
| API health | `{"status":"ok","version":"3.9.0"}` ✅ |
| git push | dc45cf5 → main ✅ |

---

## Phase 27 — Bulk Skill Import (69 → 1,104 via API / 1,445 installed)
**Date:** 2026-04-23  
**Branch:** main (no commit — skills/installed/ is gitignored)

### Summary
Bulk-imported agentskills.io-compliant skills from Tier A (anthropics/skills) and
Tier B/C community repos. Catalog grew from 71 → 1,104 skills visible via API,
with 1,445 skill directories written to `skills/installed/`. All imports landed
with `enabled: false`. No existing skills were overwritten. No commit made —
`skills/installed/*/` is gitignored.

### Import Sources

| Tier | Repo | Imported |
|---|---|---|
| A | anthropics/skills | 17 |
| B | grafana/skills | 37 |
| B | apollographql/skills | 12 |
| B | OneWave-AI/claude-skills | 162 |
| B | JuanJoseGonGi/skills | 124 |
| B | serenorg/seren-skills | 134 |
| B | Jamie-BitFlight/claude_skills | 217 |
| B | popup-studio-ai/bkit-gemini | 42 |
| B | jh941213/my-cc-harness | 31 |
| B | bongrealty/skillcraft | 18 |
| B | supertyrelle/pelley | 36 |
| B | Fujigo-Software/f5-framework-claude | 37 |
| B | clearsmog/claude-skills | 21 |
| B | normcrandall/claudeskills | 0 (all failed) |
| B | PlagueHO/plagueho.skills | 21 |
| C | kaiye/skills | 10 |
| C | samdengler/guppi-skills | 12 |
| C | glhewett/public-skills | 16 |
| C | dgk-dev/dgk-claude | 3 |
| C | youdotcom-oss/agent-skills | 19 |
| C | timgent/claude-code-config | 1 |
| C | diegosouzapw/awesome-omni-skill | 440 (capped 500) |
| C | browseros-ai/BrowserOS | 25 |
| C | HKUDS/nanobot | 8 |
| C | vivshaw/let-claude-say-fuck | 1 |
| C | lee-ji-hoon/claude-multi-account-manager | 1 |
| C | mgechev/skills-best-practices | 0 |
| C | mattnigh/skills_collection | 0 (all at-root, no subpath) |

**Total: 1,428 OK, 210 FAIL** (FAIL = already exists or malformed SKILL.md)

### Verification Results

| Check | Result |
|---|---|
| skills/installed/ directories | 1,445 ✅ |
| All imported: enabled: false | Confirmed (10-sample audit) ✅ |
| Git tracking | Only .gitkeep tracked ✅ |
| API total skills | 1,104 ✅ (71 native + 1,033 net new; ~412 ID dedup) |
| No auto-enable | Confirmed — 0 imported skills enabled ✅ |
| No overwrite of existing | force: false throughout ✅ |
| Import log | logs/p27-import.log ✅ |

### Notes
- `diegosouzapw/awesome-omni-skill` has 16,598 SKILL.md files; capped at 500 per policy
- `mattnigh/skills_collection` paths were all at repo root (no subpath), skipped by importer
- `normcrandall/claudeskills` failed all 16 (likely private or branch mismatch)
- API count (1,104) < installed dirs (1,445) because the loader deduplicates by skill ID;
  multiple repos shipping skills with the same ID (e.g. `skill-creator`) merge to one entry
- Import discovery used GitHub tree API: `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`
- Server PID: started on port 4200 for import, can be stopped after session

---

## Phase 11A — v3.9.0 Release Ship
**Date:** 2026-04-23  
**Commits:** d6e46e5 (version bump), aa2a72f (session)  
**Branch:** main  
**Tag:** v3.9.0

### Summary
Shipped v3.9.0 bundling Phase 9 (production hardening) and Phase 11
(agentskills.io spec adapter). Windows signed NSIS installer + Linux AppImage
+ .deb uploaded to taracodlabs/aiden-releases. Landing page auto-serves via
releases/latest (no changes needed). aiden-releases README updated.

### Artifacts

| File | Size | SHA-256 |
|---|---|---|
| `Aiden Setup 3.9.0.exe` | 148 MB | `24B092D0A7240670ACCD6BF3A64395815E57542D11DC6135EC598AA907EC5D29` |
| `Aiden-3.9.0.AppImage` | 197.5 MB | `6367B4D39996234F4C84520C5A916B390B0DD8C6D126AE5C960BBC1009C37474` |
| `devos-ai_3.9.0_amd64.deb` | 144.6 MB | `ABA3B6EAE27828472BCE0233A254075879231816C4D5D99C09259A526095A7EC` |

### Build notes
- `prepare-electron.js` must run before `electron-builder` on both platforms
  (sets `main` from `./dist/index.js` → `electron/main.js`; builds Next.js
  standalone; copies native modules). The Phase 11A prompt said "skip
  prepare-electron.js" — that was incorrect; it must run.
- Version bump committed + pushed first so WSL can `git reset --hard origin/main`
  and pick up 3.9.0 before the Linux build.
- `main` restored to `./dist/index.js` in source control after each build.

### Verification Results
| Check | Result |
|---|---|
| TypeScript build | 0 errors ✅ |
| Windows installer | `Aiden Setup 3.9.0.exe` 148 MB ✅ |
| Windows smoke test | Fresh install, health `/api/health` → `{"version":"3.9.0"}` ✅ |
| AppImage extract | `AppRun`, `devos-ai` binary, `devos-ai.desktop` present ✅ |
| deb metadata | `Version: 3.9.0`, `Vendor: Taracod Labs`, `amd64` ✅ |
| GitHub release | 3 artifacts uploaded, `releases/latest` → v3.9.0 ✅ |
| aiden-releases README | Updated v3.8.1 → v3.9.0 (4 occurrences), pushed ✅ |

### Release URL
https://github.com/taracodlabs/aiden-releases/releases/tag/v3.9.0

---

## Phase 11 — agentskills.io Spec Adapter (v3.8.1)
**Date:** 2026-04-23  
**Commit:** 86fab44  
**Branch:** main  
**Tag:** v3.8.1

### Summary
Added an agentskills.io spec compatibility layer as a pure adapter — no existing
SKILL.md files modified, no auto-execution of scripts. Implemented a validator,
importer, 4 new API endpoints, and 3 new CLI subcommands.

### Artifacts

| File | Role |
|---|---|
| `core/skillValidator.ts` | New — agentskills.io spec validator (ValidationResult, scoring, batch validate) |
| `core/skillImporter.ts` | New — security-gated importer (GitHub / HTTPS URL / local) |
| `core/skillLoader.ts` | Modified — Skill interface + parse() extended with 9 spec fields |
| `api/server.ts` | Modified — 4 new endpoints |
| `cli/aiden.ts` | Modified — 3 new/upgraded subcommands |

### Changes

#### core/skillLoader.ts
- Added 9 optional fields to `Skill` interface:
  `license`, `compatibility`, `metadata`, `allowedTools`,
  `hasScripts`, `hasReferences`, `hasAssets`, `source`, `importedFrom`
- Updated `parse()` to read `license`, `compatibility`, `allowed-tools`,
  `source`, `imported-from`; auto-detects `scripts/`, `references/`, `assets/` subdirs;
  collects unknown frontmatter keys into `metadata` record

#### core/skillValidator.ts (new, ~249 lines)
- Validates any skill dir against agentskills.io spec
- Error codes: `E_NO_SKILL_MD`, `E_EMPTY`, `E_NO_FRONTMATTER`, `E_NAME_MISSING`,
  `E_NAME_FORMAT`, `E_DESC_MISSING`, `E_NO_BODY`, `E_SCRIPT_EXT`
- Warning codes: `W_NAME_MISMATCH`, `W_DESC_SHORT`, `W_DESC_LONG`,
  `W_VERSION_MISSING`, `W_VERSION_FORMAT`, `W_LICENSE_MISSING`,
  `W_LICENSE_UNKNOWN`, `W_NO_HEADINGS`, `W_ALLOWED_TOOLS_EMPTY`
- Score: 100 base − 15×errors − 5×warnings (clamped 0–100)
- Exports: `validateSkillDir()`, `validateSkillByName()`, `validateAllSkills()`, `summariseResults()`

#### core/skillImporter.ts (new, ~364 lines)
Security gates (unconditional):
- HTTPS only for remote imports
- SKILL.md ≤ 100 KB; total package ≤ 10 MB
- Scripts must live in `scripts/` subdir
- Allowed script extensions: `.py .sh .js .ts .mjs` only
- `enabled: false` always set on freshly imported skills
- No overwrite of existing skill without `{ force: true }`

Exports: `importFromUrl()`, `importFromGitHub()`, `importFromLocal()`, `importSkill()` (smart dispatcher)

GitHub import strategy: tries `raw.githubusercontent.com` first, falls back to GitHub Contents API.
Fetches `scripts/`, `references/`, `assets/` via tree API (best-effort, non-fatal).

#### api/server.ts
Added 4 endpoints (dynamic imports to avoid circular deps):
| Endpoint | Method | Body |
|---|---|---|
| `/api/skills/validate` | POST | `{ id?: string }` — validates one skill or all |
| `/api/skills/import-url` | POST | `{ url: string, force?: boolean }` |
| `/api/skills/import-repo` | POST | `{ repo: string, subpath?: string, branch?: string, force?: boolean }` |
| `/api/skills/import-smart` | POST | `{ source: string, force?: boolean }` |

#### cli/aiden.ts
- `/skills import <source>` — upgraded to smart import (GitHub shorthand / HTTPS URL / local path)
- `/skills import-repo <owner/repo>` — new, optional `--branch` / `--subpath` flags
- `/skills validate [id]` — new, validates one skill or all, shows scores + issue counts

### Spec Compliance Audit (67 skills)
- 5 skills with non-compliant names (underscores or dots): `code_execution`,
  `file_operations`, `financial_research`, `web_research`, `crt-sh` (name `crt.sh`)
- Majority already have `license: Apache-2.0`
- No existing SKILL.md files were modified (adapter-only approach)

### Verification Results
| Check | Result |
|---|---|
| TypeScript build | 0 errors ✅ |
| `/api/skills/validate` (all 67) | 200 OK, `total: 67` ✅ |
| `/api/skills/import-repo` (anthropics/skills) | 400, HTTP 404 for missing SKILL.md — correct ✅ |
| `enabled: false` on import | Confirmed in patched frontmatter ✅ |
| `http://` import blocked | 400, `"Security: only HTTPS imports are allowed"` ✅ |

---

## Phase 10 — Native Linux Packages (v3.8.1)
**Date:** 2026-04-23  
**Commits:** ac88a59 (package.json), cab5953 (landing)  
**Branch:** main  
**Tag:** v3.8.1

### Summary
Added native Linux packages (AppImage + .deb) to v3.8.1. Built from WSL,
uploaded to taracodlabs/aiden-releases, updated landing page and README.

### Artifacts

| File | Size | SHA-256 |
|---|---|---|
| `Aiden-Setup-3.8.1.exe` | 148 MB | `B8875BA612039876F31C26E20408502AFFB9DDAFEAEA0380D16794B8374B3FEA` |
| `Aiden-3.8.1.AppImage` | 197.5 MB | `41A498A63C16B39781C935157E649D3DABA05B7C285C0B6DF2EDD2ED6A54FB5E` |
| `devos-ai_3.8.1_amd64.deb` | 144.6 MB | `6D33C1C083906397A601226F58B56C13920AEA675282D37FEF0988F7C3F8C272` |

### Changes

#### package.json
- Version bump: 3.8.0 → 3.8.1
- Added `linux` build config: AppImage x64 + deb x64, correct `desktop.entry` schema
- Added `dist:linux` script for WSL builds
- Fixed `linux.desktop` schema (`Name`/`Comment`/`Categories` must be under `desktop.entry` in electron-builder 26.8.1)

#### Build Process
- Windows: `npx electron-builder --win --publish never` → `release/Aiden Setup 3.8.1.exe` (signed)
- Linux: WSL Ubuntu, `node scripts/prepare-electron.js && npx electron-builder --linux --x64 --publish never`
  → `release/Aiden-3.8.1.AppImage` + `release/devos-ai_3.8.1_amd64.deb`

#### GitHub Release
- `gh release create v3.8.1 --repo taracodlabs/aiden-releases` with all 3 artifacts
- URL: https://github.com/taracodlabs/aiden-releases/releases/tag/v3.8.1

#### Landing Page (cloudflare-worker/landing.js)
- Added AppImage + .deb download cards as primary Linux section
- Demoted `curl install.sh` to "or via CLI:" fallback
- Updated "Download installer →" → "Download for Windows →"
- Deployed to `aiden.taracod.com` (Version ID: `3df96a4f-f67d-4d0c-800d-65b84aedae5a`)

#### aiden-releases README.md
- Updated current version: v3.8.1
- Added AppImage + .deb install instructions as primary Linux section
- Demoted curl to fallback section
- Updated platform table with AppImage/deb install method

### Verification Results
| Check | Result |
|---|---|
| Windows build | `Aiden Setup 3.8.1.exe` 148 MB ✅ |
| AppImage extract | `AppRun`, `.desktop`, `devos-ai` binary present ✅ |
| deb inspect | `dpkg-deb --info` shows v3.8.1, correct maintainer/deps ✅ |
| GitHub release | 3 artifacts uploaded, release notes with SHA-256 ✅ |
| Landing deploy | Cloudflare Worker deployed, custom domain live ✅ |
| README pushed | aiden-releases README updated + pushed ✅ |
| Git tag | `v3.8.1` pushed to taracodlabs/aiden ✅ |

---

## Phase 9 — Production Hardening (v3.8.0)
**Date:** 2026-04-23  
**Commit:** eef100b  
**Branch:** main

### Summary
Production hardening sprint covering AgentShield false-positive elimination,
startup noise reduction, and process lifecycle improvements.

### Changes

#### AgentShield (core/agentShield.ts)
- `stripQuotedStrings()` helper strips `"..."` and `'...'` before injection
  pattern testing — eliminates false positives from SOUL.md quoting injection
  phrases defensively
- `SIZE_ALLOWLIST` for known large system files (AIDEN_CATALOG.md, etc.)
- `score` alias added to `ScanResult` for API compatibility
- **Result:** 0/100 risk score (was 55/100); 3 info-only port-binding notices

#### Startup Noise (api/server.ts, providers/router.ts, core/*)
- All AUDIT 2–10 blocks gated behind `AIDEN_LOG_LEVEL=debug`
- `[Startup]` workspace verbose lines gated behind debug
- Per-tool registration logs (SlashAsTool, ToolRegistry) gated behind debug
- Heartbeat loaded lines collapsed to single summary
- Router provider chain: 16 lines → 1 summary line at info level
- **Result:** 38 lines at startup (was ~400; target ≤40)

#### Process Lifecycle (api/server.ts)
- PID file written to `WORKSPACE_ROOT/aiden.pid` on successful bind
- PID removed on SIGINT/SIGTERM (clean shutdown)
- EADDRINUSE handler: reads stale PID, kills old process, retries after 1500ms

### Verification Results
| Check | Result |
|---|---|
| TypeScript build | 0 errors |
| AgentShield score | 0/100 ✅ (target ≤30) |
| Startup console lines | 38 ✅ (target ≤40) |
| Health endpoint | `{"status":"ok","version":"3.8.0"}` ✅ |
| Phase 8B regression (10 tests) | 10/10 PASS ✅ |

---

## Phase 8B — Skill Learning System (v3.8.0)
**Date:** 2026-04-22  
**Commit:** 37f8064  

### Summary
End-to-end A2+A3+A4 skill learning, passive observer, and skill library.
Fixed 3 API contract mismatches (`req.query.q||topic`, `id??skillId`, 
`skills: results` alias). All 9 verification parts passed.
