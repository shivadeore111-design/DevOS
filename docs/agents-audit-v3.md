# agents-audit-v3 — five new dimensions

This v3 builds on `HERMES_AUDIT_v2.md`. v2 covered the agent loop, tool registry, toolset distributions, parallel-tool policy, MCP, skills auto-creation, memory layers, trajectory compression, ACP, honcho, cron, environments backends, RL pipeline, gateway adapters at high level, mini-swe-agent wiring, and the config system. None of those are repeated here.

Hermes clone path: `C:/Users/shiva/AppData/Local/Temp/hermes` (already present, submodules already initialised — no re-clone). Aiden tree: `C:\Users\shiva\DevOS` (v3.17.0).

---

## 1. CLI / TUI deep dive

### 1.1 Hermes prompt_toolkit autocomplete pipeline

Hermes' classic interactive shell is `cli.py` (11 483 lines) at the repo root, built on prompt_toolkit's full `Application` layout:

- `cli.py:44-57` — imports `Application`, `Layout`, `HSplit`, `Window`, `FormattedTextControl`, `ConditionalContainer`, `CompletionsMenu`, `TextArea`, `KeyBindings`, plus `cursor_shapes.CursorShape.BLOCK` for a non-blinking block cursor.
- `cli.py:658` — `from hermes_cli.commands import SlashCommandCompleter, SlashCommandAutoSuggest`. Both are wired into a single `TextArea`-based input region.
- `cli.py:10114` — `_completer = SlashCommandCompleter(...)` is constructed once per session and passed both the runtime skill-command provider (so plugin- and skill-registered commands appear) and a `command_filter` callable that hides gateway-only commands when running CLI-only.

The completer itself lives in `hermes_cli/commands.py`:

- `hermes_cli/commands.py:59-188` — `COMMAND_REGISTRY: list[CommandDef]` is the single source of truth. Each `CommandDef` (dataclass at line 40) carries `name`, `description`, `category`, `aliases`, `args_hint`, `subcommands`, `cli_only`, `gateway_only`, `gateway_config_gate`. The same registry feeds CLI completion, gateway help text, Telegram BotCommands, Slack subcommand mapping, and ACP's `_ADVERTISED_COMMANDS`.
- `hermes_cli/commands.py:991` — `class SlashCommandCompleter(Completer)` (the prompt_toolkit base). Constructor stores a `skill_commands_provider` callable + `command_filter` callable. File-cache fields (`_file_cache`, `_file_cache_time`, `_file_cache_cwd`) memoize the project file list so `@`-completion does not re-walk the tree on every keystroke.
- `hermes_cli/commands.py:1428` — `def get_completions(self, document, complete_event)` is the heart of the dispatcher. It branches on three triggers: leading `/` (slash command), bare `@` (Claude Code-style context reference), and otherwise a path-shaped token (`./`, `../`, `~/`, `/`, or any `/`-containing word) → file-path completion.
- `hermes_cli/commands.py:1057-1106` — `_path_completions` walks `os.listdir(search_dir)` with case-insensitive prefix match, capped at `limit=30`, displayed with file size or `dir` meta.
- `hermes_cli/commands.py:1108-1213` — `_extract_context_word` and `_context_completions` add static refs `@diff`, `@staged`, `@file:`, `@folder:`, `@git:`, `@url:` and delegate `@file:` / `@folder:` to path completion against the project tree.
- `hermes_cli/commands.py:1474-1496` — slash-command branch iterates `COMMANDS` (alias-resolved view of `COMMAND_REGISTRY`) plus skill commands from `_iter_skill_commands()`.
- `hermes_cli/commands.py:1498-1512` — plugin-registered slash commands. `from hermes_cli.plugins import get_plugin_commands` returns the third-party additions, displayed with `🔌` meta. This is dynamic capability discovery in the input layer.
- `hermes_cli/commands.py:1519-1591` — `class SlashCommandAutoSuggest(AutoSuggest)` produces dim ghost-text inline. It walks `COMMANDS` for the head, then `SUBCOMMANDS[base_cmd]` once the head is complete, and finally falls back to history-based suggestions from `FileHistory` for non-slash input.

The "floating panel" feel comes from prompt_toolkit's `CompletionsMenu` (imported at `cli.py:53`) attached to the `TextArea`'s buffer; navigation, scroll, and selection are all native to prompt_toolkit's `Buffer` / `CompletionState`.

### 1.2 Ink / React TUI

There is also an Ink-based React TUI: `ui-tui/src/` (per `AGENTS.md:48` referenced in v2) with a Python JSON-RPC backend in `tui_gateway/`. So Hermes ships **two** UIs in parallel: prompt_toolkit Application in `cli.py` and Ink/React in `ui-tui/`. The two share `COMMAND_REGISTRY` indirectly via the gateway's slash-command set.

### 1.3 Streaming render strategy

Located in `cli.py`:

- `cli.py:336` — `"streaming": True` default in CLI_CONFIG.
- `cli.py:1902-1903` — `self.streaming_enabled = CLI_CONFIG["display"].get("streaming", False)` is the per-run flag.
- `cli.py:2865-3082` — line-buffered streaming callback. Reasoning tags (`REASONING_SCRATCHPAD`, `<think>`, `<thinking>`, `<reasoning>` — declared at `cli.py:96-100`) are filtered while streaming because their raw XML bleeds into the rendered output. There is a "reset streaming state before each agent invocation" path at `cli.py:3082`. Streaming text is emitted via `_pt_print` / `_PT_ANSI` so it composes with the live `CompletionsMenu` and status-bar layouts without scroll corruption.

### 1.4 Status bar dynamics

`cli.py:2156-2550` is one continuous status-bar block:

- `cli.py:2158` — `self._status_bar_visible = True` flag (toggled by `/statusbar` / `/sb`).
- `cli.py:2207` — `_status_bar_context_style(percent_used)` colour-codes by context fill.
- `cli.py:2261` — `_get_status_bar_snapshot()` is the data assembler; it produces a dict of model + provider + percent_used + spinner state + reasoning-mode + voice-mode.
- `cli.py:2323-2351` — width-aware trimming with a multi-byte-aware `_status_bar_display_width` and trailing-ellipsis logic.
- `cli.py:2447-2550` — `_build_status_bar_text` and `_get_status_bar_fragments` produce the final fragment list emitted as a `class:status-bar` style. Reactive: a snapshot is rebuilt on every prompt_toolkit refresh tick (driven by the `Application` event loop), so model-switch, context-pct change, and spinner frame all appear live without any manual repaint.

### 1.5 What makes input "feel instant"

Concrete mechanisms, not vibes:

- File cache for `@`-completion: `hermes_cli/commands.py:1001-1004` stores `_file_cache`, `_file_cache_time`, `_file_cache_cwd`. Re-walks only on cwd change or TTL expiry — typed prefix filtering happens in memory.
- LM Studio model probe is gated by env-var presence (`hermes_cli/commands.py:1414-1426`) so the completer does not hit `127.0.0.1:1234` on every keystroke for users who don't run LM Studio.
- `prompt_toolkit.patch_stdout` (`cli.py:47`) interleaves agent stdout into the live layout without breaking the input region — there is no "redraw the prompt after each tool log line" pause.
- `cli.py:62-63` — non-blinking block cursor (`CursorShape.BLOCK`) when supported. Blinking cursors visually alias with rapid output streams.
- `_completion_text` at `commands.py:1023-1031` appends a trailing space when the typed text already equals the candidate, so prompt_toolkit does not suppress the menu on exact matches — the dropdown stays visible during disambiguation.

### 1.6 Aiden comparison and gaps

Aiden's CLI is `cli/aiden.ts` (6 034 lines) wrapped by `packages/aiden-os/bin/aiden.js` (506 lines). Recent commit `8c99643 feat(cli): Hermes-style live dropdown` added the dropdown:

- `cli/aiden.ts:5279-5466` — entire dropdown subsystem hand-rolled on raw ANSI escapes and `readline`. `interface DropdownState` at line 5289 (`visible`, `items`, `filtered`, `selectedIndex`, `triggerChar`, `query`, `lineCount`, `currentLine`).
- `cli/aiden.ts:5310-5317` — `buildSlashCommands()` reads from `COMMAND_DETAIL` in `cli/commandCatalog.ts` (283 lines).
- `cli/aiden.ts:5320-5383` — `buildToolList()` is a hard-coded array literal of 50 `@toolname` items with descriptions and category strings. **This is the central gap**: the list is duplicated in source, not derived from `core/toolRegistry.ts`. Adding a tool elsewhere does not surface it in the dropdown until this literal is hand-edited.
- `cli/aiden.ts:5386-5454` — `eraseDropdown()` and `renderDropdown()` use relative-cursor escapes (`\x1b[1B`, `\x1b[2K`, `\x1b[${n}A`) — the comment at line 5443-5445 explicitly notes "Do NOT call _refreshLine() — it emits \x1b[0J (erase to end of screen) which would wipe the dropdown". This is fragile: any unrelated line write between erase and re-render leaves drawn rows orphaned.
- No `Completer` abstraction: `cli/aiden.ts:5468` `function completer(line)` is the only completion entry point and is `readline`'s own Tab completer, not a layered system. There is no equivalent of `SlashCommandAutoSuggest` (ghost text) — Aiden's input region is single-buffer.
- Status bar in Aiden lives at `core/statusBar.ts` and is invoked imperatively per turn, not driven by a layout event loop. Aiden has no equivalent of Hermes' per-keystroke status snapshot — `cli/aiden.ts:25` declares `API_BASE` and `SESSION_ID` once and holds them in module-scope.
- No Ink/React TUI — confirmed not found in repo (no `ui-tui/`, no React/Ink dependency in `package.json`).
- No prompt_toolkit `CompletionsMenu` analogue and no `Application` event loop. Aiden's CLI cannot interleave streaming agent output and a live menu the way Hermes' `patch_stdout` + `Application` combination can.

The gap is structural: Aiden has the **drawing** of a Hermes-style dropdown (commit 8c99643) but not the **architecture** behind it (a registry-driven Completer interface, an `AutoSuggest` abstraction, and an event loop that owns the screen).

---

## 2. Plugin / hook system architecture

### 2.1 Hermes pre/post tool hooks

The hook surface in Hermes is split across three layers: in-process Python plugin hooks, shell-script hooks via JSON over stdin/stdout, and a unified dispatcher that fans both out.

- `agent/shell_hooks.py:1-52` — module docstring spells out the wire protocol. The script reads JSON from stdin (`hook_event_name`, `tool_name`, `tool_input`, `session_id`, `cwd`, `extra`) and writes JSON to stdout. Two block shapes are accepted: Claude-Code-style `{"decision":"block","reason":...}` and Hermes-canonical `{"action":"block","message":...}`. `pre_llm_call` can inject context with `{"context":"..."}`.
- `agent/shell_hooks.py:83-112` — constants: `DEFAULT_TIMEOUT_SECONDS = 60`, `MAX_TIMEOUT_SECONDS = 300`, `ALLOWLIST_FILENAME = "shell-hooks-allowlist.json"`. Process-level `_registered: Set[Tuple[str,Optional[str],str]]` tracks `(event, matcher, command)` triples already wired so CLI and gateway can both call `register_from_config()` without duplicating fan-out.
- `agent/shell_hooks.py:105-120` — `@dataclass class ShellHookSpec` carries `event`, `command`, `matcher` (regex, compiled at construction time), `timeout`. `__post_init__` strips whitespace from `matcher` because YAML folding silently breaks regex matching.
- `hermes_cli/hooks.py:112-185` — `_DEFAULT_PAYLOADS` enumerates every event with synthetic kwargs that match the real `invoke_hook()` call shape. Events: `pre_tool_call`, `post_tool_call`, `pre_llm_call`, `post_llm_call`, `on_session_start`, `on_session_end`, `on_session_finalize`, `on_session_reset`, `pre_api_request`, `post_api_request`, `subagent_stop`. The same dict is used by `hermes hooks test` and `hermes hooks doctor`, so manual testing exercises the production wire.
- `run_agent.py:9047-9128` — `_invoke_tool` is the central tool-call site. Inside, it imports `from hermes_cli.plugins import get_pre_tool_call_block_message` (line 9058-9059) and consults the merged plugin + shell-hook block decision before dispatching. Python plugin blocks win ties over shell-hook blocks (per `agent/shell_hooks.py` design note lines 11-15).
- `run_agent.py:10251-10253, 10352-10353, 10796-10797, 12522-12525, 13398-13399, 13500-13501` — `invoke_hook(...)` is sprinkled at session start, post-LLM, post-tool, pre-API, post-API, session-end, and finalize. Every call site is a single import-and-call line; the dispatcher does the fan-out.
- `hermes_cli/hooks.py:317-385` — `_doctor_one` runs a synthetic-payload smoke test on each allowlisted hook, validates that stdout parses as JSON when present, and reports mtime drift since approval (so a script silently edited after approval is flagged).

The hook list is config-driven — `~/.hermes/config.yaml` `hooks:` block — and consent is per-`(event, command)` pair via `~/.hermes/shell-hooks-allowlist.json`. Subprocess uses `shlex.split(os.path.expanduser(command))` with `shell=False` (no shell-injection footgun).

### 2.2 Plugin sandboxing

Hermes' shell-hook layer sandboxes by:

- Subprocess isolation (Python plugins run in-process, but shell hooks cannot mutate Hermes state directly — only via JSON output that the dispatcher parses).
- Per-script timeout (`DEFAULT_TIMEOUT_SECONDS = 60`, capped at `MAX_TIMEOUT_SECONDS = 300`).
- First-use TTY consent gate (`accept_hooks=True` required for non-TTY callers, otherwise the user must answer at the prompt).
- Mtime fingerprint at approval time so post-approval edits are detected (`hermes_cli/hooks.py:91-99, 338-348`).
- POSIX `fcntl.flock` on the allowlist file (`agent/shell_hooks.py:73-76, 102`); falls back to a `threading.Lock` on Windows.

Python plugins themselves are not sandboxed — they run in-process. The trust boundary is "plugins are user-authored or vetted; shell hooks are the untrusted-content surface."

### 2.3 Tool registry mutation patterns

From v2 §2: `tools/registry.py:226` `register(...)`, `:280` `deregister(...)`. The new piece relevant to v3 is **runtime registration by plugins**: `hermes_cli/commands.py:1498-1512` shows that plugin-registered slash commands are surfaced live in the completer via `from hermes_cli.plugins import get_plugin_commands`. Plugins can therefore add tools, skill commands, and slash commands at process start (and via `reload-mcp`, after start) — `_generation` counter at `tools/registry.py:159` ensures the model_tools cache invalidates when this happens.

### 2.4 Aiden comparison and gaps

Aiden's plugin loader is at `core/pluginLoader.ts` (170 lines, fully read):

- `core/pluginLoader.ts:16-31` — `interface PreToolHook`, `PostToolHook`, `SessionHook` and the parent `interface PluginHooks` (4 arrays: `preTool`, `postTool`, `onSessionStart`, `onSessionEnd`).
- `core/pluginLoader.ts:33-38` — `export const pluginHooks: PluginHooks = { preTool: [], postTool: [], onSessionStart: [], onSessionEnd: [] }` — module-scoped singleton.
- `core/pluginLoader.ts:55-83` — `makeContext(pluginName)` exposes `registerTool({name, description, input_schema?, execute})`, `hooks.preTool/postTool/onSessionStart/onSessionEnd`, and a generic `registerHook(event, handler)` that delegates to `core/hooks.ts`.
- `core/pluginLoader.ts:86-136` — `loadPlugins(pluginDir)` reads `*.js` (skipping `_*.js`), clears the require cache so reload works, supports both flat (`init`) and legacy subdirectory (`onLoad`) shapes.
- `core/hooks.ts:11-14` — only three valid events: `'pre_compact'`, `'session_stop'`, `'after_tool_call'`. This is **far** narrower than Hermes' eleven event types listed at `hermes_cli/hooks.py:112-185`.
- `core/hooks.ts:50` — `VALID_HOOK_EVENTS: HookEvent[] = ['pre_compact','session_stop','after_tool_call']`. `registerExternalHook` validates and warns on unknown events.

`workspace/plugins/` is currently empty (`ls C:/Users/shiva/DevOS/workspace/plugins/` returned no files). The framework exists; nothing is shipped or installed.

Concrete gaps vs Hermes:

- No `pre_llm_call`, `post_llm_call`, `pre_api_request`, `post_api_request`, `on_session_start`, `on_session_end`, `on_session_finalize`, `on_session_reset`, `subagent_stop` events — only three coarse events exist.
- No matcher field. Hermes' `ShellHookSpec.matcher` lets a script gate to a specific tool name; in Aiden a `preTool` hook fires for every tool and must self-filter.
- No shell-script hook variant — only in-process JS hooks. Cannot drop a `~/.aiden/hooks/check_secrets.sh` and have it run.
- No allowlist / consent gate. Any plugin in `workspace/plugins/` runs without prompt.
- No mtime drift detection.
- No `hermes hooks doctor` analogue. There is no way to validate hook scripts without running them in production.
- No `_generation` invalidation in `core/toolRegistry.ts` (per v2 §2).

### 2.5 Plugin manifest shape

Workspace plugin directory was empty so no live manifests exist to read. The expected shape per `core/pluginLoader.ts:104-114` is a `.js` file exporting `{ name, version, description, author, init(ctx) }` where `init` is an async function receiving the context built by `makeContext`.

---

## 3. Real-time state vs cached context

This is the section that determines whether the agent feels alive or pre-baked.

### 3.1 Hermes prompt assembly

System prompt assembly lives in `agent/prompt_builder.py` (1 122 lines):

- `agent/prompt_builder.py:1-6` — module docstring: "All functions are stateless. AIAgent._build_system_prompt() calls these to assemble pieces, then combines them with memory and ephemeral prompts." Stateless is the key word.
- `agent/prompt_builder.py:36-73` — `_CONTEXT_THREAT_PATTERNS` and `_CONTEXT_INVISIBLE_CHARS` filter prompt-injection in any context file (AGENTS.md, .cursorrules, SOUL.md) **before** injection. A blocked file is replaced with `"[BLOCKED: filename contained potential prompt injection (ids). Content not loaded.]"`.
- `agent/prompt_builder.py:76-110` — `_find_git_root` and `_find_hermes_md` search the repo tree at every prompt build for `.hermes.md` or `HERMES.md`. Project-scoped guidance is therefore re-read each turn (no on-startup cache).
- `agent/prompt_builder.py:113-127` — `_strip_yaml_frontmatter` peels structured config from those files so only the human-readable body lands in the prompt.
- `agent/prompt_builder.py:692-885` — `build_skills_index_prompt` is a layered cache: layer 1 LRU at `_SKILLS_PROMPT_CACHE` (line ~699), layer 2 disk snapshot via `_load_skills_snapshot(skills_dir)` (line 703), and layer 3 cold-path full filesystem scan (line 736) which writes a fresh snapshot for next time. `iter_skill_index_files` walks both bundled and external skill dirs. Disabled, platform-incompatible, and conditionally-hidden skills are filtered every call (`skill_matches_platform`, `_skill_should_show`).
- `agent/prompt_builder.py:849-876` — the rendered skill index is wrapped in a "## Skills (mandatory)" preamble that tells the model to call `skill_view(name)` before answering.
- `agent/prompt_builder.py:888-951` — `build_nous_subscription_prompt` is gated on `managed_nous_tools_enabled()`; status lines for Firecrawl, FAL, OpenAI TTS, Browser-Use, Modal are computed live from the auth-store and feature flags. So subscription-controlled capabilities appear and disappear without a restart.
- `agent/prompt_builder.py:970-979` — `load_soul_md` reads `SOUL.md` from `HERMES_HOME` on every turn.

What this means for "what's playing on Spotify" / "what's my CPU usage": Hermes does **not** inject live system state into the system prompt. It injects a **skills index + tool inventory**, and the model is instructed to call a tool (e.g. `terminal`, `process`, or a skill that wraps Spotify) to read live state when needed. The system prompt is regenerated per turn, but it is regenerated from filesystem + config — not from live device telemetry. The "freshness" mechanism for live data is the tool call, not the prompt.

### 3.2 Hermes context freshness

The freshness controls in the prompt builder are:

- LRU cache key for the skill index (`_SKILLS_PROMPT_CACHE` at `agent/prompt_builder.py:~699`) keyed on `(skills_dir, disabled_set, available_tools, available_toolsets)` — so toggling a tool invalidates.
- Disk snapshot at `_load_skills_snapshot` / `_write_skills_snapshot` — recomputed on cold start when manifest fingerprint differs.
- Per-turn re-read of `.hermes.md`, `HERMES.md`, `SOUL.md`, `AGENTS.md`, `.cursorrules` (no caching — `agent/prompt_builder.py:76-110, 970-979`).
- Subscription / capability prompt re-evaluated per turn (`agent/prompt_builder.py:888-951`).

There is no global TTL or timestamp on context blocks; freshness is enforced by re-reading on every turn, with sub-block caching only where the inputs are large (skills index).

### 3.3 Aiden prompt assembly

Aiden's system prompt is built inside `core/agentLoop.ts`:

- `core/agentLoop.ts:687-755` — `COMPACTION_PROTECTED = ['SOUL.md','STANDING_ORDERS.md','LESSONS.md','GOALS.md','USER.md']` and `rebuildContextAfterCompaction()`. These five files are re-read **only on compaction**, not on every turn. They are stitched into a `[PROTECTED CONTEXT — survives compaction]` system message.
- `core/agentLoop.ts:692` — comment says SOUL.md is "personality + boundaries". Read path is `path.join(process.cwd(), 'workspace', filename)` — so changes to `workspace/SOUL.md` mid-session are picked up only when compaction fires (at multiples of `COMPACT_THRESHOLD = 40`, `core/agentLoop.ts:53`).
- `core/agentLoop.ts:768-772` — `pre_compact` hook fires when `history.length >= COMPACT_THRESHOLD && history.length % COMPACT_THRESHOLD === 0`.
- `core/agentLoop.ts:719-740` — `instincts.json` top-5 by confidence is pulled into the protected message. Same caveat: only at compaction.
- `core/agentLoop.ts:840-846` — per-turn dynamic context: `detectToolCategories(message)` then `getToolsForCategories(categories)` filters the planner tool list from `~15K` to `3-5K` tokens. This is dynamic but it is a **filter on a static list**, not a refresh of state.
- `core/agentLoop.ts:847-867` — `skillLoader.findRelevant(message)` (per-message), `learningMemory.buildLearningContext(message)` (per-message), `knowledgeBase.buildContext(message)` (per-message), `loadLessons()` (per-turn re-read of `LESSONS.md`).
- `core/agentLoop.ts:875-899` — `unifiedMemoryRecall(message, 5)` runs only if `needsMemory(message)` — a heuristic gate on the user message — and `semanticMemory.search(...)` for "fact"-type entries is per-turn.

The shape is similar to Hermes: per-turn skill / memory / lesson / knowledge re-injection plus a smaller set of "always-on" identity files. The crucial difference is identity: Hermes re-reads SOUL.md every turn (`agent/prompt_builder.py:970-979`); Aiden re-reads SOUL.md, STANDING_ORDERS.md, LESSONS.md, GOALS.md, USER.md only at compaction (`core/agentLoop.ts:687-755`).

There is no periodic refresh path. There is no timestamp on protected context blocks. There is no "fetch live state and inject" mechanism — `core/agentLoop.ts:1-200` shows imports for `getActiveGoalsSummary`, `costTracker`, `instinctSystem`, but these surfaces are read into the planner prompt at compaction only, not on every user turn.

### 3.4 Concrete consequence

- A user editing `workspace/SOUL.md` mid-conversation will not see the change reflected in agent behaviour until 40 messages later (next compaction trigger).
- A user adding a new fact to `workspace/STANDING_ORDERS.md` will not see it honoured until compaction.
- Live device state (Spotify, CPU, calendar) reaches the model only via tool call, same as Hermes — but Aiden has no equivalent of the Nous-subscription block (`agent/prompt_builder.py:888-951`) where a capability-aware status line is injected per turn.

This is the architectural gap behind the user's "feels hardcoded" intuition.

---

## 4. The "feel" question

### 4.1 Why Hermes feels limitless

Mechanisms, with citations:

- **Runtime tool registration via AST scan**: `tools/registry.py:42` (and v2 §2) — `model_tools.discover_builtin_tools()` walks `tools/*.py`, AST-checks each file for a top-level `registry.register(...)` call, then imports those modules. Drop a file, get a tool. No registration-list edit required.
- **Plugin-registered slash commands surface live in completion**: `hermes_cli/commands.py:1498-1512` — `get_plugin_commands()` is consulted inside `get_completions`. A plugin loaded mid-session adds new `/`-commands that appear in the floating menu without restart.
- **Skill curator as autonomous behaviour mutation**: `agent/curator.py:851` `maybe_run_curator()` (per v2 §3) idle-triggers a forked AIAgent that consolidates, archives, and **patches** agent-created skills. The agent's behaviour drifts over time without explicit user intervention.
- **Multi-source skill installation**: `tools/skills_hub.py:284-3088` — `GitHubSource`, `WellKnownSkillSource`, `UrlSource`, `SkillsShSource`, `ClawHubSource`, `ClaudeMarketplaceSource`, `LobeHubSource`, `OptionalSkillSource`, `HermesIndexSource` all behind a uniform `SkillSource` ABC, with `unified_search` running them concurrently. Capability acquisition feels like "ask and it appears".
- **Identity persistence across sessions**: `gateway/session.py` (1 358 lines, per v2 §4) shares `session_id` between CLI and 20 platform adapters. The agent answering on Telegram is the same one you talked to in CLI yesterday.
- **`_HERMES_MD_NAMES` walk to git root**: `agent/prompt_builder.py:89-110` — project-specific guidance is auto-discovered in any ancestor directory. The agent silently picks up project conventions when you `cd` into a new repo.
- **Per-turn capability status line**: `agent/prompt_builder.py:888-951` — the model is told "Firecrawl is active via Nous subscription" or "TTS is included with Nous subscription, not currently selected" on every turn, computed from live config. The model never tries a tool that isn't actually available, and never declines a tool the user has just enabled.

### 4.2 Five surprising patterns from v2 reading

1. **`_SafeWriter` swallows `OSError` and `ValueError` on every stdout write** (`run_agent.py:167`, v2 §1). The agent runs in deployment scenarios — broken Docker pipes, systemd journal disconnects — without crashing. Most agent codebases don't think about this.
2. **`_paths_overlap` for safe parallel file ops** (`run_agent.py:355, 416`, v2 §2). Two `read_file` calls on the same file are not parallel-safe (they could race a concurrent `write_file`). Hermes computes path-prefix overlap on `Path.parts` to make exactly the right call.
3. **Plugin Python hooks tie into the same `invoke_hook` site as shell hooks** (`run_agent.py:9058-9128`). One dispatcher, two implementations, identical wire shape — meaning a Python plugin and a shell script can both block a tool call and the rules for which wins are explicit (Python wins ties, `agent/shell_hooks.py:11-15`).
4. **FTS5 + trigram dual index** (`hermes_state.py:103-132`, v2 §5). Default unicode61 tokenizer for Latin scripts, trigram for CJK substring search — both kept in sync by triggers. Transparently multilingual.
5. **Idle-triggered curator forks a sub-AIAgent to rewrite skills** (`agent/curator.py:851`, v2 §3). An agent process that maintains its own toolbox while idle. Recursive self-improvement without RL.

### 4.3 Where capability surprises emerge

- **Tool composition via `execute_code`**: arbitrary Python in the sandbox (`tools/environments/*.py`, v2 §1). Once a tool can write and run code, the toolset is effectively closed under composition.
- **Skill triggering**: a SKILL.md frontmatter with platform conditions (`tools/skills_tool.py:151` `skill_matches_platform`) means a skill silently activates on the right OS / shell / model and silently disappears elsewhere. The user never sees the gate.
- **Subagent recursion**: `delegate_task` (v2 §1, `tools/delegate_tool.py`) spawns a fresh AIAgent with its own IterationBudget. Subagents can themselves delegate. Tree depth is bounded by recursion budget, not by hardcoded limits.
- **Cron-driven self-initiated turns**: `cron/scheduler.py:1` `tick()` runs every 60 s under a file lock and dispatches into `_KNOWN_DELIVERY_PLATFORMS` — the agent can talk to the user without being asked.
- **`_HERMES_MD_NAMES` git-root walk**: project-level instructions appear without configuration (`agent/prompt_builder.py:89-110`).

---

## 5. Top 5 priorities for Aiden v3.19

Stated as user-visible problem → Aiden bottleneck → Hermes pattern → scope. Ordered by impact-to-effort judgement.

### Priority 1 — Refresh protected context every turn, not only at compaction

- **User-visible problem**: editing `SOUL.md`, `STANDING_ORDERS.md`, `GOALS.md`, `USER.md`, or `LESSONS.md` does not change agent behaviour for ~40 messages. The agent feels frozen against the files the user thinks define it.
- **Aiden bottleneck**: `core/agentLoop.ts:687-755` `rebuildContextAfterCompaction()` is gated on the compaction event at `core/agentLoop.ts:768-772` (`history.length % COMPACT_THRESHOLD === 0`).
- **Hermes pattern**: `agent/prompt_builder.py:970-979` `load_soul_md()` is called from `_build_system_prompt` every turn; `agent/prompt_builder.py:76-110` discovers `.hermes.md` per turn.
- **Scope**: small. The read-and-stitch logic already exists in `rebuildContextAfterCompaction`; it just needs to be lifted into the per-turn planner-prompt assembly path. The interesting question is invalidation — Hermes pays a per-turn re-read because each file is small. Aiden could either match that or hash-and-cache.
- **Reasoning**: this single change closes the largest "feels hardcoded" gap with the least code movement. It directly addresses the architectural crux from §3.

### Priority 2 — Expand `core/hooks.ts` event vocabulary and add matchers

- **User-visible problem**: plugins can only react at compaction, session stop, and after every tool call. They cannot inject context before an LLM call, gate a specific tool by name, or react to API requests (rate-limit awareness). The plugin layer is too coarse to be useful.
- **Aiden bottleneck**: `core/hooks.ts:11-14` declares only three events; `core/pluginLoader.ts:16-31` defines only `preTool`, `postTool`, `onSessionStart`, `onSessionEnd`; there is no `matcher` field on `PreToolHook`.
- **Hermes pattern**: `hermes_cli/hooks.py:112-185` enumerates eleven event types (`pre_tool_call`, `post_tool_call`, `pre_llm_call`, `post_llm_call`, `on_session_start`, `on_session_end`, `on_session_finalize`, `on_session_reset`, `pre_api_request`, `post_api_request`, `subagent_stop`); `agent/shell_hooks.py:105-120` `ShellHookSpec.matcher` regex-filters on `tool_name`.
- **Scope**: medium. Expanding the event enum and adding a matcher to each hook is mechanical, but every existing call site in `core/agentLoop.ts` needs a hook firing at the right place, and the order-of-precedence semantics (block decisions, context injection) need explicit rules. Hermes' "Python plugins win ties over shell hooks" is the kind of decision that has to be made up-front.
- **Reasoning**: high impact for power users and the workspace/plugins/ ecosystem (currently empty), and the engineering surface is well-bounded.

### Priority 3 — Derive the CLI dropdown tool list from `core/toolRegistry.ts`

- **User-visible problem**: a tool registered in `core/toolRegistry.ts` does not appear in the `@`-trigger dropdown unless someone hand-edits a 60-line array literal. Tool discovery is broken at the input layer.
- **Aiden bottleneck**: `cli/aiden.ts:5320-5383` `buildToolList()` returns a hard-coded array of 50 entries.
- **Hermes pattern**: `hermes_cli/commands.py:1486-1496` reads from `_iter_skill_commands()` and `hermes_cli/commands.py:1498-1512` reads from `get_plugin_commands()`. Single source of truth (`COMMAND_REGISTRY`) feeds the completer, the help text, and the gateway.
- **Scope**: small. The runtime tool list is already accessible (`TOOL_NAMES_ONLY` is exported from `core/toolRegistry.ts` per `core/agentLoop.ts:11`). The dropdown builder needs to join `TOOL_NAMES_ONLY` with a `description` lookup that lives next to the tool definition, not in `cli/aiden.ts`.
- **Reasoning**: surgical fix, removes a recurring drift class (manual edits to keep the dropdown in sync), and unblocks the next priority.

### Priority 4 — Add a registry-backed `Completer` abstraction so plugins can register slash commands

- **User-visible problem**: there is no way for a user-installed plugin to add a new `/`-command that shows up in the dropdown. The plugin layer is mute in the CLI.
- **Aiden bottleneck**: `cli/aiden.ts:5310-5317` `buildSlashCommands()` reads `COMMAND_DETAIL` from `cli/commandCatalog.ts` (a static module). There is no plugin contribution surface. `cli/aiden.ts:5468` `function completer(line)` is a single function with no extension points.
- **Hermes pattern**: `hermes_cli/commands.py:1498-1512` — `from hermes_cli.plugins import get_plugin_commands` is consulted inside `get_completions`, with `🔌` meta to distinguish plugin commands. `hermes_cli/commands.py:991-1496` — the whole `Completer` is a pluggable subclass with `skill_commands_provider` and `command_filter` callable injection points.
- **Scope**: medium. Requires a registry-with-provider pattern in `cli/commandCatalog.ts`, propagation through `cli/aiden.ts:5310`, and a documented `ctx.registerSlashCommand({ name, description, args_hint, subcommands })` in `core/pluginLoader.ts`'s `makeContext`. Touches two files but introduces a new public API surface.
- **Reasoning**: this is the unlock for the empty `workspace/plugins/` directory becoming a useful ecosystem. Without it, plugins can register tools but not present them in the input layer.

### Priority 5 — Invariants for parallel file ops + destructive-command checkpointing (carry-over from v2 §2)

- **User-visible problem**: parallel batches that touch the same path can race; an accidental `rm -rf` or `>` overwrite is unrecoverable.
- **Aiden bottleneck**: `core/agentLoop.ts:1935` `buildDependencyGroups` only checks for `'PREVIOUS_OUTPUT'` substring + a static `SEQUENTIAL_ONLY` blacklist. No path-overlap detector. No `_DESTRUCTIVE_PATTERNS`.
- **Hermes pattern**: `run_agent.py:355` `_should_parallelize_tool_batch` and `run_agent.py:416` `_paths_overlap`; `run_agent.py:327-352` `_DESTRUCTIVE_PATTERNS`, `_REDIRECT_OVERWRITE`, `_is_destructive_command`.
- **Scope**: small for the parallel guards (port two pure functions); medium for the checkpoint manager (needs a working git-stash-equivalent and an integration point in `executeOneStep` near `core/agentLoop.ts:1900`).
- **Reasoning**: surgical, well-scoped, addresses correctness rather than capability — but the user-visible consequence (a destructive shell call wiping work) is severe enough that this stays in the top five despite v2 already calling it out. Listed last because v2 already documented it; Priorities 1–4 are new in v3.

---

## "Not found in repo" results

- No Ink/React TUI in Aiden — confirmed: `packages/aiden-os/` contains only `bin/aiden.js`, `src/`, `package.json`, `README.md`; `cli/aiden.ts` is a single readline file. No `ui-tui/` directory, no React/Ink dependency in `package.json`.
- No populated `workspace/plugins/` directory — confirmed empty (`ls C:/Users/shiva/DevOS/workspace/plugins/` returned nothing). Framework exists, no installed plugins to read.
- No `pre_llm_call`, `post_llm_call`, `pre_api_request`, `post_api_request` hook events in Aiden — confirmed by reading `core/hooks.ts:11-14` (only `pre_compact`, `session_stop`, `after_tool_call`).
- No matcher field on Aiden hooks — confirmed by reading `core/pluginLoader.ts:16-22`.
- No shell-script hook variant in Aiden — confirmed by reading `core/hooks.ts` (entire file: 63 lines, only in-process JS handlers).
- No per-turn refresh of `STANDING_ORDERS.md`, `GOALS.md`, `USER.md`, `LESSONS.md` — confirmed by reading `core/agentLoop.ts:687-755` (compaction-only).

---

## Reading log (v3 only — does not relist v2)

### Hermes clone (`C:/Users/shiva/AppData/Local/Temp/hermes`)

- `hermes_cli/completion.py` — read 1-316 of 316 (full).
- `hermes_cli/hooks.py` — read 1-385 of 385 (full).
- `hermes_cli/commands.py` — read 1-200 of file; 980-1180; 1410-1591 (all key surfaces).
- `cli.py` — read 1-100; pattern-located lines 47-57, 336, 658, 1902-1903, 2156-2550, 2865-3082, 10114 via Grep.
- `agent/shell_hooks.py` — read 1-120 of 836.
- `agent/prompt_builder.py` — read 1-200; 700-980 of 1122.
- `hermes_cli/main.py` — read 1-150 of 10 373.
- `run_agent.py` — Grep only for hook invoke sites (lines 9047, 9058, 9127, 9302, 9518, 9751, 10251-10253, 10352-10353, 10796-10797, 12522-12525, 13398-13399, 13500-13501).
- Directory listing: `hermes_cli/` (52 files), `agent/` (44 files).

### Aiden tree (`C:\Users\shiva\DevOS`)

- `core/pluginLoader.ts` — read 1-170 of 170 (full).
- `core/hooks.ts` — read 1-63 of 63 (full).
- `core/agentLoop.ts` — read 1-90; 680-900 of 3057+. (v2 already covered 1900-1980, 2032-2329.)
- `cli/aiden.ts` — read 1-120; 5279-5478 of 6 034.
- `packages/aiden-os/bin/aiden.js` — read 1-507 of 506 (full).
- Directory listing: `core/` (≈110 files); `cli/` (3 files: aiden.ts, commandCatalog.ts, commandPalette.ts); `workspace/plugins/` (empty); `graphify-out/` (16 entries — listed only).
- `wc -l` on `cli/aiden.ts` (6 034), `cli/commandCatalog.ts` (283), `cli/commandPalette.ts` (94), `core/hooks.ts` (63), `packages/aiden-os/bin/aiden.js` (506).

End of v3 audit.
