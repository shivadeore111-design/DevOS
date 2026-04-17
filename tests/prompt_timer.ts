// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_timer.ts — 10 zero-cost audits for the live-timer + version
// hygiene + skills gate hardening introduced in the live-timer-and-fixes prompt.
// Run via:  npm run test:audit
// No LLM. No side effects.

import path from 'path'
import fs   from 'fs'
import { test, assert, assertEquals, assertIncludes, assertExcludes, runAll, appendAuditLog } from './harness'

const ROOT = process.cwd()
const read  = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

// ── Test 1 — cli/aiden.ts shows elapsed seconds in spinner ───────────────────
test('timer: cli/aiden.ts renderActivity() shows elapsed seconds', () => {
  const src = read('cli/aiden.ts')
  assert(
    src.includes('elapsedSec') || src.includes('toFixed(1)'),
    'cli/aiden.ts must contain elapsed-seconds logic in renderActivity()'
  )
})

// ── Test 2 — cli/aiden.ts status bar uses per-message elapsed ────────────────
test('timer: cli/aiden.ts status bar passes startedAt-based elapsedMs', () => {
  const src = read('cli/aiden.ts')
  assert(
    src.includes('Date.now() - startedAt'),
    'cli/aiden.ts must use "Date.now() - startedAt" for per-message elapsed in status bar'
  )
})

// ── Test 3 — cli/aiden.ts printBanner reads version from package.json ────────
test('timer: cli/aiden.ts printBanner reads version from package.json', () => {
  const src = read('cli/aiden.ts')
  assert(
    src.includes("require('../package.json')") || src.includes('require("../package.json")'),
    'cli/aiden.ts printBanner must require package.json for version'
  )
})

// ── Test 4 — electron/preload.js has no hardcoded 3.5.0 ─────────────────────
test('timer: electron/preload.js has no hardcoded 3.5.0', () => {
  const src = read('electron/preload.js')
  assertExcludes(src, "'3.5.0'", 'electron/preload.js must not contain hardcoded "3.5.0"')
  assertExcludes(src, '"3.5.0"', 'electron/preload.js must not contain hardcoded "3.5.0"')
})

// ── Test 5 — cloudflare-worker/license-server.js has no 3.5.0 references ────
test('timer: cloudflare-worker/license-server.js has no 3.5.0 references', () => {
  const src = read('cloudflare-worker/license-server.js')
  assertExcludes(src, '3.5.0', 'cloudflare-worker/license-server.js must not contain 3.5.0')
})

// ── Test 6 — index.ts fallback is not 3.5.0 ─────────────────────────────────
test('timer: index.ts startup log fallback is not 3.5.0', () => {
  const src = read('index.ts')
  // The line we fixed: return '3.5.0' fallback in startup log
  assert(
    !src.includes("return '3.5.0'"),
    'index.ts must not contain "return \'3.5.0\'" — should be 3.6.0'
  )
})

// ── Test 7 — skillTeacher.ts min size gate is 200 bytes ──────────────────────
test('timer: core/skillTeacher.ts min size gate is 200 bytes', () => {
  const src = read('core/skillTeacher.ts')
  assert(
    src.includes('byteLen < 200'),
    'core/skillTeacher.ts size gate must be 200 bytes minimum (not 50)'
  )
  assertExcludes(src, 'byteLen < 50', 'core/skillTeacher.ts must not have old 50-byte gate')
})

// ── Test 8 — skillTeacher.ts session rate limit exists ───────────────────────
test('timer: core/skillTeacher.ts has SESSION_SKILL_LIMIT = 2', () => {
  const src = read('core/skillTeacher.ts')
  assert(
    src.includes('SESSION_SKILL_LIMIT'),
    'core/skillTeacher.ts must define SESSION_SKILL_LIMIT'
  )
  assert(
    src.includes('SESSION_SKILL_LIMIT = 2'),
    'core/skillTeacher.ts SESSION_SKILL_LIMIT must be 2'
  )
})

// ── Test 9 — skillTeacher.ts dedup checks bundled skills/ dir ────────────────
test('timer: core/skillTeacher.ts dedup includes BUNDLED_SKILLS_DIR', () => {
  const src = read('core/skillTeacher.ts')
  assert(
    src.includes('BUNDLED_SKILLS_DIR'),
    'core/skillTeacher.ts must define and use BUNDLED_SKILLS_DIR for deduplication'
  )
})

// ── Test 10 — workspace/skills/learned and approved are empty ────────────────
test('timer: workspace/skills/learned/ and approved/ are empty', () => {
  const learnedDir  = path.join(ROOT, 'workspace', 'skills', 'learned')
  const approvedDir = path.join(ROOT, 'workspace', 'skills', 'approved')

  for (const [label, dir] of [['learned', learnedDir], ['approved', approvedDir]] as const) {
    if (!fs.existsSync(dir)) continue   // dir not present is also acceptable
    const entries = fs.readdirSync(dir).filter(e => {
      try { return fs.statSync(path.join(dir, e)).isDirectory() } catch { return false }
    })
    assertEquals(
      entries.length, 0,
      `workspace/skills/${label}/ must be empty, found: ${entries.join(', ')}`
    )
  }
})

// ── Runner ─────────────────────────────────────────────────────────────────

runAll().then(results => {
  const logPath = path.join(ROOT, 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  if (failed > 0) process.exit(1)
})
