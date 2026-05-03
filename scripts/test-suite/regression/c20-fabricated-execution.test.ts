// ============================================================
// C20 Fabricated Tool Execution Regression Tests
// scripts/test-suite/regression/c20-fabricated-execution.test.ts
//
// Proves C20 fix: when no real tools run (results empty or
// respond-only), synthesis prompt includes explicit prohibition
// against claiming tool execution. When real tools ran, existing
// C6 CRITICAL RULES + REPORT RESULTS still apply.
//
// All source-text checks — no LLM calls, no I/O beyond fs.read.
// ============================================================

import fs   from 'fs'
import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()
const PERSONALITY_SRC = fs.readFileSync(path.join(CWD, 'core', 'aidenPersonality.ts'), 'utf-8')
const AGENTLOOP_SRC   = fs.readFileSync(path.join(CWD, 'core', 'agentLoop.ts'), 'utf-8')

// ─────────────────────────────────────────────────────────────────────────────
// Group P — Regression: C20 fabricated tool execution prevention
// ─────────────────────────────────────────────────────────────────────────────

export async function groupP(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[P] Regression — C20 fabricated tool execution prevention${C.reset}`)
  const results = []

  // ── P-01: empty-results branch contains "NO TOOLS WERE EXECUTED" ──────────
  results.push(await runTest('P-01', 'P',
    'no-tools branch contains "NO TOOLS WERE EXECUTED THIS TURN"', () => {
      if (!PERSONALITY_SRC.includes('NO TOOLS WERE EXECUTED THIS TURN'))
        return 'missing "NO TOOLS WERE EXECUTED THIS TURN" in aidenPersonality.ts'
    }
  ))

  // ── P-02: empty-results branch prohibits claiming file creation ───────────
  results.push(await runTest('P-02', 'P',
    'no-tools branch contains "DO NOT claim you created"', () => {
      if (!PERSONALITY_SRC.includes('DO NOT claim you created'))
        return 'missing "DO NOT claim you created" prohibition in no-tools branch'
    }
  ))

  // ── P-03: empty-results branch prohibits fabricated file paths ────────────
  results.push(await runTest('P-03', 'P',
    'no-tools branch contains "DO NOT fabricate file paths"', () => {
      if (!PERSONALITY_SRC.includes('DO NOT fabricate file paths'))
        return 'missing "DO NOT fabricate file paths" prohibition in no-tools branch'
    }
  ))

  // ── P-04: empty-results branch prohibits "Saved to" language ──────────────
  results.push(await runTest('P-04', 'P',
    'no-tools branch contains "Saved to Desktop" prohibition', () => {
      if (!PERSONALITY_SRC.includes('Saved to Desktop'))
        return 'missing "Saved to Desktop" prohibition in no-tools branch'
    }
  ))

  // ── P-05: non-empty branch retains existing C6 REPORT RESULTS ────────────
  results.push(await runTest('P-05', 'P',
    'has-tools branch retains "REPORT RESULTS:" section', () => {
      if (!PERSONALITY_SRC.includes('REPORT RESULTS:'))
        return 'missing "REPORT RESULTS:" in has-tools branch — C6 regression'
    }
  ))

  // ── P-06: agentLoop has hasRealToolExecution detection ────────────────────
  results.push(await runTest('P-06', 'P',
    'agentLoop.ts has hasRealToolExecution detection', () => {
      if (!AGENTLOOP_SRC.includes("const hasRealToolExecution = results.some(r => r.tool !== 'respond')"))
        return 'hasRealToolExecution detection not found in agentLoop.ts'
    }
  ))

  // ── P-07: agentLoop passes false to responderSystem in else branch ────────
  results.push(await runTest('P-07', 'P',
    'agentLoop.ts passes false to responderSystem in empty-results branch', () => {
      if (!AGENTLOOP_SRC.includes('responderSystem(userName, date, sessionId, false)'))
        return 'responderSystem(..., false) not found in agentLoop.ts else branch'
    }
  ))

  // ── P-08: responderSystem wrapper accepts hasToolResults parameter ────────
  results.push(await runTest('P-08', 'P',
    'responderSystem wrapper accepts hasToolResults parameter', () => {
      if (!AGENTLOOP_SRC.includes('function responderSystem(userName: string, date: string, sessionId?: string, hasToolResults = true)'))
        return 'responderSystem signature does not include hasToolResults parameter'
    }
  ))

  // ── P-09: respond tool excluded from real tool detection ──────────────────
  results.push(await runTest('P-09', 'P',
    'hasRealToolExecution excludes respond pseudo-tool', () => {
      // The detection line should filter out 'respond'
      const line = AGENTLOOP_SRC.split('\n').find(l => l.includes('hasRealToolExecution'))
      if (!line) return 'hasRealToolExecution line not found'
      if (!line.includes("r.tool !== 'respond'"))
        return 'hasRealToolExecution does not exclude respond tool'
    }
  ))

  return summarize('P', 'C20 fabricated tool execution prevention', results)
}
