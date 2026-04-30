# Phase 5 — Slash Command Audit
Generated: 2026-05-01. Input to C2 refactor.

---

## Summary

| Item | Count |
|------|-------|
| Entries in `COMMAND_DETAIL` (cli/commandCatalog.ts) | **85** |
| Entries in `/help` display but **missing** from `COMMAND_DETAIL` | **6** |
| Total commands with dispatch handlers in `cli/aiden.ts` | **91** |
| Dispatch handler entry point | `cli/aiden.ts:778` `handleCommand()` |
| Dispatch style | Flat `if (command === '...')` chain, lines 784–5251 |
| Dropdown derivation | `buildSlashCommands()` at `cli/aiden.ts:5292` reads `COMMAND_DETAIL` ✅ |
| Plugin register API | **None** — `COMMAND_DETAIL` is a frozen static object |
| `_generation` counter | **None** |

> Briefing said "64 commands" — actual count is **85 in catalog + 6 unlisted = 91 total**.
> The catalog has grown since the briefing was written.

---

## Gap 1 — 6 Commands Missing from COMMAND_DETAIL

These commands have full dispatch handlers in `cli/aiden.ts` and appear in the `/help`
display text, but are absent from `COMMAND_DETAIL`. They do **not** appear in the `/`
dropdown. C2 must add them.

| Command | Dispatch line | Notes |
|---------|--------------|-------|
| `/plugins` | `cli/aiden.ts:2082` | Plugin manager (list / reload) |
| `/profile` | `cli/aiden.ts:2670` | View/edit/clear structured user profile (Honcho model) |
| `/install` | `cli/aiden.ts:4578` | Install skill from public registry |
| `/publish` | `cli/aiden.ts:4610` | Publish skill to public registry |
| `/failed` | `cli/aiden.ts:4650` | Signal last exchange failed — triggers failure trace analysis + lesson |
| `/sandbox` | `cli/aiden.ts:4690` | Manage Docker sandbox mode (status/off/auto/strict/build) |

---

## Gap 2 — No Register / Unregister API

`COMMAND_DETAIL` is declared as `export const COMMAND_DETAIL: Record<string, CmdDetail> = { ... }`.
There is no `register()`, `unregister()`, `list()`, `get()`, or `_generation` counter.
Plugins cannot contribute slash commands at runtime. C2 adds all of these.

---

## Gap 3 — No Handler Field in CmdDetail

`CmdDetail` carries display metadata only (`desc`, `usage`, `subs`, `examples`, `section`).
Dispatch logic lives in the `handleCommand()` if-chain in `cli/aiden.ts`. C2 adds
`handler: (args: string[]) => Promise<void>` to `CmdDetail` and populates all 91 handlers,
enabling a unified dispatch path.

---

## Full Command Mapping — by Section

All 91 commands, grouped by section, with current dispatch location.
Aliases share the same dispatch block (noted in the Aliases column).

### Session (8)

| Command | Dispatch (cli/aiden.ts:line) | Aliases |
|---------|------------------------------|---------|
| `/new` | 965 | shared with `/reset` |
| `/reset` | 965 | alias of `/new` |
| `/clear` | 974 | — |
| `/history` | 981 | — |
| `/stop` | 994 | — |
| `/export` | 1006 | — |
| `/fork` | 1026 | — |
| `/checkpoint` | 1040 | — |

### Info (25 in catalog + 0 missing)

| Command | Dispatch (cli/aiden.ts:line) | Notes |
|---------|------------------------------|-------|
| `/timing` | 4151 | — |
| `/version` | 4169 | — |
| `/status` | 1048 | — |
| `/tools` | 1069 | — |
| `/kit` | 1104 | — |
| `/providers` | 1172 | — |
| `/models` | 1201 | shared with `/model` (no args) |
| `/memory` | 1268 | — |
| `/memsearch` | 1286 | — |
| `/memtimeline` | 1325 | — |
| `/memget` | 1367 | — |
| `/goals` | 1409 | — |
| `/skills` | 1427 | — |
| `/lessons` | 2575 | — |
| `/teach` | 2785 | — |
| `/focus` | 2304 | — |
| `/explore` | 2325 | — |
| `/pulse` | 2391 | — |
| `/rewind` | 2474 | — |
| `/pin` | 2528 | — |
| `/diff` | 2824 | — |
| `/trust` | 2858 | — |
| `/timeline` | 2939 | — |
| `/garden` | 3005 | — |
| `/decision` | 3113 | — |

### Info — Missing from COMMAND_DETAIL (3)

| Command | Dispatch (cli/aiden.ts:line) | Section suggestion |
|---------|------------------------------|--------------------|
| `/plugins` | 2082 | Info |
| `/profile` | 2670 | Info |
| `/failed` | 4650 | Info |

### Core (14)

| Command | Dispatch (cli/aiden.ts:line) | Notes |
|---------|------------------------------|-------|
| `/log` | 3180 | — |
| `/save` | 3219 | — |
| `/rerun` | 3241 | — |
| `/name` | 3253 | — |
| `/stack` | 3273 | — |
| `/halt` | 3306 | — |
| `/yolo` | 3317 | — |
| `/attach` | 3328 | — |
| `/changelog` | 3367 | — |
| `/sessions` | 3409 | — |
| `/recipes` | 3392 | — |
| `/analytics` | 3424 | — |
| `/budget` | 3529 | — |
| `/workspace` | 3545 | — |

### Config (9)

| Command | Dispatch (cli/aiden.ts:line) | Notes |
|---------|------------------------------|-------|
| `/model` | 1201 (no args) / 1250 (with args) | split dispatch by arg count |
| `/provider` | 3809 | — |
| `/primary` | 4093 | shared with `/switch` |
| `/switch` | 4093 | alias of `/primary` |
| `/theme` | 3767 | — |
| `/persona` | 3785 | — |
| `/detail` | 3793 | — |
| `/depth` | 3801 | — |
| `/config` | 3745 | — |

### Power (29 in catalog + 3 missing)

| Command | Dispatch (cli/aiden.ts:line) | Notes |
|---------|------------------------------|-------|
| `/quick` | 3563 | — |
| `/compact` | 3607 | — |
| `/async` | 3622 | — |
| `/run` | 4190 | — |
| `/spawn` | 4357 | — |
| `/swarm` | 4454 | — |
| `/search` | 4520 | — |
| `/permissions` | 2148 | — |
| `/uninstall` | 2224 | — |
| `/mcp` | 4759 | — |
| `/cmd` | 4844 | — |
| `/ps` | 4872 | — |
| `/wsl` | 4900 | — |
| `/refresh` | 4932 | — |
| `/channels` | 4957 | — |
| `/voice` | 5004 | — |
| `/speak` | 5088 | — |
| `/listen` | 5106 | — |
| `/todo` | 5140 | — |
| `/cron` | 5177 | — |
| `/vision` | 5229 | — |
| `/security` | 3702 | — |
| `/debug` | 3717 | — |
| `/private` | 3728 | — |
| `/learn` | 2262 | — |

### Power — Missing from COMMAND_DETAIL (3)

| Command | Dispatch (cli/aiden.ts:line) | Section suggestion |
|---------|------------------------------|--------------------|
| `/install` | 4578 | Power |
| `/publish` | 4610 | Power |
| `/sandbox` | 4690 | Power |

### Voice (3, already in Power section of catalog)

Catalog lists `/voice`, `/speak`, `/listen` under a `Voice` section — handlers listed
above under Power.

### Meta (1)

| Command | Dispatch (cli/aiden.ts:line) | Notes |
|---------|------------------------------|-------|
| `/help` | 784 | reads COMMAND_DETAIL for search + detail sub-commands |

### Exit (3)

| Command | Dispatch (cli/aiden.ts:line) | Aliases |
|---------|------------------------------|---------|
| `/quit` | 4080 | shared with `/exit` and `/q` |
| `/exit` | 4080 | alias of `/quit` |
| `/q` | 4080 | alias of `/quit` |

---

## Shared / Split Dispatchers

C2 must handle these correctly when extracting handlers:

| Pattern | Commands | Strategy |
|---------|----------|----------|
| Same block, multiple commands | `/new`+`/reset`, `/quit`+`/exit`+`/q`, `/primary`+`/switch` | All aliases share the same handler function |
| Split by arg count | `/model` | No-args → show models table (line 1201); with-args → switch model (line 1250). One handler, branch internally on `args.length` |
| `/models` in catalog, `/model` in catalog | Both point to the same actual behavior split | Handler for `/models` → show table; handler for `/model` → dispatch on args |

---

## C2 Migration Checklist

1. Add to `CmdDetail` interface:
   - `handler: (args: string[]) => Promise<void>`
   - `origin: 'core' | 'plugin'`
   - `parallel?: boolean`

2. Add to module (NOT to `CmdDetail`):
   - `let _generation = 0`
   - `function register(cmd: SlashCommand): void` — bumps `_generation`
   - `function unregister(name: string): void` — bumps `_generation`
   - `function list(): SlashCommand[]` — returns all registered entries
   - `function get(name: string): SlashCommand | null`
   - Export `commandCatalog` singleton (or module-level exports)

3. For each of the 91 commands: extract the body from `cli/aiden.ts:handleCommand()`
   into the `handler` field (or a named function called by it). Handler signature:
   `async (args: string[]) => Promise<void>` where `args = parts.slice(1)`.

4. Add the 6 missing commands with their handlers and section assignments (see Gap 1 table).

5. In `cli/aiden.ts:handleCommand()`, replace the 91 if-blocks with a single lookup:
   ```typescript
   const entry = commandCatalog.get(command)
   if (entry) { await entry.handler(args); return true }
   console.log(`  ${T.dim}Unknown command. /help for list.${T.reset}\n`)
   return true
   ```

6. `buildSlashCommands()` already reads `COMMAND_DETAIL` — update it to call
   `commandCatalog.list()` instead, so runtime-registered plugin commands appear.

---

## Unchanged / Out of Scope for Phase 5

- `buildToolList()` (`cli/aiden.ts:5320`) — `@tool` dropdown, already derived from
  `TOOL_DESCRIPTIONS` (Phase 1 C5). No change needed.
- `COMMAND_DETAIL` display metadata (`desc`, `usage`, `subs`, `examples`, `section`) —
  preserved as-is; C2 only adds fields, does not remove existing ones.
- `getCatalog()` — used by `cli/commandPalette.ts`; preserved.
- `core/pluginLoader.ts` wiring — C4.
- Example plugin `/hello` — C4.
