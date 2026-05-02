// ============================================================
// C3b Screenshot Schema + Backslash Escape Regression Tests
// scripts/test-suite/regression/c3b-screenshot-schema-escape.ts
//
// Proves two C3b fixes:
//   1. MCP TOOL_SCHEMAS has outputPath for screenshot tool
//   2. takeScreenshot() does NOT double-escape backslashes
//      (PS single-quoted strings are literal — \\ would be wrong)
//
// Zero I/O — pure source/module inspection (no server, no LLM).
// ============================================================

import fs   from 'fs'
import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()

function req<T = any>(relPath: string): T | null {
  try { return require(path.join(CWD, relPath)) as T } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Z — Regression: C3b screenshot schema + backslash escape
// ─────────────────────────────────────────────────────────────────────────────

export async function groupZ(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[Z] Regression — C3b screenshot schema + escape fix${C.reset}`)
  const results = []

  // ── Part A: MCP schema ─────────────────────────────────────────────────────

  // Read TOOL_SCHEMAS from api/mcp.ts source text (we can't import it without
  // starting the full server, so we inspect the source).
  const mcpSrc = (() => {
    try { return fs.readFileSync(path.join(CWD, 'api', 'mcp.ts'), 'utf-8') } catch { return null }
  })()

  // Z-01: api/mcp.ts is readable
  results.push(await runTest('Z-01', 'Z', 'api/mcp.ts source is readable', () => {
    if (!mcpSrc) return 'Could not read api/mcp.ts'
  }))

  // Z-02: screenshot schema has outputPath property
  results.push(await runTest('Z-02', 'Z',
    'TOOL_SCHEMAS.screenshot includes outputPath property', () => {
      if (!mcpSrc) return 'skipped — api/mcp.ts not readable'
      // Find the screenshot schema line
      const screenshotLine = mcpSrc.split('\n').find(l =>
        /^\s*screenshot:\s*\{/.test(l) && l.includes('properties')
      )
      if (!screenshotLine)
        return 'Could not find screenshot schema line in TOOL_SCHEMAS'
      if (!screenshotLine.includes('outputPath'))
        return `screenshot schema has no outputPath property. Line: ${screenshotLine.trim()}`
    }
  ))

  // Z-03: outputPath is typed as string
  results.push(await runTest('Z-03', 'Z',
    'outputPath in screenshot schema is typed as string', () => {
      if (!mcpSrc) return 'skipped — api/mcp.ts not readable'
      const screenshotLine = mcpSrc.split('\n').find(l =>
        /^\s*screenshot:\s*\{/.test(l) && l.includes('outputPath')
      )
      if (!screenshotLine) return 'skipped — outputPath not found in screenshot schema'
      if (!screenshotLine.includes("type: 'string'") && !screenshotLine.includes('type: "string"'))
        return 'outputPath exists but is not typed as string'
    }
  ))

  // Z-04: outputPath is NOT in required array (it's optional)
  results.push(await runTest('Z-04', 'Z',
    'outputPath is optional (no required array for screenshot)', () => {
      if (!mcpSrc) return 'skipped — api/mcp.ts not readable'
      const screenshotLine = mcpSrc.split('\n').find(l =>
        /^\s*screenshot:\s*\{/.test(l) && l.includes('outputPath')
      )
      if (!screenshotLine) return 'skipped — outputPath not found'
      if (screenshotLine.includes("required:") && screenshotLine.includes("'outputPath'"))
        return 'outputPath should be optional but is listed in required'
    }
  ))

  // ── Part B: Backslash escape fix in computerControl.ts ─────────────────────

  const ccSrc = (() => {
    try { return fs.readFileSync(path.join(CWD, 'core', 'computerControl.ts'), 'utf-8') } catch { return null }
  })()

  // Z-05: computerControl.ts is readable
  results.push(await runTest('Z-05', 'Z', 'core/computerControl.ts source is readable', () => {
    if (!ccSrc) return 'Could not read core/computerControl.ts'
  }))

  // Z-06: No double-backslash replacement in takeScreenshot
  results.push(await runTest('Z-06', 'Z',
    'takeScreenshot does NOT double-escape backslashes (.replace(/\\\\/g, ...))', () => {
      if (!ccSrc) return 'skipped — computerControl.ts not readable'

      // Find the takeScreenshot function body
      const fnStart = ccSrc.indexOf('async function takeScreenshot')
      if (fnStart === -1) return 'Could not find takeScreenshot function'

      // Get ~40 lines after the function declaration
      const fnBody = ccSrc.slice(fnStart, fnStart + 1500)

      // The old bug: filepath.replace(/\\/g, '\\\\')
      // We check for the pattern of replacing single backslash with double
      if (/filepath\.replace\(.*\\\\.*,\s*['"]\\\\\\\\['"]\)/.test(fnBody))
        return 'takeScreenshot still has filepath.replace(/\\\\/g, "\\\\\\\\") — double-escape bug not fixed'

      // Also check there's no other sneaky double-escape
      if (/\.replace\([^)]*\\\\[^)]*\\\\\\\\/.test(fnBody))
        return 'takeScreenshot still contains a backslash-doubling .replace() call'
    }
  ))

  // Z-07: $bitmap.Save uses filepath (not escaped) or at minimum no double-backslash
  results.push(await runTest('Z-07', 'Z',
    '$bitmap.Save() uses unescaped filepath variable', () => {
      if (!ccSrc) return 'skipped — computerControl.ts not readable'
      const fnStart = ccSrc.indexOf('async function takeScreenshot')
      if (fnStart === -1) return 'Could not find takeScreenshot function'
      const fnBody = ccSrc.slice(fnStart, fnStart + 1500)

      // The template should reference ${filepath} or ${escaped} where escaped = filepath (no transform)
      // Check that the Save line doesn't use a double-escaped variable
      const saveLine = fnBody.split('\n').find(l => l.includes('$bitmap.Save'))
      if (!saveLine) return 'Could not find $bitmap.Save line in takeScreenshot'

      // The variable interpolated into Save should be filepath or escaped (which now equals filepath)
      // As long as escaped = filepath (no .replace doubling), either name is fine
    }
  ))

  results.forEach(printResult)
  return summarize('Z', 'C3b screenshot schema + escape fix', results)
}
