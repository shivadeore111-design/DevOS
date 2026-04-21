## v3.7.1 — 2026-04-21

**Patch release.** Four desktop stability fixes identified after v3.7.0 shipped.

### Bug Fixes

- **fix(desktop):** BrowserWindow URL changed from `localhost:3000` to
  `127.0.0.1:3000` — Windows 11 22H2+ resolves `localhost` to IPv6 `::1` while
  the dashboard server binds IPv4 only, causing a black screen on every launch
- **fix(desktop):** Port 3000 is now freed before `startDashboard()` — a stale
  dashboard process from a previous session held the port, crashing the app with
  `EADDRINUSE` on the second launch
- **fix(desktop):** API server spawn `cwd` changed from `USER_DATA` (AppData) to
  the DevOS repo root — skills, `.env`, and `SOUL.md` were resolved relative to
  AppData instead of the project directory, resulting in 0 skills loaded in
  Electron mode
- **fix(dashboard):** Static assets (CSS / JS / fonts) now copied into the
  Next.js standalone tree via a `postbuild` npm hook — the standalone server
  served HTML but every `/_next/static/*` request returned 404

---

## v3.7.0 — 2026-04-18

**The Desktop-Primary release.** Desktop app is now the primary Aiden experience.
The `aiden tui` launcher shortcut is removed pending a proper single-command
terminal launcher in v3.8. TUI usage is documented via `npm start` +
`npm run cli`.

### Changes

- **Desktop app promoted to primary** — `aiden pc` launches the full Electron UI;
  `aiden` / `aiden help` shows updated help pointing to `aiden pc`
- **`aiden tui` shortcut removed** — the ELECTRON_RUN_AS_NODE node-mode branch
  is stripped from `electron/main.js`; TUI launch instructions added to README
  and `aiden help` output
- **README: Running Aiden section** — documents desktop and TUI launch paths,
  including `npm start` + `npm run cli` workflow

---

## v3.6.0 — 2026-04-18

**The Scale release.** Aiden is now feature-competitive with leading AI agents:
9 communication channels, 52 shipping skills across 12 categories, voice as a
first-class tool namespace, 4 new core tools, Windows shell wedges, a native MCP
client, and a frictionless one-liner install — all local, private, and free to
self-host.

### Headlines

- **Voice as first-class tools** — `voice.speak`, `voice.transcribe`,
  `voice.clone`, `voice.design` wired as agent tools; VoxCPM2 voice synthesis
  and cloning; full waterfall fallback chain
- **4 new core tools** — `clarify` (multi-choice mid-task clarification), `todo`
  (per-session task lists + `/todo` CLI), `cronjob` (scheduled tasks + `/cron`
  CLI), `vision_analyze` (image analysis via provider vision APIs)
- **5 new channel adapters** — WhatsApp, Signal, SMS/Twilio, iMessage, Email →
  9 total communication surfaces
- **32 new skills** across 6 categories (productivity, developer workflow,
  research, creative, media/gaming, agent bridge) → **52 shipping skills total**
- **One-liner install** — `iwr https://aiden.taracod.com/install.ps1 -useb | iex`;
  single-word `aiden` launcher on PATH; winget + scoop manifests ready
- **Windows shell wedges** — `/cmd`, `/ps`, `/wsl` as first-class tools and
  agent tools
- **Native MCP client** — register, manage, and invoke MCP servers + `/mcp` CLI
- **Electron auto-updates** — silent background download + restart prompt;
  `/refresh` force-check command
- **Community contribution ready** — 56 SKILL.md files licensed Apache-2.0;
  CONTRIBUTING.md, CLA, skill template, and migration manifest all prepared for
  aiden-skills public repo launch
- **Self-testing harness** — 148/148 passing across 17 suites (13 new suites
  added this sprint)

### New features

**Voice Tools (VoxCPM2)**
- `voice.speak(text, opts?)` — TTS with provider waterfall (VoxCPM2 → ElevenLabs
  → Edge TTS → Windows SAPI) as agent tool (`feat(prompt-21)`)
- `voice.transcribe(audioPath)` — STT via Groq → OpenAI → local Whisper.cpp
  as agent tool (`feat(prompt-21)`)
- `voice.clone(sourceAudio, text)` — voice cloning via VoxCPM2 fine-tuning
  (`feat(prompt-21)`)
- `voice.design(prompt)` — generative voice design from text description
  (`feat(prompt-21)`)
- `/voice on|off|status` CLI; `VOXCPM_SETUP.md` setup guide (`docs(prompt-21)`)

**New Core Tools**
- `clarify` — structured mid-task clarification: agent presents N choices, waits
  for user selection, resumes (`feat(tools)`)
- `todo` — per-session task list: add, check, list, clear — agent tool + `/todo`
  CLI (`feat(tools)`)
- `cronjob` — first-class scheduled tasks: create, list, pause, delete — agent
  tool + `/cron` CLI (`feat(tools)`)
- `vision_analyze` — image analysis via GPT-4o Vision, Claude Vision, Gemini
  Vision (`feat(tools)`)
- Aiden SDK extended: `aiden.clarify`, `aiden.todo`, `aiden.cron`,
  `aiden.vision` namespaces (`feat(sdk)`)

**Skills — Wave 2 (32 new skills)**

*Productivity (7):* Obsidian vault search/write, Notion database CRUD, Google
Workspace (Docs/Sheets/Gmail), Linear issue tracker, OCR + document parsing,
Nano PDF reader, Excalidraw diagram generation

*Developer Workflow (8):* Jupyter notebook execution, Docker container
management, GitHub auth/issues/PRs/repo management, AI-assisted debugging,
TDD workflow automation

*Research (4):* arXiv paper search, YouTube content analysis, blog watcher,
research paper writing assistant

*Creative (4):* Architecture diagrams (C4/Mermaid), ASCII art generator, Stable
Diffusion image generation, p5.js creative coding

*Media / Gaming / Social / Smart-Home (6):* GIF search (Tenor), song recognition
(SongSee), Minecraft server management, Pokémon automation, OpenHUE smart
lighting, X (Twitter) posting

*Agent Bridge (3):* Claude Code integration, OpenAI Codex bridge, OpenCode
bridge — delegate sub-tasks to other coding agents

**Channel Adapters — Wave 2 (5 new)**
- **WhatsApp** — web client bridge + optional Business API; allowlist +
  inbound/outbound (`feat(channels)`)
- **Signal** — signal-cli REST bridge; relay + allowlist (`feat(channels)`)
- **SMS/Twilio** — inbound webhook + outbound API; 160-char chunking +
  allowlist (`feat(channels)`)
- **iMessage** — BlueBubbles REST bridge; WebSocket inbound + allowlist
  (`feat(channels)`)
- **Email** — IMAP polling + SMTP replies; loop prevention + sender allowlist
  (`feat(channels)`)
- `ChannelManager` extended to 9 adapters; `ChannelStatus` shape expanded
  (`feat(channels)`)

**Install Experience**
- Single-word `aiden` launcher — shim for CMD + Bash; no `npx` required
  (`feat(install)`)
- PowerShell one-liner — downloads and runs installer in one command
  (`feat(install)`)
- `/install.ps1` route added to Cloudflare Worker (`feat(install)`)
- winget manifest — `Taracod.Aiden` package; installer + locale manifests;
  submission-ready (`feat(packaging)`)
- Scoop manifest — `taracod` bucket + `aiden.json`; bucket instructions
  (`feat(packaging)`)
- README expanded with all 4 install paths (`docs`)

**Windows Shell Wedges**
- `/cmd`, `/ps` (PowerShell), `/wsl` — CLI commands + agent tools
  (`feat(shell)`)
- `aiden.shell` SDK namespace with wedge-specific methods (`feat(sdk)`)

**Native MCP Client**
- Register and manage MCP servers via `~/.aiden/mcp.json` (`feat(mcp)`)
- `/mcp list|add|remove|call` CLI (`feat(mcp)`)
- MCP tools injected into agent registry at session start (`feat(mcp)`)
- `aiden.mcp` SDK namespace for programmatic server calls (`feat(sdk)`)

**Electron Auto-Updates**
- Background download on startup; prompts to restart when ready (`feat(update)`)
- `/refresh` — force-check for updates (`feat(update)`)
- IPC wiring between main and renderer for update state (`feat(update)`)

**Community Skills Foundation**
- Apache-2.0 applied to all 56 SKILL.md files (52 shipping + 4 infrastructure)
  (`chore(skills)`)
- `CONTRIBUTING.md` — guide for `aiden-skills` community repo (`docs`)
- `SKILL_TEMPLATE.md` — canonical template for skill authors (`feat(skills)`)
- CLA text + PR bot config prep (`chore`)
- `skills-manifest.json` — repo migration map (`docs`)

### Fixes

- `fix(skills)` — remove hardcoded Tenor API key from `gif-search/SKILL.md`;
  replaced with `$env:TENOR_API_KEY` / `os.environ.get("TENOR_API_KEY")`
- `fix(test)` — prompt_17 voice test aligns with public SDK (`voice.speak` not
  internal `synthesize`)
- `fix(skills)` — cleanup 17 blocked + 9 duplicate skills; harden skill
  auto-generation pipeline

### Internal

- **Testing:** 13 new audit suites added (`prompt_14` through `prompt_23`,
  `prompt_r2`, `prompt_r3`); 148/148 total passing across 17 suites
- **Docs:** `VOXCPM_SETUP.md`, `GATE_v3.6.0.md` launch gate report,
  skills migration manifest
- **Chore:** Version bumped to 3.6.0 across `package.json`, `cli/aiden.ts`,
  `README.md`, `packaging/`, `cloudflare-worker/landing.js`; `.wrangler/`
  added to `.gitignore`

---

## v3.5.0 — 2026-04-18

**The ▲IDEN release.** Aiden matures from v3.1.0's foundation into a full-featured AI OS with 60+ new commands, a complete visual rebrand, a mature architecture competitive with the best agents on the market, and a self-testing reliability harness.

### Headlines

- **▲IDEN visual rebrand** — orange triangle mark, boxed panels, cohesive theme system across TUI and dashboard
- **New `▲ run` tool** — compound tasks execute in a single LLM call via injected Aiden SDK (beats plain-stdlib sandbox patterns)
- **New `▲ spawn` subagent primitive** — isolated context, inherited provider chain, iteration budget sharing
- **New `▲ swarm` parallel subagents** with vote/merge/best voting strategies
- **New `▲ search` hybrid session search** — BM25 full-text + semantic memory weighted merge (0.6 semantic / 0.4 FTS)
- **Multi-goal decomposition** — no more half-answers when users ask multiple things
- **Private mode** — `/private` suppresses memory writes for sensitive turns
- **Prompt caching infrastructure** — 40% faster turns on Anthropic with cache breakpoints on SOUL + standing orders + tools
- **LESSONS.md moat surfaced** — `/lessons` browser + `/teach` for manual rule authoring
- **Provider reliability** — exponential backoff recovery (30s→5min), HTTP keepalive, fast-path expansion for 60%+ of messages
- **Self-testing harness** — 34 zero-cost audits across 4 suites via `npm run test:audit`

### New commands (60+)

**Session management:** `/log` `/save` `/rerun` `/name` `/stack` `/halt` `/yolo` `/attach` `/changelog` `/export` `/fork` `/checkpoint` `/reset` `/history` `/sessions`

**Aiden-exclusive intelligence:** `/lessons` `/teach` `/rewind` `/pin` `/focus` `/explore` `/pulse` `/diff` `/trust` `/timeline` `/garden` `/decision` `/private` `/primary` `/quick` `/async` `/compact`

**Delegation & search:** `/spawn` `/swarm` `/search` `/run`

**Developer tools:** `/kit` `/tools` (category-grouped with icons) `/skills` (13 subcommands: search, install, list, check, update, audit, remove, publish, export, import, source, stats, recommend) `/security` `/debug` `/budget` `/analytics`

**UI & config:** `/theme` `/persona` `/detail` `/depth` `/provider` `/providers` `/models` `/model` `/workspace` `/recipes`

### New features

**▲IDEN Visual System**
- Unified theme tokens — orange `#FF6B35` accent, triangle `▲` mark, shared across TUI and dashboard (`feat(theme)`)
- `▲IDEN` banner — orange block wordmark, capability flex, live status dots (`feat(tui)`)
- Boxed panel renderer — `/tools` with category tables, accent borders, icon groups (`feat(tui)`)
- Live status bar — provider · model · context % · elapsed · async count (`feat(tui)`)
- Fuzzy tab-completion + `/help <command>` detail cards + `/help` search (`feat(tui)`)
- Triangle pulse spinner, animated ✓/✗, update-available check in banner (`feat(tui)`)

**▲ run / ▲ spawn / ▲ swarm / ▲ search**
- `▲ run` sandbox with full Aiden SDK injected — `aiden.web`, `aiden.file`, `aiden.shell`, `aiden.browser`, `aiden.screen`, `aiden.memory`, `aiden.system`, `aiden.git`, `aiden.data` (`feat(run)`)
- `/run` CLI command, example scripts library, `/run help [namespace]` SDK reference (`feat(run)`)
- `▲ spawn` — isolated subagent with empty history, inherited provider chain, `floor(remaining/2)` budget cap (`feat(spawn+swarm)`)
- `▲ swarm` — N parallel spawns via `Promise.allSettled`, vote/merge/best aggregation strategies (`feat(spawn+swarm)`)
- `▲ search` — BM25 (k1=1.5 b=0.75) index over `workspace/sessions` + `workspace/memory`, hybrid scoring with semantic memory at 0.6 weight (`feat(search)`)

**Orchestration & Delegation**
- Multi-agent parallel execution — independent plan steps run simultaneously (`feat`)
- Multi-goal intent decomposition — planner lists all goals, validator catches misses, numbered output (`feat`)
- Slash commands mirrored as agent tools — unified CLI + agent surfaces (`feat`)
- Fuzzy tool name auto-repair — silent recovery from LLM hallucinated tool names (`feat`)
- Async background tasks — run prompts without blocking, notify on completion (`feat`)
- Iteration budget — pressure warnings at 70% and 90% usage (`feat`)
- Interruptible execution — stop button cancels in-flight API calls and tool runs (`feat`)

**Speed & Reliability**
- HTTP keepalive per provider — eliminates cold-connect latency on every call (`feat(speed)`)
- Prompt caching — Anthropic cache breakpoints on SOUL + standing orders + tools list (`feat(speed)`)
- Fast-path expanded to 60%+ of messages; Ollama demoted to true-fallback (`feat(speed)`)
- Stream-first responses — first token appears immediately, blank wait eliminated (`feat`)
- Greeting fast-path surfaces memory — continuity from turn 1 without full agent loop (`feat`)
- Session resume — `--continue` and `--resume` flags restore previous context (`feat`)
- Token-based preflight compression — auto-compress at 50% context usage (`feat`)

**Provider & Routing**
- Configurable primary provider + `/api/providers/state` endpoint + `/primary` CLI (`feat(router)`)
- Universal custom providers — any OpenAI-compatible endpoint registers as a provider (`feat`)
- BOA provider — multi-cloud API gateway with full endpoint mapping (`feat`)
- Exponential backoff recovery — 30s→5min half-open retry for failed providers (`fix(router)`)
- JSON repair fallback — recover non-JSON planner responses instead of retrying (`fix(planner)`)

**Memory & Knowledge**
- `LESSONS.md` — permanent failure rules, auto-appended, injected every session (`feat`)
- `/lessons` browser with search + `/teach` for manual rule authoring (`feat(lessons)`)
- Private mode — per-turn and per-session memory opacity toggle (`feat`)
- `/garden` memory layer explorer — inspect what Aiden knows and from where (`feat(tui)`)
- Session lineage — track parent/child relationships across compressions (`feat`)
- Compaction protection — SOUL, rules, and goals survive context reset (`feat`)
- YouTube transcript ingestion — extract and store in Knowledge Base (`feat`)

**Platform & Integrations**
- Telegram bot integration — chat with Aiden from your phone (`feat`)
- Calendar and Gmail tools — iCal event reading + email foundation (`feat`)
- OpenAI-compatible API endpoint — VS Code, Cursor, and JetBrains extensions can treat Aiden as a local model (`feat`)
- Cross-channel dispatch — start on Telegram, continue on desktop (`feat`)
- Unified gateway — single router for all channels (`feat`)
- Plugin system — community extensions with tool and hook registration (`feat`)
- Formal callback system — typed events for all platforms (`feat`)
- Import from ChatGPT and OpenClaw — migrate conversation history (`feat`)
- Recipe engine — YAML workflow definitions with typed params and retry (`feat`)
- Conversation export — download as Markdown or JSON (`feat`)
- AgentShield — security scanner for skills, configs, and identity (`feat`)
- Browser profile isolation — agent cannot access user cookies (`feat`)
- Shell command allowlist — unknown commands blocked by default (`feat`)
- Expanded skill injection defense — structural validation + 25 new patterns (`feat`)
- Live debug panel with log buffer and system health (`feat`)

**Skills Lifecycle**
- Full 13-subcommand lifecycle: search, install, list, check, update, audit, remove, publish, export, import, source, stats, recommend (`feat(skills)`)
- `▲IDEN` Skill Store — tabular browse, detail cards, orange source badges (`feat(tui)`)
- Skills manager in dashboard — view, enable/disable, delete (`feat`)

**Dashboard**
- Usage dashboard — cost and tool analytics in Settings (`feat`)
- Session history in sidebar — see past conversations (`feat`)
- Thinking indicator — shows planning/executing/reasoning stages (`feat`)
- One-command release script — `npm run release <version>` (`feat`)
- Auto-detect timezone during onboarding (`feat`)
- Graceful degradation — friendly message when all providers down (`feat`)
- Auxiliary LLM client — cheap model for side tasks (memory, dreams, compression) (`feat`)
- 15 instant actions — open apps, play music, volume control, screenshot, timer, system control (`feat`)

### Fixes

- `fix(panel)` — unified panel width: title, body, and borders all align
- `fix(router)` — add BOA endpoint to all `ENDPOINTS` maps in server.ts
- `fix(api)` — `/api/config/primary` accepts both `name` and `provider` fields
- `fix(chat)` — status fast-path bypasses agent loop for session/system status queries
- `fix(tools)` — introspection category + classifier routes self-queries to slash-mirror tools
- `fix(fastpath)` — greeting preamble wired; bypasses planner for instant response
- `fix(help)` — rename Hermes→Core in help panels; tag unimplemented commands
- `fix(skills)` — `/skills recommend` works with no args, infers from history
- `fix(skills)` — Source column shows origin (aiden/community/local), not approval state
- `fix(rewind)` — `/rewind` alone undoes last exchange, no mark required
- `fix` — planner rotation now walks full provider chain (groq→gemini→openrouter→boa)
- `fix` — BOA provider base URL + model selection corrected
- `fix` — TUI connection match with `api/server.ts` chat endpoint format
- `fix` — TUI unicode rendering, empty greeting, `/model` alias
- `fix` — 7 test failures resolved: missing routes, debug log format, tool registry
- `fix` — exclude current process from node kill in release script
- `fix` — React.* type refs replaced with direct named imports in page.tsx
- `fix` — stale SkillsView reference replaced with SkillsManager in CHANNEL_CONFIG

### Internal

- **Testing:** Added 26 automated zero-cost audits across 3 suites (`prompt_11`, `prompt_12`, `prompt_13`) covering aidenSdk, runSandbox, toolRegistry, spawnManager, swarmManager, sessionSearch, hybridSearch
- **Docs:** `SESSION_RULES.md` — working rules for Claude Code on Aiden; `CLAUDE.md`, `.graphifyignore`, `workspace-templates/`
- **Chore:** Gitignore cleanup — `dist/`, `dist-bundle/`, `.claude/worktrees/`, `config/hardware.json` untracked from index; runtime source sync

---

**Total: 102 commits since v3.1.0.**

Full commit list: [v3.1.0...v3.5.0](https://github.com/taracodlabs/aiden/compare/v3.1.0...v3.5.0)
