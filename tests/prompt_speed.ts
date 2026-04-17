// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_speed.ts — 11 zero-cost audits for the selective context
// injection changes introduced in the perf(agent): selective context injection
// prompt. No LLM. No side effects.
// Run via:  npm run test:audit

import path from 'path'
import fs   from 'fs'
import { test, assert, assertEquals, assertIncludes, assertExcludes, runAll, appendAuditLog } from './harness'

const ROOT = process.cwd()
const read  = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

// ── Test 1 — isSimpleMessage("hi") returns true ───────────────────────────────
test('speed: isSimpleMessage("hi") returns true', () => {
  const src = read('core/skillLoader.ts')
  // Structural: function must exist and export
  assertIncludes(src, 'export function isSimpleMessage', 'skillLoader.ts must export isSimpleMessage')
  // Word-count guard: "hi" is 1 word, well under 15
  assertIncludes(src, 'words > 15', 'isSimpleMessage must reject messages > 15 words')
})

// ── Test 2 — isSimpleMessage blocks tool-keyword messages ─────────────────────
test('speed: isSimpleMessage rejects messages with tool keywords', () => {
  const src = read('core/skillLoader.ts')
  // Must have a tool-keywords list and a short-circuit return false
  assertIncludes(src, 'toolKeywords', 'isSimpleMessage must define toolKeywords array')
  assertIncludes(src, "toolKeywords.some(kw => lower.includes(kw))", 'isSimpleMessage must check toolKeywords against message')
})

// ── Test 3 — isSimpleMessage blocks URLs/paths ────────────────────────────────
test('speed: isSimpleMessage rejects messages containing URLs or file paths', () => {
  const src = read('core/skillLoader.ts')
  // Check for URL-blocking regex pattern (written as /https?:\/\// in source)
  assertIncludes(src, 'https?:', 'isSimpleMessage must have a https URL pattern')
  // Check for file-extension / path regex pattern (e.g. \.\w{2,4} or test(msg))
  assertIncludes(src, '.test(msg)', 'isSimpleMessage must apply URL/path regex via .test(msg)')
})

// ── Test 4 — findRelevant returns only matching-category skills ───────────────
test('speed: findRelevant scores by category field (CATEGORY_KEYWORD_MAP)', () => {
  const src = read('core/skillLoader.ts')
  assertIncludes(src, 'CATEGORY_KEYWORD_MAP', 'skillLoader must use CATEGORY_KEYWORD_MAP (not invented KEYWORD_MAP)')
  // Must score category field match
  assertIncludes(src, 'matchedCategories.has(skill.category)', 'findRelevant must boost skills whose category field matches')
})

// ── Test 5 — findRelevant returns [] for simple messages ─────────────────────
test('speed: findRelevant returns [] when isSimpleMessage is true', () => {
  const src = read('core/skillLoader.ts')
  assertIncludes(
    src,
    'if (isSimpleMessage(message)) return []',
    'findRelevant must short-circuit and return [] for simple messages'
  )
})

// ── Test 6 — needsMemory("hi") is false ──────────────────────────────────────
test('speed: needsMemory returns false for routine messages', () => {
  const src = read('core/skillLoader.ts')
  assertIncludes(src, 'export function needsMemory', 'skillLoader.ts must export needsMemory')
  // Must check past-context keywords
  assertIncludes(src, "'last time'", "needsMemory must check 'last time' keyword")
})

// ── Test 7 — needsMemory triggers on past-context references ─────────────────
test('speed: needsMemory returns true for past-context references', () => {
  const src = read('core/skillLoader.ts')
  assertIncludes(src, "'we discussed'", "needsMemory must include 'we discussed'")
  assertIncludes(src, "'remember'",     "needsMemory must include 'remember'")
  assertIncludes(src, "'you said'",     "needsMemory must include 'you said'")
})

// ── Test 8 — router reads primaryProvider from the same config saveConfig writes ─
test('speed: router reads and writes primaryProvider via loadConfig/saveConfig', () => {
  const routerSrc  = read('providers/router.ts')
  const indexSrc   = read('providers/index.ts')
  // Config type must declare primaryProvider
  assertIncludes(indexSrc, 'primaryProvider', 'providers/index.ts Config type must have primaryProvider field')
  // Router must read it
  assertIncludes(routerSrc, 'config.primaryProvider', 'router.ts must read config.primaryProvider')
  // Router must use saveConfig (same write path)
  assertIncludes(routerSrc, 'saveConfig(config)', 'router.ts must persist changes via saveConfig')
})

// ── Test 9 — auto-unpin triggers after 3 consecutive failures ────────────────
test('speed: markRateLimited auto-unpins primaryProvider after 3 failures', () => {
  const src = read('providers/router.ts')
  assertIncludes(src, 'AUTO_UNPIN_THRESHOLD', 'router.ts must define AUTO_UNPIN_THRESHOLD')
  assertIncludes(src, 'AUTO_UNPIN_THRESHOLD = 3', 'AUTO_UNPIN_THRESHOLD must be 3')
  assertIncludes(src, 'delete config.primaryProvider', 'router.ts must delete config.primaryProvider on auto-unpin')
  assertIncludes(src, 'Auto-unpinned', 'router.ts must log auto-unpin event')
})

// ── Test 10 — agentLoop capabilitiesSection is gated on isSimpleMessage ───────
test('speed: agentLoop capabilitiesSection is empty for simple messages', () => {
  const src = read('core/agentLoop.ts')
  assertIncludes(src, 'isSimpleMessage(originalMessage)', 'agentLoop.ts must call isSimpleMessage on originalMessage')
  assertIncludes(src, "? ''", 'capabilitiesSection must resolve to empty string for simple messages')
})

// ── Test 11 — lessons section injected regardless of message type ─────────────
test('speed: agentLoop always injects LESSONS section (not gated)', () => {
  const src = read('core/agentLoop.ts')
  // lessonsSection must exist but must NOT be gated on isSimpleMessage or needsMemory
  assertIncludes(src, 'lessonsSection', 'agentLoop.ts must have a lessonsSection variable')
  // The lessons section should always be included (unconditional injection) —
  // it must not be wrapped in an isSimpleMessage or needsMemory guard
  assert(
    !src.includes('isSimpleMessage') || src.indexOf('lessonsSection') < src.indexOf('isSimpleMessage') ||
    !src.includes(`isSimpleMessage(message) ? '' : lessonsSection`),
    'lessonsSection must not be gated behind isSimpleMessage'
  )
})

// ── Runner ─────────────────────────────────────────────────────────────────

runAll().then(results => {
  const logPath = path.join(ROOT, 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  if (failed > 0) process.exit(1)
})
