/**
 * prompt_23.ts — Repo split prep self-test
 * Tests: CONTRIBUTING.md, SKILL_TEMPLATE, CLA files, license headers,
 *        skills-repo-manifest, no unexpected origin values
 * Expected: 10/10 pass
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..')

interface TestResult {
  id: number
  label: string
  passed: boolean
  durationMs: number
}

function test(id: number, label: string, fn: () => boolean): TestResult {
  const start = Date.now()
  let passed = false
  try { passed = fn() } catch { passed = false }
  return { id, label, passed, durationMs: Date.now() - start }
}

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel))
}

/** Walk skills/, return all SKILL.md absolute paths */
function allSkillMds(): string[] {
  const skillsDir = path.join(ROOT, 'skills')
  return fs.readdirSync(skillsDir)
    .map(d => path.join(skillsDir, d, 'SKILL.md'))
    .filter(p => fs.existsSync(p))
}

/** Extract YAML frontmatter block (between first pair of ---) */
function frontmatter(content: string): string {
  const m = content.match(/^---\n([\s\S]*?)\n---/)
  return m ? m[1] : ''
}

const VALID_ORIGINS = new Set(['aiden', 'community', 'local'])

const results: TestResult[] = [

  // Test 1: CONTRIBUTING.md exists at repo root
  test(1, 'p23: CONTRIBUTING.md exists at repo root', () =>
    exists('CONTRIBUTING.md')),

  // Test 2: SKILL_TEMPLATE.md exists with required sections
  test(2, 'p23: SKILL_TEMPLATE.md has all required sections', () => {
    const c = read('skills/SKILL_TEMPLATE.md')
    return c.includes('## When to use') &&
           c.includes('## How to use') &&
           c.includes('## Examples') &&
           c.includes('## Cautions') &&
           c.includes('## Requirements')
  }),

  // Test 3: .github/CLA.md exists
  test(3, 'p23: .github/CLA.md exists', () =>
    exists('.github/CLA.md')),

  // Test 4: .github/cla-bot-config.yml exists
  test(4, 'p23: .github/cla-bot-config.yml exists', () =>
    exists('.github/cla-bot-config.yml')),

  // Test 5: Every SKILL.md has license field in frontmatter
  test(5, 'p23: every SKILL.md has license field in frontmatter', () => {
    const missing = allSkillMds().filter(p => {
      const fm = frontmatter(fs.readFileSync(p, 'utf8'))
      return !fm.includes('license:')
    })
    if (missing.length > 0) {
      console.error('  Missing license:', missing.map(p => path.basename(path.dirname(p))))
    }
    return missing.length === 0
  }),

  // Test 6: All license fields specify Apache-2.0
  test(6, 'p23: all SKILL.md license fields are Apache-2.0', () => {
    const bad = allSkillMds().filter(p => {
      const fm = frontmatter(fs.readFileSync(p, 'utf8'))
      const m = fm.match(/^license:\s*(.+)$/m)
      return m ? m[1].trim() !== 'Apache-2.0' : false
    })
    if (bad.length > 0) {
      console.error('  Non-Apache-2.0 license:', bad.map(p => path.basename(path.dirname(p))))
    }
    return bad.length === 0
  }),

  // Test 7: packaging/skills-repo-manifest.md exists
  test(7, 'p23: packaging/skills-repo-manifest.md exists', () =>
    exists('packaging/skills-repo-manifest.md')),

  // Test 8: Skill template has all required frontmatter fields
  test(8, 'p23: SKILL_TEMPLATE.md frontmatter has name/description/license/origin', () => {
    const fm = frontmatter(read('skills/SKILL_TEMPLATE.md'))
    return fm.includes('name:') &&
           fm.includes('description:') &&
           fm.includes('license:') &&
           fm.includes('origin:')
  }),

  // Test 9: CONTRIBUTING.md references Apache-2.0 and CLA
  test(9, 'p23: CONTRIBUTING.md references Apache-2.0 and CLA', () => {
    const c = read('CONTRIBUTING.md')
    return c.includes('Apache-2.0') &&
           c.includes('CLA') &&
           c.includes('Contributor License Agreement')
  }),

  // Test 10: No SKILL.md origin is unexpected (aiden/community/local only)
  test(10, 'p23: all SKILL.md origin values are aiden/community/local (or absent)', () => {
    const bad = allSkillMds().filter(p => {
      const fm = frontmatter(fs.readFileSync(p, 'utf8'))
      const m = fm.match(/^origin:\s*(.+)$/m)
      if (!m) return false  // absent is ok for legacy files
      return !VALID_ORIGINS.has(m[1].trim())
    })
    if (bad.length > 0) {
      console.error('  Unexpected origin values:', bad.map(p => path.basename(path.dirname(p))))
    }
    return bad.length === 0
  }),

]

// ── Report ──────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.passed).length
const failed = results.filter(r => !r.passed).length
const ts     = new Date().toISOString()

console.log('\n  prompt_23 — Repo split prep\n')
for (const r of results) {
  const icon = r.passed ? '✓' : '✗'
  const col  = r.passed ? '\x1b[32m' : '\x1b[31m'
  console.log(`  ${col}${icon}\x1b[0m  [${String(r.id).padStart(2, '0')}] ${r.label}  (${r.durationMs}ms)`)
}
console.log(`\n  ${ts} — ${passed}/${results.length} passed\n`)

// ── Append to AUDIT_LOG.md ───────────────────────────────────────────────────
const AUDIT_LOG = path.join(ROOT, 'tests', 'AUDIT_LOG.md')
const rows = results
  .map(r => `| ${r.id} | ${r.label} | ${r.passed ? '✓' : '✗'} | ${r.durationMs} | ${r.passed ? 'ok' : 'FAIL'} |`)
  .join('\n')
const block = `\n## prompt_23 — Repo split prep\n\n| # | label | pass | ms | status |\n|---|-------|------|----|--------|\n${rows}\n\n${ts} — ${passed}/${results.length} passed\n`

const existing = fs.readFileSync(AUDIT_LOG, 'utf8')
if (!existing.includes('## prompt_23')) {
  fs.appendFileSync(AUDIT_LOG, block, 'utf8')
  console.log('  AUDIT_LOG.md updated.')
}

if (failed > 0) {
  console.error(`  ${failed} test(s) failed.`)
  process.exit(1)
}
