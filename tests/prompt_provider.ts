// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_provider.ts — 10 zero-cost audits for the fix(provider): pin
// primary provider bug fix. No LLM. No side effects.
// Run via:  npm run test:audit

import path from 'path'
import fs   from 'fs'
import { test, assert, assertIncludes, assertExcludes, runAll, appendAuditLog } from './harness'

const ROOT   = process.cwd()
const read   = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

// ── Test 1 — raceProviders checks primaryProvider before racing ───────────────
test('provider: raceProviders has pin-first check for primaryProvider', () => {
  const src = read('api/server.ts')
  // Must read primaryProvider from config inside raceProviders
  assertIncludes(src, 'cfg.primaryProvider', 'raceProviders must check cfg.primaryProvider')
  // Must find matching API entry by name or provider slug
  assertIncludes(
    src,
    'a.name === cfg.primaryProvider || a.provider === cfg.primaryProvider',
    'raceProviders must match pinned provider by name or provider slug',
  )
})

// ── Test 2 — raceProviders uses pinned provider exclusively when set ──────────
test('provider: raceProviders calls fetchProviderResponse on pin, skips racing', () => {
  const src = read('api/server.ts')
  // Must log pin use
  assertIncludes(src, 'raceProviders → pinned:', 'raceProviders must log pin selection')
  // The pinned fetch happens BEFORE the .filter(...).slice(...) racing block
  const pinIdx  = src.indexOf('raceProviders → pinned:')
  const raceIdx = src.indexOf('.slice(0, topN)')
  assert(pinIdx < raceIdx, 'pin-first block must appear before the racing .slice() block')
})

// ── Test 3 — raceProviders falls back to racing when pinned provider fails ────
test('provider: raceProviders falls back to race on pin failure', () => {
  const src = read('api/server.ts')
  assertIncludes(
    src,
    'Pinned provider',
    'raceProviders must log fallback when pinned provider fails',
  )
  assertIncludes(
    src,
    'falling back to race',
    'raceProviders must say "falling back to race" on pin failure',
  )
  // After the catch, the racing path must still execute (.slice)
  const catchIdx = src.indexOf('falling back to race')
  const sliceIdx = src.indexOf('.slice(0, topN)')
  assert(catchIdx < sliceIdx, 'race fallback must come before the .slice() racing block')
})

// ── Test 4 — fetchProviderResponse returns model in result ────────────────────
test('provider: fetchProviderResponse returns { text, apiName, model }', () => {
  const src = read('api/server.ts')
  // All three return paths must include model in the return object
  const returnMatches = [...src.matchAll(/return \{ text:.*apiName: api\.name,\s*model \}/g)]
  assert(
    returnMatches.length >= 3,
    `fetchProviderResponse must have 3 return paths all including model (found ${returnMatches.length})`,
  )
})

// ── Test 5 — streamChat emits meta event before first token (race path) ───────
test('provider: streamChat emits meta event after raceProviders succeeds', () => {
  const src = read('api/server.ts')
  assertIncludes(
    src,
    "send({ event: 'meta', provider: raceResult.apiName, model: raceResult.model })",
    'streamChat must emit meta event with raceResult provider and model',
  )
  // meta send must come before the token-streaming loop
  const metaIdx  = src.indexOf("send({ event: 'meta', provider: raceResult.apiName")
  const wordsIdx = src.indexOf('raceResult.text.split')
  assert(metaIdx < wordsIdx, 'meta event must be sent before word-streaming loop')
})

// ── Test 6 — streamChat emits meta event in sequential fallback path ──────────
test('provider: streamChat emits meta event in sequential (non-race) path', () => {
  const src = read('api/server.ts')
  assertIncludes(
    src,
    "send({ event: 'meta', provider: providerType, model: activeStreamModel })",
    'streamChat must emit meta event in sequential fallback with providerType + activeStreamModel',
  )
})

// ── Test 7 — CLI handles meta SSE event and updates state ────────────────────
test('provider: CLI SSE loop handles evt.event === "meta"', () => {
  const src = read('cli/aiden.ts')
  assertIncludes(src, "evt.event === 'meta'", "CLI must handle evt.event === 'meta'")
  assertIncludes(src, 'state.lastProvider = evt.provider', 'CLI meta handler must update state.lastProvider')
  assertIncludes(src, 'state.lastModel    = evt.model',    'CLI meta handler must update state.lastModel')
})

// ── Test 8 — /primary list uses /api/providers/state ─────────────────────────
test('provider: /primary list fetches /api/providers/state', () => {
  const src = read('cli/aiden.ts')
  assertIncludes(src, "arg === 'list'",              "/primary must handle 'list' subcommand")
  assertIncludes(src, '/api/providers/state',        "/primary list must call /api/providers/state")
  assertIncludes(src, 'p.isPrimary',                 '/primary list must show isPrimary flag')
})

// ── Test 9 — /primary <unknown> validates before pinning ─────────────────────
test('provider: /primary <unknown> errors without mutation', () => {
  const src = read('cli/aiden.ts')
  // Must fetch providers and check for match before POSTing
  assertIncludes(
    src,
    'Unknown provider',
    '/primary must print "Unknown provider" error for unrecognised names',
  )
  // The validation error print must appear before the /api/config/primary POST
  const validIdx = src.indexOf('Unknown provider')
  const postIdx  = src.indexOf("body: JSON.stringify({ name: arg })")
  assert(validIdx < postIdx, 'validation must appear before /api/config/primary POST in /primary handler')
})

// ── Test 10 — /api/providers/state returns isPrimary per entry ────────────────
test('provider: /api/providers/state marks isPrimary correctly', () => {
  const src = read('api/server.ts')
  assertIncludes(
    src,
    'isPrimary:           primary ? (api.name === primary || api.provider === primary) : false',
    '/api/providers/state must set isPrimary based on primaryProvider match',
  )
})

// ── Runner ────────────────────────────────────────────────────────────────────

runAll().then(results => {
  const logPath = path.join(ROOT, 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  if (failed > 0) process.exit(1)
})
