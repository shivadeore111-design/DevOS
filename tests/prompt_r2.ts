// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_r2.ts — 8 zero-cost audits for Prompt R2
// (Cloudflare Worker landing page updated to v3.6.0).
// Run via:  npm run test:audit
// No LLM. No network. No side effects.

import path from 'path'
import fs   from 'fs'
import { test, assert, assertIncludes, assertExcludes, runAll, appendAuditLog } from './harness'

const LANDING = path.join(process.cwd(), 'cloudflare-worker', 'landing.js')

// ── Test 1 — landing.js exists and is non-empty ───────────────────────────────
test('r2: cloudflare-worker/landing.js exists and is non-trivial', () => {
  assert(fs.existsSync(LANDING), 'cloudflare-worker/landing.js must exist')
  const stat = fs.statSync(LANDING)
  assert(stat.size > 10_000, 'landing.js must be >10 KB (full page included)')
})

// ── Test 2 — no stale v3.3.1 version strings ────────────────────────────────
test('r2: landing.js contains zero occurrences of 3.3.1', () => {
  const content = fs.readFileSync(LANDING, 'utf-8')
  assertExcludes(content, '3.3.1', 'All 3.3.1 references must be updated to current version')
})

// ── Test 3 — nav badge shows v3.6.0 ──────────────────────────────────────────
test('r2: nav badge contains v3.6.0', () => {
  const content = fs.readFileSync(LANDING, 'utf-8')
  assert(
    content.includes('v3.6.0') && content.includes('free to download'),
    'Nav badge must read "v3.6.0 · free to download"',
  )
})

// ── Test 4 — hero JUST UPDATED badge shows v3.6.0 ────────────────────────────
test('r2: hero "JUST UPDATED" badge shows v3.6.0', () => {
  const content = fs.readFileSync(LANDING, 'utf-8')
  assert(
    content.includes('JUST UPDATED') && content.includes('v3.6.0'),
    'Hero badge must read "JUST UPDATED — v3.6.0"',
  )
})

// ── Test 5 — download URL points to v3.6.0 release ───────────────────────────
test('r2: download URL references v3.6.0/Aiden-Setup-3.6.0.exe', () => {
  const content = fs.readFileSync(LANDING, 'utf-8')
  assertIncludes(
    content,
    'download/v3.6.0/Aiden-Setup-3.6.0.exe',
    'Download href must point to v3.6.0/Aiden-Setup-3.6.0.exe',
  )
})

// ── Test 6 — download section h2 shows v3.6.0 ────────────────────────────────
test('r2: download section h2 reads "Download Aiden v3.6.0"', () => {
  const content = fs.readFileSync(LANDING, 'utf-8')
  assertIncludes(content, 'Download Aiden v3.6.0', 'Download h2 must reference v3.6.0')
})

// ── Test 7 — Razorpay integration preserved (11 occurrences) ─────────────────
test('r2: Razorpay integration preserved (≥1 occurrence)', () => {
  const content = fs.readFileSync(LANDING, 'utf-8')
  const count = (content.match(/razorpay/gi) || []).length
  assert(count >= 1, `Razorpay must still be present; found ${count} occurrences`)
})

// ── Test 8 — exactly 5 occurrences of 3.6.0 in landing.js ───────────────────
test('r2: exactly 5 occurrences of "3.6.0" in landing.js', () => {
  const content = fs.readFileSync(LANDING, 'utf-8')
  const count = (content.match(/3\.6\.0/g) || []).length
  assert(count === 5, `Expected exactly 5 occurrences of 3.6.0, found ${count}`)
})

// ── Run ───────────────────────────────────────────────────────────────────────

;(async () => {
  const results = await runAll()
  const logPath = path.join(process.cwd(), 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  process.exit(failed > 0 ? 1 : 0)
})()
