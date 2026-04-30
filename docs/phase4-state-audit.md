# Phase 4 State Audit — Startup Volatile State

Generated: 2026-04-30. Reference for C4 (trim startup dump).

---

## What this doc covers

Every injection site in `api/server.ts` `streamChat()` that contributes to the
first-message system prompt. Each entry is categorized STABLE (keep) or VOLATILE
(remove in C4), with the exact line(s) to touch in C4.

Manus principle driving the cuts (doc 11, section "Real-time State vs. Remembered
State"): volatile state must be re-checked via tool calls per turn, never answered
from cached context. Injecting it at session start trades accuracy for a snapshot
that is wrong by message 2.

Latency note (doc 17): the `firstMessageContext` block runs 3 parallel tool calls
before the first response. Removing it reduces first-response latency by those 3
shell/tool round-trips (~200–600 ms on a warm system).

---

## Injection sites — `api/server.ts`

### 1. Open windows + RAM — VOLATILE

| Field | Value |
|-------|-------|
| Lines | 6447 |
| Call | `executeTool('shell_exec', { command: 'Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | ...' })` |
| Data produced | List of processes with visible windows + RAM in MB |
| Why volatile | Changes on every app launch/close/minimize; stale by next user message |
| C4 action | **DELETE** — move to `system_state` tool (C5 candidate, or on-demand only) |

### 2. Disk usage (C: drive) — VOLATILE

| Field | Value |
|-------|-------|
| Lines | 6448 |
| Call | `executeTool('shell_exec', { command: 'Get-PSDrive C | ...' })` |
| Data produced | Used GB / Free GB on C: |
| Why volatile | Changes with downloads, cache, installs; wrong within minutes |
| C4 action | **DELETE** — expose via `system_state` tool on demand |

### 3. Hardware info — SEMI-STABLE → REMOVE

| Field | Value |
|-------|-------|
| Lines | 6446 |
| Call | `executeTool('system_info', {})` |
| Data produced | GPU name, VRAM, total RAM, CPU, OS version |
| Why semi-stable | Specs don't change mid-session, but: (a) costs a tool call on every new session, (b) total RAM ≠ available RAM, (c) consistent with the principle that system state belongs behind a tool |
| C4 action | **DELETE** from startup injection. `system_info` tool remains registered and callable on demand. |

### 4. `firstMessageContext` assembled string + instruction — VOLATILE

| Field | Value |
|-------|-------|
| Lines | 6442–6455 (entire `if (isFirstMessage)` block) |
| Content | The three data items above + the "show awareness of their machine" instruction text |
| C4 action | **DELETE entire block** (lines 6441–6455 inclusive — `isFirstMessage` declaration through closing `}`) |

**Exact C4 deletion target:**
```
const isFirstMessage = history.length === 0      ← DELETE
let firstMessageContext = ''                      ← DELETE
if (isFirstMessage) {                            ← DELETE
  try {                                          ← DELETE
    const [sysResult, ...] = await Promise...    ← DELETE
    ...                                          ← DELETE
    firstMessageContext = `\n\nSYSTEM CONTEXT...`← DELETE
  } catch { }                                    ← DELETE
}                                                ← DELETE
```

Also remove `firstMessageContext` from the template literal at line 6527:
```
${cognitionHint}${firstMessageContext}${memoryContext}...
                ^^^^^^^^^^^^^^^^^^^^^^^^^^
                remove this interpolation only
```

Also remove the `sessionContext` guard that depends on `isFirstMessage` (lines
6480–6486) — or keep it if session context is judged stable (see below).

---

### 5. Windows username — STABLE

| Field | Value |
|-------|-------|
| Lines | 6498 |
| Source | `process.env.USERNAME \|\| process.env.USER \|\| os.userInfo().username` |
| Data | Windows login name |
| Why stable | Does not change within a session; correct across restarts |
| C4 action | **KEEP** |

### 6. Home / Desktop / Documents / Downloads paths — STABLE

| Field | Value |
|-------|-------|
| Lines | 6499–6500 |
| Source | `os.homedir()` + `path.join()` |
| Data | Canonical paths for file operations |
| Why stable | Static for the life of the OS install |
| C4 action | **KEEP** |

### 7. Current date — STABLE (injected at message time)

| Field | Value |
|-------|-------|
| Lines | 6505 |
| Source | `new Date().toLocaleDateString(...)` |
| Data | "Thursday, April 30, 2026" |
| Why stable | Evaluated at each message; always correct |
| C4 action | **KEEP** |

### 8. Prior session context — STABLE (session-scoped)

| Field | Value |
|-------|-------|
| Lines | 6480–6486 |
| Source | `sessionMemory.getLastContext(sessionId)` |
| Data | What was discussed in previous sessions |
| Why stable | Read once from persisted log; not real-time system state |
| C4 action | **KEEP** — but remove the `isFirstMessage` guard so it's available every turn (low priority, out of Phase 4 scope) |

### 9. Memory index — STABLE (session-scoped)

| Field | Value |
|-------|-------|
| Lines | 6489–6493 |
| Source | `memoryExtractor.loadMemoryIndex()` |
| Data | Long-term conversation index |
| Why stable | Append-only, correct at read time |
| C4 action | **KEEP** |

### 10. Cognition hint — STABLE

| Field | Value |
|-------|-------|
| Lines | 6457 |
| Source | `userCognitionProfile.getSystemPromptAddition()` |
| Data | User verbosity/technical-level preferences |
| Why stable | User profile; does not change per-session |
| C4 action | **KEEP** |

### 11. Memory context (semantic recall) — STABLE (per-message)

| Field | Value |
|-------|-------|
| Lines | 6460–6467 |
| Source | `unifiedMemoryRecall(message, 5)` |
| Data | Past conversations relevant to current message |
| Why stable | Query is against current message; result is correct at call time |
| C4 action | **KEEP** |

### 12. Greeting preamble — STABLE (session-scoped)

| Field | Value |
|-------|-------|
| Lines | 6471–6477 |
| Source | `buildGreetingPreamble(sessionId)` |
| Data | Last session summary, active goals, username |
| Why stable | Reads persisted files, not live system state |
| C4 action | **KEEP** |

---

## Summary table

| # | Data | Lines | Decision |
|---|------|-------|----------|
| 1 | Open windows + RAM | 6447 | **REMOVE** (C4) |
| 2 | Disk usage | 6448 | **REMOVE** (C4) |
| 3 | Hardware info | 6446 | **REMOVE** (C4) |
| 4 | `firstMessageContext` block | 6441–6455 | **REMOVE** (C4) |
| 5 | Windows username | 6498 | KEEP |
| 6 | Home/Desktop/Docs/Downloads paths | 6499–6500 | KEEP |
| 7 | Current date | 6505 | KEEP |
| 8 | Prior session context | 6480–6486 | KEEP |
| 9 | Memory index | 6489–6493 | KEEP |
| 10 | Cognition hint | 6457 | KEEP |
| 11 | Semantic memory recall | 6460–6467 | KEEP |
| 12 | Greeting preamble | 6471–6477 | KEEP |

**Net C4 change:** delete lines 6441–6455 + remove `${firstMessageContext}` from
the template at line 6527. All other injection sites stay.

---

## Tools to build (C2–C3)

| Tool | File | What it replaces |
|------|------|-----------------|
| `now_playing` | `core/tools/nowPlaying.ts` | Nothing — new capability |
| `browser_tabs` | `core/tools/browserTabs.ts` | Nothing — new capability |
| `system_state` | refactor of `system_info` or new file | On-demand RAM/disk/windows |

`system_state` is a stretch goal for Phase 4 — the core ask is `now_playing` +
`browser_tabs`. The existing `system_info` tool already handles hardware specs
on demand; `shell_exec` handles disk/process queries. A dedicated `system_state`
tool is a clean-up, not a blocker.

---

## SOUL.md instruction needed (C4)

All 3 SOUL.md copies need this rule added to the tool-use section (packages/aiden-os/templates/SOUL.md does not exist — ships only bin/ + README.md via npm):

> For current system state — what music is playing, which windows are open,
> current RAM/disk usage, browser tabs — call the appropriate tool every time.
> Never answer from session context or prior observations. State changes between
> messages.

---

## Open questions for C2

1. **PowerShell WinRT access**: `GlobalSystemMediaTransportControlsSessionManager`
   is accessible via PowerShell on Windows 10 1903+ and Windows 11 using the
   `[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,
   Windows.Media.Control, ContentType=WindowsRuntime]` type accelerator.
   Must verify this works from a Node child_process spawn (not just an
   interactive PS session) before committing.

2. **CDP for browser_tabs**: Chrome DevTools Protocol requires Chrome/Edge to be
   launched with `--remote-debugging-port=9222`. If the user's browser is not
   launched that way, CDP returns nothing. Fallback strategy needed — see C3.
