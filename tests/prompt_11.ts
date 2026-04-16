// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_11.ts — 8 zero-cost audits for Prompt 11.1 fixes.
// Run via:  npm run test:audit
// No network. No LLM. No side effects.

import path from 'path'
import { test, assert, assertEquals, assertIncludes, assertExcludes, runAll, appendAuditLog } from './harness'

// ── Helpers ─────────────────────────────────────────────────────────────────

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

// ── Test 1 — panel() no-title border width ───────────────────────────────────
test('panel(): no-title top/bottom border equals body row width', () => {
  const { panel } = require('../core/panel')
  const out   = panel({ lines: ['hello'] })
  const rows  = out.split('\n').map(stripAnsi)
  // top, body, bottom must all have equal visible length
  const [top, body, bottom] = rows
  assert(top.length === body.length,    `top(${top.length}) ≠ body(${body.length})`)
  assert(bottom.length === body.length, `bottom(${bottom.length}) ≠ body(${body.length})`)
})

// ── Test 2 — panel() titled border width ────────────────────────────────────
test('panel(): titled top border equals body row width', () => {
  const { panel } = require('../core/panel')
  const out  = panel({ title: 'Audit Test', lines: ['line one', 'line two'] })
  const rows = out.split('\n').map(stripAnsi)
  const top  = rows[0]
  const body = rows[1]
  assert(top.length === body.length, `titled top(${top.length}) ≠ body(${body.length})`)
})

// ── Test 3 — panel() min width is 50 ────────────────────────────────────────
test('panel(): minimum outer width is 50 chars', () => {
  const { panel } = require('../core/panel')
  const out  = panel({ lines: ['hi'] })
  const rows = out.split('\n').map(stripAnsi)
  // outer width = border char + inner + border char
  // body line = 1 + 2 + inner + pad + 2 + 1
  assert(rows[0].length >= 50, `width ${rows[0].length} < 50`)
})

// ── Test 4 — Skill interface has origin field ────────────────────────────────
test('Skill interface: origin field present on parsed skills', () => {
  const { SkillLoader } = require('../core/skillLoader')
  const loader = new SkillLoader()
  // loadAll() returns [] if no skills dir — that's fine; just verify the type
  const skills = loader.loadAllRaw()
  // If any skills exist, check they have origin
  for (const s of skills) {
    assert('origin' in s, `Skill "${s.name}" missing .origin field`)
    assert(
      s.origin === 'aiden' || s.origin === 'community' || s.origin === 'local',
      `Skill "${s.name}" has invalid origin: "${s.origin}"`
    )
  }
})

// ── Test 5 — origin inference: skills/ → 'aiden', workspace/skills/ → 'local'
test('SkillLoader: origin inferred as aiden vs local from filePath', () => {
  const skillLoader = require('../core/skillLoader')
  // Access the private parse method via a test subclass
  class TestLoader extends skillLoader.SkillLoader {
    testParse(raw: string, fp: string) { return (this as any).parse(raw, fp) }
  }
  const loader = new TestLoader()
  const fakeMd = `---\nname: test-skill\ndescription: Test\nversion: 1.0.0\ntags: test\n---\n# Test`

  const localFp = path.join('C:', 'Users', 'user', 'DevOS', 'workspace', 'skills', 'test-skill', 'SKILL.md')
  const aidenFp = path.join('C:', 'Users', 'user', 'DevOS', 'skills', 'test-skill', 'SKILL.md')
  const local   = loader.testParse(fakeMd, localFp)
  const aiden   = loader.testParse(fakeMd, aidenFp)

  assertEquals(local?.origin, 'local',  `workspace path should be 'local', got '${local?.origin}'`)
  assertEquals(aiden?.origin, 'aiden',  `built-in path should be 'aiden', got '${aiden?.origin}'`)
})

// ── Test 6 — parseLessons() returns [] without throwing on missing file ──────
test('parseLessons(): returns [] safely when LESSONS.md absent', () => {
  const { parseLessons } = require('../core/lessonsBrowser')
  // Override LESSONS_PATH to a nonexistent file
  const lessonsBrowser = require('../core/lessonsBrowser')
  const origPath = lessonsBrowser.LESSONS_PATH

  // The module reads LESSONS_PATH at call time — patch it temporarily
  Object.defineProperty(lessonsBrowser, 'LESSONS_PATH', {
    value: '/nonexistent/path/LESSONS.md',
    writable: true,
    configurable: true,
  })
  let result: any[]
  try {
    result = parseLessons()
  } finally {
    Object.defineProperty(lessonsBrowser, 'LESSONS_PATH', {
      value: origPath,
      writable: true,
      configurable: true,
    })
  }
  assertEquals(Array.isArray(result!), true, 'parseLessons() should return an array')
  assertEquals(result!.length, 0, 'parseLessons() should return [] for missing file')
})

// ── Test 7 — filterLessons() filters by keyword ──────────────────────────────
test('filterLessons(): keyword filter returns correct subset', () => {
  const { filterLessons } = require('../core/lessonsBrowser')
  const lessons = [
    { id: 1, date: '2026-01-01', text: 'Always check file permissions',    category: 'files',   source: 'auto' as const },
    { id: 2, date: '2026-01-02', text: 'Rate limit causes 429 errors',     category: 'provider', source: 'auto' as const },
    { id: 3, date: '2026-01-03', text: 'Replan after three failed retries', category: 'planning', source: 'auto' as const },
  ]
  const byKeyword = filterLessons(lessons, 'rate limit')
  assertEquals(byKeyword.length, 1, 'Should match 1 lesson')
  assertEquals(byKeyword[0].id, 2, 'Should match lesson #2')

  const byCat = filterLessons(lessons, undefined, 'files')
  assertEquals(byCat.length, 1, 'Category filter should return 1 result')
  assertEquals(byCat[0].id, 1, 'Category filter should return lesson #1')
})

// ── Test 8 — COMMAND_DETAIL has no 'Hermes' section ─────────────────────────
test('COMMAND_DETAIL: no section is named Hermes (renamed to Core)', () => {
  // Read the compiled source to check section names
  const src = require('fs').readFileSync(
    require('path').join(process.cwd(), 'cli', 'aiden.ts'),
    'utf-8'
  )
  assertExcludes(src, "section: 'Hermes'", "Found 'section: Hermes' — should have been renamed to Core")
  assertIncludes(src, "section: 'Core'",   "Expected at least one 'section: Core' entry")
})

// ── Run ──────────────────────────────────────────────────────────────────────

;(async () => {
  const results = await runAll()
  const logPath = require('path').join(process.cwd(), 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  process.exit(failed > 0 ? 1 : 0)
})()
