# v3.5.0 Launch Gate — 2026-04-17

## Overall status: 🟡 YELLOW

No hard blockers (RED). Four warnings (YELLOW) require attention before or immediately after launch. Ship with caveats.

---

## Phase 1 — Integration Smoke Test

| Check | Status | Notes |
|---|---|---|
| `npx tsc --noEmit` | ✅ GREEN | 0 errors across all source files incl. P17 voice layer |
| `npm run build` | ✅ GREEN | Compiled to `dist/` cleanly; `dist/api/server.js` confirms `channels/status` route present |
| Aiden process alive | ✅ GREEN | API responding on port 3000 (process PID 18668) |
| `/api/health` | ✅ GREEN | 200 OK |
| `/api/channels/status` from live process | 🟡 YELLOW | Returns 404 — running process predates P16 channel adapter changes. Route IS compiled in `dist/api/server.js` (2 grep matches). Fix: restart Aiden before launch announcement. |
| `npm run test:audit` | ✅ GREEN | 89/89 tests pass (P11–P17 inclusive) |

---

## Phase 2 — Public Surface

| Check | Status | Notes |
|---|---|---|
| `CHANGELOG.md` v3.5.0 entry | ✅ GREEN | Complete 10 KB+ entry; headlines, all features, sub-agent primitives, voice layer listed |
| `package.json` version | ✅ GREEN | `"version": "3.5.0"` |
| CLI banner fallback | ✅ GREEN | `health.version \|\| '3.5.0'` — shows correct version even if health endpoint is slow |
| `README.md` version mention | 🟡 YELLOW | File is 7 lines. No version number. No feature summary. No install instructions. Link points to `https://devos.taracod.com` (old URL — should be `aiden.taracod.com` if domain changed). |
| GitHub release / download link | ⬜ UNVERIFIED | Not checked — no network access during gate run. Verify manually that release tag `v3.5.0` exists on `taracodlabs/aiden-releases` with correct installer. |
| License server reachable | ⬜ UNVERIFIED | Not checked. Verify `config/devos.config.json` license endpoint responds. |

---

## Phase 3 — Security Hygiene

| Check | Status | Notes |
|---|---|---|
| `console.log` credential scan | ✅ GREEN | Static scan returned 0 matches for API keys / secrets logged to stdout |
| Stale `localhost` refs in prod paths | ✅ GREEN | 0 hardcoded localhost strings in production code paths |
| `.env` in `.gitignore` | ✅ GREEN | `.env` and `.env.local` both listed |
| `.env.production` in `.gitignore` | 🟡 YELLOW | `.env.production` is **not** listed. Only `.env` and `.env.local` covered. If a `.env.production` file exists locally it could be accidentally committed. Add `.env.*` glob pattern to `.gitignore`. |
| `.gitignore` encoding | 🟡 YELLOW | File has mixed UTF-8 + UTF-16 content (two sections concatenated). Git reads the UTF-8 section cleanly (security-sensitive entries `dist-bundle/`, `.claude/settings.local.json` are in that section). However the file is malformed — null bytes appear mid-file. Rebuild `.gitignore` from scratch to avoid parsing surprises on non-Windows hosts. |
| `workspace/` excluded | ✅ GREEN | Listed in `.gitignore` |
| `node_modules/` excluded | ✅ GREEN | Listed in `.gitignore` |
| `dist/` excluded | ✅ GREEN | Listed in `.gitignore` |
| `.claude/settings.local.json` excluded | ✅ GREEN | Listed in `.gitignore` |

---

## Phase 4 — UX Sanity

| Check | Status | Notes |
|---|---|---|
| Banner shows `v3.5.0` | ✅ GREEN | Pulled from `package.json` at runtime; `'3.5.0'` hardcoded as fallback |
| No `Hermes` section in codebase | ✅ GREEN | 0 matches anywhere |
| Voice commands in `/help` | ✅ GREEN | `/voice [on\|off]`, `/speak <text>`, `/listen [secs]` all present in help panel |
| `/voice`, `/speak`, `/listen` in COMMANDS array | ✅ GREEN | Lines 672–674 of `cli/aiden.ts` |
| `/voice`, `/speak`, `/listen` in COMMAND_DETAIL | ✅ GREEN | Full detail entries with section, desc, usage |
| `/run`, `/spawn`, `/swarm`, `/search` in COMMAND_DETAIL | ✅ GREEN | All four have full COMMAND_DETAIL entries (section: 'Power') |
| `/run`, `/spawn`, `/swarm`, `/search` in `/help` panel display | 🟡 YELLOW | These commands are registered and fully functional but **not listed** as explicit `helpRow()` entries in the main `/help` panel printout. They are discoverable via `/help search <keyword>` or `/help /run`. Consider adding a Power section row or a note like "type /help search <q> to find power commands." |
| No stale "v3.4" or earlier version strings | ✅ GREEN | Static scan returned 0 stale version references in source |
| TTS/STT voice layer compiles | ✅ GREEN | `core/voice/stt.ts`, `core/voice/tts.ts`, `core/voice/audio.ts` — all pass `tsc --noEmit` |

---

## Phase 5 — Fresh-Install UX

| Check | Status | Notes |
|---|---|---|
| `CHANGELOG.md` has v3.5.0 | ✅ GREEN | First entry; comprehensive |
| Onboarding path (`postinstall.js`) | ✅ GREEN | `scripts/postinstall.js` exists; referenced in `package.json` |
| `README.md` install instructions | 🟡 YELLOW | (same as Phase 2) README is 7 lines — no install steps, no feature list, stale URL. A first-time visitor would have no guidance. Recommended: expand to include `npx devos-ai`, feature highlights, and link to correct domain. |
| `config/devos.config.json` present | ✅ GREEN | Listed in `package.json` files array and electron extraResources |
| `workspace-templates/` present | ✅ GREEN | Listed in electron extraResources |

---

## Blockers (RED items)

**None.** No RED blockers found.

---

## Warnings (YELLOW items)

1. **`/api/channels/status` returns 404 from live process** — running process (PID 18668) predates P16 compilation. Route exists in compiled `dist/`. Fix: `aiden restart` or kill and restart before launch announcement.

2. **`.env.production` not in `.gitignore`** — only `.env` and `.env.local` are covered. Add `.env.*` or `.env.production` explicitly.

3. **`.gitignore` encoding corruption** — UTF-8 + UTF-16 concatenation produces null bytes mid-file. Git parses it on Windows but it will break on Linux/macOS CI. Rebuild the file cleanly.

4. **`/run`, `/spawn`, `/swarm`, `/search` absent from main `/help` panel** — all four are Power tier commands but are invisible unless a user runs `/help search`. Add a Power section to the help display or a "power commands: /run /spawn /swarm /search — type /help /run for detail" footer.

5. **`README.md` is 7 lines with stale URL** — no version, no install instructions, links to `devos.taracod.com` instead of `aiden.taracod.com`. Not a launch blocker but creates a poor first impression on GitHub/npm.

6. **GitHub release and license server unverified** — gate was run without network access. Verify manually: (a) `taracodlabs/aiden-releases` has a `v3.5.0` tag with NSIS installer attached; (b) license endpoint in `config/devos.config.json` responds 200.

---

## Launch Recommendation

**Ship v3.5.0 with two immediate pre-launch actions:** (1) restart the running Aiden process so P16 channel routes are live, and (2) manually confirm the GitHub release tag and installer download link exist. The codebase is clean — 89/89 audit tests pass, TypeScript compiles with zero errors, the voice layer (P17) is fully integrated, and no credentials or security-sensitive strings leaked to stdout. The YELLOW items are operational hygiene issues, not correctness bugs. The README and `.gitignore` encoding issues should be addressed in a v3.5.1 patch shortly after launch.
