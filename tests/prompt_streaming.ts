// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_streaming.ts — 19 zero-cost audits for the
// feat(streaming): token-by-token rendering, /timing, /version.
// No LLM. No network. No side effects.
// Run via:  npm run test:audit

import path from 'path'
import fs   from 'fs'
import { test, assert, assertIncludes, assertExcludes, runAll, appendAuditLog } from './harness'

const ROOT = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

// ── Test 1 — streamTokens async generator exists ──────────────────────────────
test('streaming: streamTokens async generator exists in server.ts', () => {
  const src = read('api/server.ts')
  assertIncludes(
    src,
    'async function* streamTokens(',
    'streamTokens must be an async generator function',
  )
})

// ── Test 2 — streamTokens handles [DONE] SSE sentinel ────────────────────────
test('streaming: streamTokens returns on [DONE] in SSE path', () => {
  const src = read('api/server.ts')
  assertIncludes(
    src,
    "[DONE]",
    "streamTokens SSE path must handle the [DONE] sentinel",
  )
})

// ── Test 3 — streamTokens parses Ollama NDJSON message?.content ───────────────
test('streaming: streamTokens reads message?.content for Ollama NDJSON', () => {
  const src = read('api/server.ts')
  assertIncludes(
    src,
    'parsed.message?.content',
    'streamTokens must read parsed.message?.content in the Ollama path',
  )
})

// ── Test 4 — Tool-call buffering detects OpenAI tool_calls marker ─────────────
test('streaming: streamTokens buffers and suppresses on "tool_calls":[', () => {
  const src = read('api/server.ts')
  // The literal in server.ts is: toolBuf.includes('"tool_calls":[')
  assertIncludes(
    src,
    `'"tool_calls":['`,
    'streamTokens must check for OpenAI tool_calls marker in buffer',
  )
})


// ── Test 5 — Tool-call buffering detects Anthropic type:tool_use marker ───────
test('streaming: streamTokens buffers and suppresses on "type":"tool_use"', () => {
  const src = read('api/server.ts')
  assertIncludes(
    src,
    '"type":"tool_use"',
    'streamTokens must check for Anthropic tool_use marker in buffer',
  )
})

// ── Test 6 — Old word-split + setTimeout anti-pattern removed ─────────────────
test('streaming: conversational fast-path no longer replays tokens word-by-word', () => {
  const src = read('api/server.ts')
  // The old pattern split the full reply string by spaces for word-by-word replay.
  // reply.split(' ') must no longer appear inside the conversational path.
  assertExcludes(
    src,
    'reply.split(',
    'conversational path must NOT split reply string for word-by-word replay',
  )
})

// ── Test 7 — Conversational fast-path forwards events in real-time ────────────
test('streaming: conversational fast-path forwards events via send(d)', () => {
  const src = read('api/server.ts')
  // The new path calls send(d) inside the streamChat callback
  assertIncludes(
    src,
    'send(d)  // forward meta + token events in real-time',
    'conversational fast-path must forward all events via send(d) in real-time',
  )
})

// ── Test 8 — SSE send wrapper tracks _firstTokenAt ────────────────────────────
test('streaming: SSE send function tracks _firstTokenAt for timing', () => {
  const src = read('api/server.ts')
  assertIncludes(
    src,
    '_firstTokenAt',
    'SSE send wrapper must track _firstTokenAt for first-token latency',
  )
})

// ── Test 9 — SSE done event injects timing shape ─────────────────────────────
test('streaming: SSE done event injects first_token_ms / total_ms / completion_tokens', () => {
  const src = read('api/server.ts')
  assertIncludes(src, 'first_token_ms:', 'SSE done timing must include first_token_ms')
  assertIncludes(src, 'total_ms:',       'SSE done timing must include total_ms')
  assertIncludes(src, 'completion_tokens:', 'SSE done timing must include completion_tokens')
})

// ── Test 10 — CLI state has lastTimingData field ──────────────────────────────
test('streaming: CLI state object has lastTimingData field', () => {
  const src = read('cli/aiden.ts')
  // Field may have alignment spaces before colon: `lastTimingData     :`
  assertIncludes(
    src,
    'lastTimingData',
    'CLI state must declare lastTimingData field',
  )
  assertIncludes(
    src,
    'first_token_ms: number',
    'CLI state lastTimingData must type first_token_ms as number',
  )
})

// ── Test 11 — CLI extracts evt.timing into state.lastTimingData ───────────────
test('streaming: CLI done handler captures evt.timing into state.lastTimingData', () => {
  const src = read('cli/aiden.ts')
  assertIncludes(
    src,
    'state.lastTimingData = evt.timing',
    'CLI must store evt.timing as state.lastTimingData in done event handler',
  )
})

// ── Test 12 — CLI streamChat pauses readline before streaming ─────────────────
test('streaming: CLI streamChat calls _rl.pause() before fetch', () => {
  const src = read('cli/aiden.ts')
  assertIncludes(
    src,
    '_rl.pause()',
    'CLI streamChat must call _rl.pause() before starting token stream',
  )
  // pause must come before resume in the source
  const pauseIdx  = src.indexOf('_rl.pause()')
  const resumeIdx = src.indexOf('_rl.resume()')
  assert(pauseIdx < resumeIdx, '_rl.pause() must appear before _rl.resume() in aiden.ts')
})

// ── Test 13 — CLI streamChat resumes readline in finally block ────────────────
test('streaming: CLI streamChat calls _rl.resume() in finally block', () => {
  const src = read('cli/aiden.ts')
  assertIncludes(
    src,
    '_rl.resume()',
    'CLI streamChat must call _rl.resume() to restore readline after streaming',
  )
  // resume must be inside a finally block — check they appear in order
  const finallyIdx = src.lastIndexOf('} finally {')
  const resumeIdx  = src.indexOf('_rl.resume()')
  assert(resumeIdx > finallyIdx, '_rl.resume() must appear after the finally { block opener')
})

// ── Test 14 — /timing in CLI COMMANDS array ───────────────────────────────────
test('cli: /timing registered in COMMANDS array', () => {
  const src = read('cli/aiden.ts')
  assertIncludes(
    src,
    "'/timing'",
    '/timing must be listed in the COMMANDS array',
  )
})

// ── Test 15 — /timing handler renders first_token_ms ─────────────────────────
test('cli: /timing handler displays first_token_ms timing field', () => {
  const src = read('cli/aiden.ts')
  assertIncludes(
    src,
    'first_token_ms',
    '/timing handler must reference first_token_ms when rendering timing panel',
  )
  // Must also check that the handler guards against missing timing data
  assertIncludes(
    src,
    'No timing data yet',
    '/timing handler must print a message when no timing data is available',
  )
})

// ── Test 16 — /version in CLI COMMANDS array ──────────────────────────────────
test('cli: /version registered in COMMANDS array', () => {
  const src = read('cli/aiden.ts')
  assertIncludes(
    src,
    "'/version'",
    '/version must be listed in the COMMANDS array',
  )
})

// ── Test 17 — /version handler calls checkForUpdate ──────────────────────────
test('cli: /version handler invokes checkForUpdate', () => {
  const src = read('cli/aiden.ts')
  assertIncludes(
    src,
    'checkForUpdate',
    '/version handler must call checkForUpdate to fetch latest version info',
  )
  // Must use dynamic import with timeout argument for /version
  assertIncludes(
    src,
    'checkForUpdate(VERSION, 5000)',
    '/version must pass 5000ms timeout to checkForUpdate',
  )
})

// ── Test 18 — semverGt exported from core/updateCheck.ts ─────────────────────
test('version: semverGt is a named export in core/updateCheck.ts', () => {
  const src = read('core/updateCheck.ts')
  assertIncludes(
    src,
    'export function semverGt(',
    'core/updateCheck.ts must export semverGt as a named function',
  )
})

// ── Test 19 — 6-hour rate limiting constant in updateCheck.ts ────────────────
test('version: updateCheck.ts has 6-hour rate limiting', () => {
  const src = read('core/updateCheck.ts')
  // Either the named constant or the inline expression must be present
  const hasSixHours = src.includes('SIX_HOURS_MS') || src.includes('6 * 60 * 60 * 1000')
  assert(hasSixHours, 'updateCheck.ts must define SIX_HOURS_MS or inline 6 * 60 * 60 * 1000')
  // Rate-limit file path must reference .aiden directory
  assertIncludes(
    src,
    '.aiden',
    'updateCheck.ts must use ~/.aiden/ directory for the rate-limit timestamp file',
  )
})

// ── Runner ────────────────────────────────────────────────────────────────────

runAll().then(results => {
  const logPath = path.join(ROOT, 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  if (failed > 0) process.exit(1)
})
