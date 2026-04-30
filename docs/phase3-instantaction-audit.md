# Phase 3 — InstantAction Audit

Generated: 2026-04-30. Scope: `api/server.ts:148-238` (the 7 remaining InstantActions after
`f92f48d` removed the 8 fake app-launch entries). Purpose: discovery before C2 changes.

---

## Context

The original INSTANT_ACTIONS array had 15 entries numbered 1-15.
Entries 1-8 were `open X / close X / launch X` fakes — removed in `f92f48d`.
The remaining 7 are numbered 9-15 in source comments.

**2 are honest. 5 still fake success by swallowing errors.**

---

## The 5 Fakes — Full Detail

---

### Fake 1: Screenshot (entry #9, `api/server.ts:153-166`)

**Current swallow-pattern code (verbatim):**

```typescript
action: async () => {
  try {
    const result = await executeTool('screenshot', {})
    if (result.success && result.output) return result.output
  } catch {}
  return 'Screenshot taken.'
},
```

Bug: the catch block swallows any throw AND the `if` guard swallows a failed result
(i.e., `result.success === false`). Either path ends at `'Screenshot taken.'`

**Real handler in TOOL_REGISTRY:**

`screenshot` — `core/toolRegistry.ts:1513-1519`

```typescript
screenshot: async (_p: any) => {
  try {
    const filepath = await takeScreenshot()
    const stats    = require('fs').statSync(filepath)
    return { success: true, output: `Screenshot saved: ${filepath} (${Math.round(stats.size / 1024)}kb)`, path: filepath }
  } catch (e: any) { return { success: false, output: '', error: e.message } }
},
```

**What real handler returns:**

- Success: `{ success: true, output: 'Screenshot saved: C:\\Users\\shiva\\...\\screenshot-1234567890.png (234kb)', path: '...' }`
- Failure: `{ success: false, output: '', error: 'screenshot-desktop: command not found' }` or Windows permission error

**Risk:** None. Drop-in. The C2 fix is: remove the empty `catch {}` fallback and return
`result.output` on success, `result.error` on failure.

---

### Fake 2: Volume Up (entry #10, `api/server.ts:167-176`)

**Current swallow-pattern code (verbatim):**

```typescript
action: async () => {
  try {
    await executeTool('shell_exec', { command: 'powershell -c "(New-Object -com WScript.Shell).SendKeys([char]175)"' })
  } catch {}
  return 'Volume up.'
},
```

Bug: result is not captured at all. Success or failure, returns `'Volume up.'`

**Real handler to use in C2:** `system_volume` — `core/toolRegistry.ts:1739-1862`

This is the correct semantic handler. Uses `keybd_event` via P/Invoke (more reliable than
WScript.Shell SendKeys; works without a focused window).

Call: `executeTool('system_volume', { action: 'up' })`

**What real handler returns:**

- Success: `{ success: true, output: 'Volume increased by ~20%' }`
- Failure: `{ success: false, output: '', error: '<PowerShell error or timeout>' }`

**Risk:** Low. `system_volume` uses `execSync` + temp `.ps1` file — can throw if
`powershell.exe` is unavailable (edge case). Fallback message should name the attempted
action. Note: success means the keypress was sent; Windows audio stack processes it
asynchronously — we cannot confirm the hardware responded, but this is the best available
signal short of a Win32 audio query.

---

### Fake 3: Volume Down (entry #11, `api/server.ts:177-186`)

**Current swallow-pattern code (verbatim):**

```typescript
action: async () => {
  try {
    await executeTool('shell_exec', { command: 'powershell -c "(New-Object -com WScript.Shell).SendKeys([char]174)"' })
  } catch {}
  return 'Volume down.'
},
```

Identical pattern to Volume Up. Returns `'Volume down.'` regardless of outcome.

**Real handler:** `system_volume` — `core/toolRegistry.ts:1739-1862`

Call: `executeTool('system_volume', { action: 'down' })`

**What real handler returns:**

- Success: `{ success: true, output: 'Volume decreased by ~20%' }`
- Failure: `{ success: false, output: '', error: '<PowerShell error or timeout>' }`

**Risk:** Same as Volume Up. Drop-in for C2.

---

### Fake 4: Mute / Unmute (entry #12, `api/server.ts:187-196`)

**Current swallow-pattern code (verbatim):**

```typescript
action: async () => {
  try {
    await executeTool('shell_exec', { command: 'powershell -c "(New-Object -com WScript.Shell).SendKeys([char]173)"' })
  } catch {}
  return 'Toggled mute.'
},
```

Patterns: `/^(?:toggle\s+)?mute\s*$/i` and `/^unmute\s*$/i` — both route here.
Returns `'Toggled mute.'` regardless of outcome.

**Real handler:** `system_volume` — `core/toolRegistry.ts:1797-1801`

```typescript
if (action === 'mute' || action === 'unmute') {
  runPs(keybdScript(173), 'mute')
  return { success: true, output: action === 'mute' ? 'Muted' : 'Unmuted (toggle)' }
}
```

Call for "mute" patterns: `executeTool('system_volume', { action: 'mute' })`
Call for "unmute" pattern: `executeTool('system_volume', { action: 'unmute' })`

**What real handler returns:**

- Success: `{ success: true, output: 'Muted' }` or `{ success: true, output: 'Unmuted (toggle)' }`
- Failure: `{ success: false, output: '', error: '<PowerShell error>' }`

**Risk:** Low. VK_VOLUME_MUTE (0xAD = 173) is a hardware toggle — both 'mute' and 'unmute'
send the same keypress. `system_volume` returns 'Unmuted (toggle)' for 'unmute' because it
cannot query the current mute state before toggling. Acceptable — more honest than
`'Toggled mute.'` with no error surface.

**C2 approach:** In the action callback, detect which pattern matched to pick `'mute'` vs
`'unmute'`. The InstantAction `action` receives `(match, message)` — use `message` to
discriminate: if message starts with `unmute`, call `{ action: 'unmute' }`.

---

### Fake 5: Lock Screen (entry #15, `api/server.ts:229-238`)

**Current swallow-pattern code (verbatim):**

```typescript
action: async () => {
  try {
    await executeTool('shell_exec', { command: 'rundll32.exe user32.dll,LockWorkStation' })
  } catch {}
  return 'Locking screen...'
},
```

Result not captured. Returns `'Locking screen...'` regardless of outcome.

**Real handler:** `shell_exec` — `core/toolRegistry.ts:519-630` (same tool, same command)

There is no dedicated `lock_screen` tool in TOOL_REGISTRY. `shell_exec` with
`rundll32.exe user32.dll,LockWorkStation` is the correct call.
The command is explicitly in SHELL_ALLOWLIST at `toolRegistry.ts:176`: `/^rundll32\b/i`.

**What real handler returns:**

- Success: `{ success: true, output: '(completed)' }` — rundll32 produces no stdout; exit
  code 0 is the success signal.
- Failure: `{ success: false, output: '', error: 'Exit 1' }` or `error: 'Blocked by
  permission system.'` if permissions.yaml denies it.

**Risk:** Low with one caveat. `rundll32.exe user32.dll,LockWorkStation` exits immediately
before the screen visually locks — the OS schedules the lock asynchronously. `result.success
= true` means rundll32 ran and exited 0, not that the screen is visually locked yet. In
normal Windows desktop sessions this is reliable. In a headless or service session,
rundll32 may exit 0 without locking. Acceptable trade-off — still far more honest than
the current unconditional `'Locking screen...'`.

---

## The 2 Honest Ones — Stay As-Is

**Set Timer (entry #13, `api/server.ts:197-213`):** The timer is real — `setTimeout` fires
and calls `notify`. The notify failure is swallowed but it is a background event, not the
primary action. The return string `'Timer set for N units. I will notify you when it is
done.'` correctly describes what was done (a timer was scheduled). Not a fake-success bug.

**System Info (entry #14, `api/server.ts:214-228`):** Already checks `result.success`:
`if (result.success) return ...formatted...`. Failure falls through to `'Could not
retrieve system info.'` — honest. No change needed.

---

## C2 Change Plan (preview — no code yet)

| Entry | Current handler | C2 handler | Change |
|-------|----------------|------------|--------|
| screenshot | `executeTool('screenshot', {})` with catch swallow | same tool, surface `result.error` | remove empty catch + fallback string |
| volume_up | `shell_exec` with WScript.Shell SendKeys | `system_volume({ action: 'up' })` | replace tool + surface error |
| volume_down | `shell_exec` with WScript.Shell SendKeys | `system_volume({ action: 'down' })` | replace tool + surface error |
| mute/unmute | `shell_exec` with WScript.Shell SendKeys | `system_volume({ action: 'mute|unmute' })` | replace tool, discriminate by message |
| lock_screen | `shell_exec` with result ignored | same tool, check `result.success` | capture result + surface error |

Estimated: ~50 LOC changed, no new files.

---

## Line Reference

| Entry | Lines (api/server.ts) | Fake? |
|-------|-----------------------|-------|
| #9 Take Screenshot | 153–166 | ❌ fake |
| #10 Volume Up | 167–176 | ❌ fake |
| #11 Volume Down | 177–186 | ❌ fake |
| #12 Mute / Unmute | 187–196 | ❌ fake |
| #13 Set Timer | 197–213 | ✅ honest |
| #14 System Info | 214–228 | ✅ honest |
| #15 Lock Screen | 229–238 | ❌ fake |
