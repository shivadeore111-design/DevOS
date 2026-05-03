// ============================================================
// C18 SkillTeacher Rejection Cache Regression Tests
// scripts/test-suite/regression/c18-skillteacher-spam.test.ts
//
// Proves C18 fix: rejected skill names are cached per session
// so subsequent recordSuccess() calls with the same name skip
// silently instead of re-running all quality gates.
//
// Also verifies SkillTeacher.hasCapacity() static method and
// agentLoop.ts call-site guard.
//
// Zero I/O — pure logic + source-text checks.
// ============================================================

import fs   from 'fs'
import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()

function req<T = any>(relPath: string): T | null {
  try { return require(path.join(CWD, relPath)) as T } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group L — Regression: C18 SkillTeacher rejection cache
// ─────────────────────────────────────────────────────────────────────────────

export async function groupL(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[L] Regression — C18 SkillTeacher rejection cache${C.reset}`)
  const results = []

  // ── Load modules ──────────────────────────────────────────────────────────
  const stMod = req<{
    validateSkillName?: (name: string) => string | null
    validateSkillTask?: (task: string, userMessage?: string) => string | null
    SkillTeacher?: { hasCapacity: () => boolean }
  }>('core/skillTeacher')

  // ── L-01: First call with bad name → rejection logged, cache populated ────
  results.push(await runTest('L-01', 'L',
    'first bad-name call triggers rejection (validateSkillName rejects)', () => {
      if (!stMod?.validateSkillName) return 'validateSkillName not exported'
      const r = stMod.validateSkillName('what_model_are')
      if (r === null) return 'expected rejection, got null'
      if (!r.includes('question')) return `expected "question word" reason, got: "${r}"`
    }
  ))

  // ── L-02: Same bad name on second call → still rejected by validator ──────
  // (The cache prevents recordSuccess from re-running, but validateSkillName
  //  itself is stateless. We verify the cache via source-text inspection.)
  results.push(await runTest('L-02', 'L',
    '_rejectedNames cache exists and is checked before quality gates', () => {
      const src = fs.readFileSync(path.join(CWD, 'core', 'skillTeacher.ts'), 'utf-8')
      // Cache declaration
      if (!src.includes('const _rejectedNames: Set<string> = new Set()'))
        return '_rejectedNames Set not declared at module scope'
      // Early return on cache hit — must appear BEFORE quality gate checks
      const cacheCheckIdx = src.indexOf('if (_rejectedNames.has(skillName)) return')
      const lowQualityIdx = src.indexOf('isLowQuality')
      if (cacheCheckIdx === -1) return '_rejectedNames.has() check not found in recordSuccess'
      if (cacheCheckIdx > lowQualityIdx) return 'cache check appears AFTER quality gates (should be before)'
    }
  ))

  // ── L-03: Different bad name → also rejected, cache grows ────────────────
  results.push(await runTest('L-03', 'L',
    'different bad name also rejected (cache add on each gate)', () => {
      const src = fs.readFileSync(path.join(CWD, 'core', 'skillTeacher.ts'), 'utf-8')
      // Count how many rejection sites add to cache
      const addCalls = (src.match(/_rejectedNames\.add\(skillName\)/g) || []).length
      // Should have at least 4: low-quality, destructive (C7), name validation (C12), task validation (C12)
      if (addCalls < 4)
        return `expected >=4 _rejectedNames.add() calls (one per gate), found ${addCalls}`
    }
  ))

  // ── L-04: Valid name passes gates, NOT added to rejection cache ───────────
  results.push(await runTest('L-04', 'L',
    'valid skill name passes validateSkillName (not cached as rejected)', () => {
      if (!stMod?.validateSkillName) return 'validateSkillName not exported'
      // "research_and_save" is a valid 3-word name, no question prefix, no personal ID
      const r = stMod.validateSkillName('research_and_save')
      if (r !== null) return `expected null (valid), got rejection: "${r}"`
    }
  ))

  // ── L-05: hasCapacity() returns true under limit ──────────────────────────
  results.push(await runTest('L-05', 'L',
    'SkillTeacher.hasCapacity() is exported and callable', () => {
      if (!stMod?.SkillTeacher) return 'SkillTeacher class not exported'
      if (typeof stMod.SkillTeacher.hasCapacity !== 'function')
        return 'hasCapacity is not a static method on SkillTeacher'
      // On fresh module load, session counter is 0 so hasCapacity should be true
      const result = stMod.SkillTeacher.hasCapacity()
      if (result !== true) return `expected true (fresh session), got ${result}`
    }
  ))

  // ── L-06: hasCapacity() returns false at limit (source-level check) ───────
  results.push(await runTest('L-06', 'L',
    'hasCapacity() checks _sessionSkillsCreated < SESSION_SKILL_LIMIT', () => {
      const src = fs.readFileSync(path.join(CWD, 'core', 'skillTeacher.ts'), 'utf-8')
      if (!src.includes('static hasCapacity(): boolean'))
        return 'hasCapacity static method not found'
      if (!src.includes('_sessionSkillsCreated < SESSION_SKILL_LIMIT'))
        return 'hasCapacity does not check _sessionSkillsCreated < SESSION_SKILL_LIMIT'
    }
  ))

  // ── L-07: Session-limit check moved before quality gates ─────────────────
  results.push(await runTest('L-07', 'L',
    'session-limit check moved up before quality gates in recordSuccess', () => {
      const src = fs.readFileSync(path.join(CWD, 'core', 'skillTeacher.ts'), 'utf-8')
      const sessionLimitIdx = src.indexOf('if (_sessionSkillsCreated >= SESSION_SKILL_LIMIT) return')
      const lowQualityIdx   = src.indexOf('isLowQuality')
      if (sessionLimitIdx === -1) return 'moved session-limit early-return not found'
      if (sessionLimitIdx > lowQualityIdx)
        return 'session-limit check appears AFTER quality gates (should be before)'
      // Verify old verbose session-limit block is removed
      if (src.includes('Session limit reached'))
        return 'old verbose "Session limit reached" log still present (should be removed)'
    }
  ))

  // ── L-08: agentLoop.ts gates call site with hasCapacity() ────────────────
  results.push(await runTest('L-08', 'L',
    'agentLoop.ts gates skillTeacher call with SkillTeacher.hasCapacity()', () => {
      const src = fs.readFileSync(path.join(CWD, 'core', 'agentLoop.ts'), 'utf-8')
      if (!src.includes('SkillTeacher.hasCapacity()'))
        return 'SkillTeacher.hasCapacity() guard not found in agentLoop.ts'
      // Verify it's in the condition that gates recordSuccess
      const guardLine = src.split('\n').find(l =>
        l.includes('allSucceeded') && l.includes('SkillTeacher.hasCapacity()')
      )
      if (!guardLine) return 'hasCapacity() not in the allSucceeded && executedTools condition'
      // Verify SkillTeacher is imported
      if (!src.includes("import { skillTeacher, SkillTeacher }"))
        return 'SkillTeacher class not imported in agentLoop.ts'
    }
  ))

  return summarize('L', 'C18 SkillTeacher rejection cache', results)
}
