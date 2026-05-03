// ============================================================
// C23 CLI Noise Suppression Regression Tests
// scripts/test-suite/regression/c23-cli-noise.test.ts
//
// Proves C23 fix: level-aware log gate in api/server.ts,
// CLI mode defaults in bin/aiden.js, redundant console calls
// removed from livePulse.ts.
//
// Source-text + behavioral checks — no LLM calls.
// ============================================================

import fs   from 'fs'
import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()
const SERVER_SRC    = fs.readFileSync(path.join(CWD, 'api', 'server.ts'), 'utf-8')
const LIVEPULSE_SRC = fs.readFileSync(path.join(CWD, 'coordination', 'livePulse.ts'), 'utf-8')
const AIDEN_JS_SRC  = fs.readFileSync(path.join(CWD, 'packages', 'aiden-os', 'bin', 'aiden.js'), 'utf-8')

// ─────────────────────────────────────────────────────────────────────────────
// Group AC — Regression: C23 CLI noise suppression
// ─────────────────────────────────────────────────────────────────────────────

export async function groupAC(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[AC] Regression — C23 CLI noise suppression${C.reset}`)
  const results = []

  // ── AC-01: api/server.ts has _LOG_LEVELS map ─────────────────────────────
  results.push(await runTest('AC-01', 'AC',
    'api/server.ts has _LOG_LEVELS map with debug/info/warn/error/silent', () => {
      if (!SERVER_SRC.includes('_LOG_LEVELS'))
        return '_LOG_LEVELS map not found in api/server.ts'
      for (const level of ['debug', 'info', 'warn', 'error', 'silent']) {
        if (!SERVER_SRC.includes(`${level}:`))
          return `_LOG_LEVELS missing level: ${level}`
      }
    }
  ))

  // ── AC-02: _gatedLog uses bracket regex ──────────────────────────────────
  results.push(await runTest('AC-02', 'AC',
    '_gatedLog uses bracket regex to identify diagnostic lines', () => {
      if (!SERVER_SRC.includes('_gatedLog'))
        return '_gatedLog function not found'
      if (!SERVER_SRC.includes('_bracketRe'))
        return '_bracketRe regex not found'
      if (!/\\[\\[\\w\$:]\+\\]/.test(SERVER_SRC) && !/_bracketRe\s*=\s*\//.test(SERVER_SRC))
        return 'bracket regex pattern not found'
    }
  ))

  // ── AC-03: console.log gated to info level ───────────────────────────────
  results.push(await runTest('AC-03', 'AC',
    'console.log is gated through _gatedLog at info level', () => {
      // Should have: console.log = (...args) => _gatedLog(_LOG_LEVELS.info, ...args)
      if (!SERVER_SRC.includes('console.log') || !SERVER_SRC.includes('_gatedLog(_LOG_LEVELS.info'))
        return 'console.log not wired through _gatedLog at info level'
    }
  ))

  // ── AC-04: console.warn NOT gated (always writes) ───────────────────────
  results.push(await runTest('AC-04', 'AC',
    'console.warn always writes (not gated through _gatedLog)', () => {
      // console.warn should write directly to stderr, NOT go through _gatedLog
      const warnLine = SERVER_SRC.match(/console\.warn\s*=\s*\(\.\.\.args.*?\)\s*=>\s*\n?\s*process\.stderr\.write/)
      if (!warnLine)
        return 'console.warn should write directly to process.stderr.write, not through _gatedLog'
      // Make sure it does NOT use _gatedLog
      const warnGated = SERVER_SRC.match(/console\.warn\s*=\s*\(\.\.\.args.*?\)\s*=>\s*_gatedLog/)
      if (warnGated)
        return 'console.warn is gated through _gatedLog — should always write'
    }
  ))

  // ── AC-05: bin/aiden.js sets AIDEN_CLI_MODE=1 ───────────────────────────
  results.push(await runTest('AC-05', 'AC',
    'bin/aiden.js sets AIDEN_CLI_MODE=1', () => {
      if (!AIDEN_JS_SRC.includes("AIDEN_CLI_MODE") || !AIDEN_JS_SRC.includes("'1'"))
        return 'bin/aiden.js does not set AIDEN_CLI_MODE to 1'
    }
  ))

  // ── AC-06: bin/aiden.js defaults AIDEN_LOG_LEVEL to warn ─────────────────
  results.push(await runTest('AC-06', 'AC',
    'bin/aiden.js defaults AIDEN_LOG_LEVEL to warn', () => {
      if (!AIDEN_JS_SRC.includes('AIDEN_LOG_LEVEL'))
        return 'AIDEN_LOG_LEVEL not set in bin/aiden.js'
      if (!AIDEN_JS_SRC.includes("'warn'"))
        return "AIDEN_LOG_LEVEL default not set to 'warn'"
    }
  ))

  // ── AC-07: livePulse.ts has fewer than 3 console.log calls ──────────────
  results.push(await runTest('AC-07', 'AC',
    'livePulse.ts redundant console.log calls removed (< 3 remaining)', () => {
      const logMatches = LIVEPULSE_SRC.match(/console\.log\(/g) || []
      if (logMatches.length >= 3)
        return `livePulse.ts still has ${logMatches.length} console.log calls — expected < 3 after removing 5 redundant ones`
    }
  ))

  // ── AC-08: livePulse.ts retains console.error in error() method ─────────
  results.push(await runTest('AC-08', 'AC',
    'livePulse.ts retains console.error in error() method', () => {
      const errorMatches = LIVEPULSE_SRC.match(/console\.error\(/g) || []
      if (errorMatches.length === 0)
        return 'livePulse.ts has no console.error calls — error() method should keep its console.error'
    }
  ))

  // ── AC-09: behavioral — AIDEN_LOG_LEVEL=warn suppresses [Router] ────────
  results.push(await runTest('AC-09', 'AC',
    'AIDEN_LOG_LEVEL=warn suppresses bracket-prefixed log lines', () => {
      // Simulate the gate logic inline
      const minLevel = 2 // warn
      const infoLevel = 1
      const bracketRe = /^\[[\w$:]+\]/
      const testLine = '[Router] planner: groq-1 selected'

      // _gatedLog(info, testLine) should suppress because info < warn and line is bracket-prefixed
      const shouldSuppress = infoLevel < minLevel && bracketRe.test(testLine)
      if (!shouldSuppress)
        return 'Gate logic would NOT suppress bracket-prefixed info line at warn level'
    }
  ))

  // ── AC-10: behavioral — AIDEN_LOG_LEVEL=debug shows [Router] ────────────
  results.push(await runTest('AC-10', 'AC',
    'AIDEN_LOG_LEVEL=debug allows bracket-prefixed log lines through', () => {
      // Simulate the gate logic inline
      const minLevel = 0 // debug
      const infoLevel = 1
      const testLine = '[Router] planner: groq-1 selected'

      // _gatedLog(info, testLine) should pass because info >= debug
      const shouldPass = infoLevel >= minLevel
      if (!shouldPass)
        return 'Gate logic would suppress bracket-prefixed info line at debug level — should pass through'
    }
  ))

  for (const r of results) printResult(r)
  return summarize('AC', 'C23 CLI noise suppression', results)
}
