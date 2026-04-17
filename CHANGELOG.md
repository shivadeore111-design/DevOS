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

Full commit list: [v3.1.0...v3.5.0](https://github.com/shivadeore111-design/DevOS/compare/v3.1.0...v3.5.0)
