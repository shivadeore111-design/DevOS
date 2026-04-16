// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/harness.ts — Lightweight zero-cost test runner.
// No vitest, no jest — plain ts-node. No network, no LLM.

import fs   from 'fs'
import path from 'path'

export interface TestResult {
  name:       string
  pass:       boolean
  reason:     string
  durationMs: number
}

type TestFn = () => void | Promise<void>

const _tests: Array<{ name: string; fn: TestFn }> = []

/** Register a named test. */
export function test(name: string, fn: TestFn): void {
  _tests.push({ name, fn })
}

/** Assert with a descriptive message on failure. */
export function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

/** Assert two values are strictly equal. */
export function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    throw new Error(msg ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

/** Assert string includes substring. */
export function assertIncludes(haystack: string, needle: string, msg?: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(msg ?? `Expected "${needle}" in:\n${haystack.substring(0, 200)}`)
  }
}

/** Assert string does NOT include substring. */
export function assertExcludes(haystack: string, needle: string, msg?: string): void {
  if (haystack.includes(needle)) {
    throw new Error(msg ?? `Did NOT expect "${needle}" in string`)
  }
}

/** Run all registered tests and return results. */
export async function runAll(): Promise<TestResult[]> {
  const results: TestResult[] = []
  const RESET  = '\x1b[0m'
  const GREEN  = '\x1b[32m'
  const RED    = '\x1b[31m'
  const DIM    = '\x1b[2m'
  const ORANGE = '\x1b[38;2;255;107;53m'

  console.log(`\n${ORANGE}▲${RESET} DevOS Prompt-11 Audit  ${DIM}${new Date().toISOString()}${RESET}\n`)

  for (const { name, fn } of _tests) {
    const t0 = Date.now()
    let pass   = false
    let reason = ''
    try {
      await fn()
      pass   = true
      reason = 'ok'
    } catch (err: any) {
      reason = err?.message ?? String(err)
    }
    const durationMs = Date.now() - t0
    results.push({ name, pass, reason, durationMs })
    const mark = pass ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`
    const dur  = `${DIM}${durationMs}ms${RESET}`
    console.log(`  ${mark}  ${name.padEnd(55)} ${dur}`)
    if (!pass) console.log(`     ${RED}${reason}${RESET}`)
  }

  const passed = results.filter(r => r.pass).length
  const failed = results.length - passed
  console.log(`\n  ${passed}/${results.length} passed${failed > 0 ? `  ${RED}${failed} failed${RESET}` : ''}`)
  console.log()

  return results
}

/** Append results to AUDIT_LOG.md. */
export function appendAuditLog(results: TestResult[], logPath: string): void {
  const passed = results.filter(r => r.pass).length
  const lines  = [
    `\n## ${new Date().toISOString()} — ${passed}/${results.length} passed`,
    '',
    '| # | Test | Pass | Ms | Reason |',
    '|---|------|------|----|--------|',
    ...results.map((r, i) =>
      `| ${i + 1} | ${r.name} | ${r.pass ? '✓' : '✗'} | ${r.durationMs} | ${r.reason} |`
    ),
    '',
  ]
  fs.appendFileSync(logPath, lines.join('\n'), 'utf-8')
}
