// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_15.ts — 8 zero-cost audits for Prompt 15 (Aiden skill wave 1).
// Run via:  npm run test:audit
// No LLM. No side effects. Verifies skill file structure and catalog integrity.

import path from 'path'
import fs   from 'fs'
import { test, assert, assertEquals, assertIncludes, runAll, appendAuditLog } from './harness'

const SKILLS_DIR = path.join(process.cwd(), 'skills')

const WINDOWS_SKILLS = [
  'outlook-native',
  'powershell-pro',
  'onenote',
  'wsl-bridge',
  'taskscheduler',
  'clipboard-history',
  'windows-registry',
  'windows-services',
  'defender-quickscan',
  'network-diagnostics',
]

const INDIA_SKILLS = [
  'nse-scanner',
  'nse-options',
  'zerodha-kite',
  'upstox',
  'archon-bridge',
  'nse-fii-dii',
  'nse-delivery',
  'india-economic-calendar',
  'indian-tax-calc',
  'nse-corporate-actions',
]

const ALL_SKILLS = [...WINDOWS_SKILLS, ...INDIA_SKILLS]

// ── Test 1 — All 20 SKILL.md files exist ─────────────────────────────────────
test('skills: all 20 SKILL.md files exist', () => {
  for (const skill of ALL_SKILLS) {
    const p = path.join(SKILLS_DIR, skill, 'SKILL.md')
    assert(fs.existsSync(p), `skills/${skill}/SKILL.md must exist`)
  }
})

// ── Test 2 — Each SKILL.md has valid YAML frontmatter fields ─────────────────
test('skills: each SKILL.md has name, description, version, tags in frontmatter', () => {
  const requiredFields = ['name:', 'description:', 'version:', 'tags:']
  for (const skill of ALL_SKILLS) {
    const p = path.join(SKILLS_DIR, skill, 'SKILL.md')
    const content = fs.readFileSync(p, 'utf-8')
    for (const field of requiredFields) {
      assert(
        content.includes(field),
        `skills/${skill}/SKILL.md is missing frontmatter field: ${field}`
      )
    }
  }
})

// ── Test 3 — Each SKILL.md has a markdown H1 header ──────────────────────────
test('skills: each SKILL.md has a # H1 header', () => {
  for (const skill of ALL_SKILLS) {
    const p = path.join(SKILLS_DIR, skill, 'SKILL.md')
    const content = fs.readFileSync(p, 'utf-8')
    assert(
      /^# .+/m.test(content),
      `skills/${skill}/SKILL.md must have a # H1 header`
    )
  }
})

// ── Test 4 — Each SKILL.md has ## When to Use and ## How to Use sections ─────
test('skills: each SKILL.md has "When to Use" and "How to Use" sections', () => {
  for (const skill of ALL_SKILLS) {
    const p = path.join(SKILLS_DIR, skill, 'SKILL.md')
    const content = fs.readFileSync(p, 'utf-8')
    assert(content.includes('## When to Use'), `skills/${skill}/SKILL.md missing "## When to Use"`)
    assert(content.includes('## How to Use'),  `skills/${skill}/SKILL.md missing "## How to Use"`)
  }
})

// ── Test 5 — No SKILL.md contains security-blocked patterns ──────────────────
test('skills: no SKILL.md contains security-blocked injection patterns', () => {
  // Mirrors the patterns checked by core/skillLoader.ts validateSkillStructure
  const blockedPatterns: [RegExp, string][] = [
    [/exec\s*\(/,                   'exec('],
    [/eval\s*\(/,                   'eval('],
    [/run\s+as\s+administrator/i,   'run as administrator'],
    [/admin\s*(mode|access|privilege)/i, 'admin mode/access/privilege'],
    [/elevation\s+prompt/i,         'elevation prompt'],
  ]
  for (const skill of ALL_SKILLS) {
    const p = path.join(SKILLS_DIR, skill, 'SKILL.md')
    const content = fs.readFileSync(p, 'utf-8')
    for (const [pattern, label] of blockedPatterns) {
      assert(
        !pattern.test(content),
        `skills/${skill}/SKILL.md contains blocked pattern: "${label}"`
      )
    }
  }
})

// ── Test 6 — Each SKILL.md is under 10 KB ────────────────────────────────────
test('skills: each SKILL.md is under 10 KB', () => {
  for (const skill of ALL_SKILLS) {
    const p = path.join(SKILLS_DIR, skill, 'SKILL.md')
    const sizeBytes = fs.statSync(p).size
    assert(
      sizeBytes <= 10240,
      `skills/${skill}/SKILL.md exceeds 10 KB limit (${sizeBytes} bytes)`
    )
  }
})

// ── Test 7 — AIDEN_CATALOG.md exists and references all 20 skills ────────────
test('skills: AIDEN_CATALOG.md exists and references all 20 skills', () => {
  const catalogPath = path.join(SKILLS_DIR, 'AIDEN_CATALOG.md')
  assert(fs.existsSync(catalogPath), 'skills/AIDEN_CATALOG.md must exist')
  const content = fs.readFileSync(catalogPath, 'utf-8')
  for (const skill of ALL_SKILLS) {
    assert(
      content.includes(skill),
      `AIDEN_CATALOG.md must reference skill: ${skill}`
    )
  }
})

// ── Test 8 — package.json test:audit includes prompt_15 ──────────────────────
test('skills: package.json test:audit script includes prompt_15', () => {
  const pkgPath = path.join(process.cwd(), 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const auditScript: string = pkg.scripts?.['test:audit'] ?? ''
  assert(
    auditScript.includes('prompt_15'),
    'package.json test:audit must include prompt_15'
  )
})

// ── Run ──────────────────────────────────────────────────────────────────────

;(async () => {
  const results  = await runAll()
  const logPath  = path.join(process.cwd(), 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  process.exit(failed > 0 ? 1 : 0)
})()
