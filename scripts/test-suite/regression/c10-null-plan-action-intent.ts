// ============================================================
// C10 Null-Plan Action-Intent Guard Regression Tests
// scripts/test-suite/regression/c10-null-plan-action-intent.ts
//
// Proves C10 fix: the null-plan early return in agentLoop's
// planner now checks isActionIntent(message) before
// short-circuiting with "I'll answer directly." Action intents
// (read, delete, etc.) must flow through PlannerGuard and
// respondWithResults so C6 CRITICAL RULES can fire.
//
// Zero I/O — pure source-text + logic inspection.
// ============================================================

import fs   from 'fs'
import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()

function req<T = any>(relPath: string): T | null {
  try { return require(path.join(CWD, relPath)) as T } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group N — Regression: C10 null-plan action-intent guard
// ─────────────────────────────────────────────────────────────────────────────

export async function groupN(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[N] Regression — C10 null-plan action-intent guard${C.reset}`)
  const results = []

  const src = (() => {
    try { return fs.readFileSync(path.join(CWD, 'core', 'agentLoop.ts'), 'utf-8') } catch { return null }
  })()

  // Find the null-plan guard block — anchor on "I'll answer directly"
  const guardAnchor = src?.indexOf("I'll answer directly.") ?? -1
  const guardBlock  = guardAnchor >= 0 ? src!.slice(Math.max(0, guardAnchor - 800), guardAnchor + 200) : ''

  // ── N-01: source contains isActionIntent in null-plan guard ───────────
  results.push(await runTest('N-01', 'N',
    'null-plan guard contains isActionIntent call', () => {
      if (!src) return 'Could not read core/agentLoop.ts'
      if (!guardBlock.includes('isActionIntent'))
        return 'null-plan guard does not call isActionIntent — action intents will bypass PlannerGuard'
    }
  ))

  // ── N-02: guard condition is the full triple-check ────────────────────
  results.push(await runTest('N-02', 'N',
    'guard condition includes !isActionIntent(message)', () => {
      if (!src) return 'Could not read core/agentLoop.ts'
      if (!guardBlock.includes('!parsed.plan && !parsed.steps && !isActionIntent(message)'))
        return 'guard condition does not match expected: !parsed.plan && !parsed.steps && !isActionIntent(message)'
    }
  ))

  // ── N-03: C10 comment block present ───────────────────────────────────
  results.push(await runTest('N-03', 'N',
    'C10 comment block present as regression marker', () => {
      if (!src) return 'Could not read core/agentLoop.ts'
      if (!guardBlock.includes('C10'))
        return 'C10 comment marker not found near null-plan guard'
    }
  ))

  // ── N-04: isActionIntent('read foo.txt') === true ─────────────────────
  const detector = req<{
    isActionIntent?: (msg: string) => boolean
  }>('core/actionVerbDetector')

  results.push(await runTest('N-04', 'N',
    "isActionIntent('read foo.txt') returns true", () => {
      if (!detector?.isActionIntent)
        return 'isActionIntent not exported from core/actionVerbDetector'
      if (!detector.isActionIntent('read foo.txt'))
        return "isActionIntent('read foo.txt') returned false — C5 ACTION_VERB_RE may have regressed"
    }
  ))

  // ── N-05: isActionIntent('what is the weather') === false ─────────────
  results.push(await runTest('N-05', 'N',
    "isActionIntent('what is the weather') returns false", () => {
      if (!detector?.isActionIntent)
        return 'isActionIntent not exported from core/actionVerbDetector'
      if (detector.isActionIntent('what is the weather'))
        return "isActionIntent('what is the weather') returned true — false positive, fast-path broken"
    }
  ))

  results.forEach(printResult)
  return summarize('N', 'C10 null-plan action-intent guard', results)
}
