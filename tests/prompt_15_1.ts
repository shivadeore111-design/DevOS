// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_15_1.ts — 5 zero-cost audits for Prompt 15.1 (skill directory cleanup).
// Run via:  npm run test:audit
// No LLM. No side effects. Verifies cleanup results and skillTeacher.ts hardening.

import path from 'path'
import fs   from 'fs'
import { test, assert, runAll, appendAuditLog } from './harness'

const LEARNED_DIR  = path.join(process.cwd(), 'workspace', 'skills', 'learned')
const APPROVED_DIR = path.join(process.cwd(), 'workspace', 'skills', 'approved')

// ── Helpers ───────────────────────────────────────────────────────────────────

function skillDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(d => {
    try { return fs.statSync(path.join(dir, d)).isDirectory() } catch { return false }
  })
}

function validateSkill(content: string): { valid: boolean; reason?: string } {
  if (!content.includes('#') && content.length > 500) {
    return { valid: false, reason: 'No markdown headers' }
  }
  const codeBlocks = (content.match(/```/g) || []).length / 2
  const totalLines = content.split('\n').length
  if (codeBlocks > 0 && codeBlocks * 10 > totalLines) {
    return { valid: false, reason: 'More code than documentation' }
  }
  if (content.length > 10240) {
    return { valid: false, reason: 'Content too large (>10KB)' }
  }
  return { valid: true }
}

// ── Test 1 — All workspace skills pass structural validation ─────────────────
test('cleanup: all workspace/skills files pass structural validation', () => {
  const dirs = [
    ...skillDirs(LEARNED_DIR).map(d => path.join(LEARNED_DIR, d, 'SKILL.md')),
    ...skillDirs(APPROVED_DIR).map(d => path.join(APPROVED_DIR, d, 'SKILL.md')),
  ]
  const blocked: string[] = []
  for (const p of dirs) {
    if (!fs.existsSync(p)) continue
    const content = fs.readFileSync(p, 'utf-8')
    const result  = validateSkill(content)
    if (!result.valid) blocked.push(`${path.relative(process.cwd(), p)}: ${result.reason}`)
  }
  assert(blocked.length === 0, `Blocked skills found:\n  ${blocked.join('\n  ')}`)
})

// ── Test 2 — No duplicate skill names across learned/ and approved/ ──────────
test('cleanup: no duplicate skill names across learned/ and approved/', () => {
  const learnedNames  = new Set(skillDirs(LEARNED_DIR))
  const approvedNames = new Set(skillDirs(APPROVED_DIR))
  const dupes = [...learnedNames].filter(n => approvedNames.has(n))
  assert(dupes.length === 0, `Duplicate skills found in both directories: ${dupes.join(', ')}`)
})

// ── Test 3 — Garbage one-liner skills deleted ─────────────────────────────────
test('cleanup: known garbage skills have been deleted', () => {
  const deletedLearned = [
    'retrieves_user_gpu', 'shell_and_save', 'system_specs', 'user_gpu_specs',
    'verify_ram_size', 'what_current_price', 'deep_research_what',
  ]
  const deletedApproved = [
    'deep_research_what', 'node_execution', 'python_execution', 'read_file_users',
    'research_and_save', 'run_powershell_current', 'what_ram_usage',
  ]
  const surviving: string[] = []
  for (const name of deletedLearned) {
    if (fs.existsSync(path.join(LEARNED_DIR, name))) surviving.push(`learned/${name}`)
  }
  for (const name of deletedApproved) {
    if (fs.existsSync(path.join(APPROVED_DIR, name))) surviving.push(`approved/${name}`)
  }
  assert(surviving.length === 0, `Garbage skills still exist: ${surviving.join(', ')}`)
})

// ── Test 4 — skillTeacher.ts has all 4 hardening changes ─────────────────────
test('cleanup: skillTeacher.ts has header, origin:local, and size validation', () => {
  const p       = path.join(process.cwd(), 'core', 'skillTeacher.ts')
  const content = fs.readFileSync(p, 'utf-8')

  assert(
    content.includes('# ${title}') || content.includes("# ${\`${title}\`}") || /`# \$\{title\}`/.test(content),
    'buildFallbackSkill must include # ${title} header'
  )
  assert(
    content.includes('origin: local'),
    'buildFallbackSkill must include origin: local in frontmatter'
  )
  assert(
    content.includes('byteLen < 50') || content.includes('byteLen < 50'),
    'must reject content < 50 bytes'
  )
  assert(
    content.includes('byteLen > 10240') || content.includes('> 10240'),
    'must reject content > 10KB'
  )
  assert(
    content.includes('# [Skill Title'),
    'generateSkillContent prompt must instruct LLM to include # header'
  )
})

// ── Test 5 — Official skills/ all pass validation ─────────────────────────────
test('cleanup: all official skills/ pass structural validation', () => {
  const SKILLS_DIR = path.join(process.cwd(), 'skills')
  const blocked: string[] = []
  for (const entry of fs.readdirSync(SKILLS_DIR)) {
    const skillPath = path.join(SKILLS_DIR, entry, 'SKILL.md')
    if (!fs.existsSync(skillPath)) continue
    const content = fs.readFileSync(skillPath, 'utf-8')
    const result  = validateSkill(content)
    if (!result.valid) blocked.push(`skills/${entry}/SKILL.md: ${result.reason}`)
  }
  assert(blocked.length === 0, `Blocked official skills:\n  ${blocked.join('\n  ')}`)
})

// ── Run ──────────────────────────────────────────────────────────────────────

;(async () => {
  const results = await runAll()
  const logPath = path.join(process.cwd(), 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  process.exit(failed > 0 ? 1 : 0)
})()
