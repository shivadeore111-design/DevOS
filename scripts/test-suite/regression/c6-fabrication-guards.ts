// ============================================================
// C6 Fabrication Guard Regression Tests
// scripts/test-suite/regression/c6-fabrication-guards.ts
//
// Proves C6 fix: respondWithResults CRITICAL RULES block now
// has success/failure conditional pairs that prevent the LLM
// from fabricating output when tools fail.
//
// Zero I/O — pure source-text inspection (no server, no LLM).
// ============================================================

import fs   from 'fs'
import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()

/**
 * Extract the CRITICAL RULES block from agentLoop.ts source text.
 * Returns the raw string between "CRITICAL RULES FOR YOUR RESPONSE:"
 * and the closing backtick (template literal end).
 */
function getCriticalRulesBlock(): string | null {
  const src = fs.readFileSync(path.join(CWD, 'core', 'agentLoop.ts'), 'utf-8')
  const marker = 'CRITICAL RULES FOR YOUR RESPONSE:'
  const start = src.indexOf(marker)
  if (start === -1) return null

  // Grab from the marker to the next backtick (end of template literal)
  const end = src.indexOf('`', start)
  if (end === -1) return null

  return src.slice(start, end)
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Y — Regression: C6 fabrication guards
// ─────────────────────────────────────────────────────────────────────────────

export async function groupY(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[Y] Regression — C6 fabrication guards${C.reset}`)
  const results = []

  const rules = getCriticalRulesBlock()

  // ── F-01: CRITICAL RULES block exists ────────────────────────────────────
  results.push(await runTest('F-01', 'Y', 'CRITICAL RULES block exists in agentLoop.ts', () => {
    if (!rules) return 'Could not find "CRITICAL RULES FOR YOUR RESPONSE:" in agentLoop.ts'
  }))

  if (!rules) {
    // Bail out — all subsequent tests depend on the block
    const bail = (id: string, desc: string) =>
      results.push({ id, group: 'Y', desc, verdict: 'SKIP' as const, durationMs: 0, detail: 'skipped — CRITICAL RULES block not found' })
    bail('F-02', 'file_read SUCCEEDED rule present')
    bail('F-03', 'file_read FAILED rule present with NEVER fabricate')
    bail('F-04', 'file_list FAILED rule present with NEVER invent')
    bail('F-05', 'web_fetch FAILED rule present with NEVER invent')
    bail('F-06', 'FAILED: catch-all rule present with NEVER fabricate')
    results.forEach(printResult)
    return summarize('Y', 'C6 fabrication guards', results)
  }

  // ── F-02: file_read SUCCEEDED rule ───────────────────────────────────────
  results.push(await runTest('F-02', 'Y', 'file_read SUCCEEDED rule present', () => {
    if (!/file_read\s+SUCCEEDED/.test(rules))
      return 'Missing "file_read SUCCEEDED" rule — old unguarded rule may still be present'
  }))

  // ── F-03: file_read FAILED rule with NEVER fabricate ─────────────────────
  results.push(await runTest('F-03', 'Y', 'file_read FAILED rule present with NEVER fabricate', () => {
    if (!/file_read\s+FAILED/.test(rules))
      return 'Missing "file_read FAILED" rule'
    if (!/NEVER\s+(invent|fabricate)/i.test(rules.slice(rules.indexOf('file_read FAILED'))))
      return '"file_read FAILED" rule exists but lacks NEVER fabricate/invent guard'
  }))

  // ── F-04: file_list FAILED rule with NEVER invent ────────────────────────
  results.push(await runTest('F-04', 'Y', 'file_list FAILED rule present with NEVER invent', () => {
    if (!/file_list\s+FAILED/.test(rules))
      return 'Missing "file_list FAILED" rule'
    if (!/NEVER\s+invent/i.test(rules.slice(rules.indexOf('file_list FAILED'))))
      return '"file_list FAILED" rule exists but lacks NEVER invent guard'
  }))

  // ── F-05: web_fetch FAILED rule with NEVER invent ────────────────────────
  results.push(await runTest('F-05', 'Y', 'web_fetch FAILED rule present with NEVER invent', () => {
    if (!/web_fetch\s+FAILED/.test(rules))
      return 'Missing "web_fetch FAILED" rule'
    if (!/NEVER\s+invent/i.test(rules.slice(rules.indexOf('web_fetch FAILED'))))
      return '"web_fetch FAILED" rule exists but lacks NEVER invent guard'
  }))

  // ── F-06: FAILED: catch-all rule with NEVER fabricate ────────────────────
  results.push(await runTest('F-06', 'Y', 'FAILED: catch-all rule present with NEVER fabricate', () => {
    if (!/FAILED:/.test(rules))
      return 'Missing "FAILED:" catch-all rule'
    if (!/NEVER\s+fabricate/i.test(rules.slice(rules.indexOf('FAILED:'))))
      return '"FAILED:" catch-all exists but lacks NEVER fabricate guard'
  }))

  results.forEach(printResult)
  return summarize('Y', 'C6 fabrication guards', results)
}
