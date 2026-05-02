// ============================================================
// C3 Screenshot outputPath Regression Test
// scripts/test-suite/regression/c3-screenshot-path.ts
//
// Verifies that resolveScreenshotPath() routes to the right
// location depending on whether outputPath is supplied.
//
// Zero I/O — tests the pure path-resolver only.
// ============================================================

import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()

function req<T = any>(relPath: string): T | null {
  try { return require(path.join(CWD, relPath)) as T } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group S — Regression: C3 screenshot outputPath routing
// ─────────────────────────────────────────────────────────────────────────────

export async function groupS(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[S] Regression — C3 screenshot outputPath${C.reset}`)
  const results = []

  const mod = req<{ resolveScreenshotPath?: Function }>('core/computerControl')

  // ── S-01: export exists ───────────────────────────────────────────────────
  results.push(await runTest('S-01', 'S', 'core/computerControl exports resolveScreenshotPath', () => {
    if (!mod) return 'require(core/computerControl) threw — check compilation'
    if (typeof mod.resolveScreenshotPath !== 'function')
      return 'resolveScreenshotPath is not exported'
  }))

  if (typeof mod?.resolveScreenshotPath !== 'function') {
    const bail = (id: string, desc: string) =>
      ({ id, group: 'S', desc, verdict: 'FAIL' as const, durationMs: 0,
         detail: 'skipped — resolveScreenshotPath not available' })
    results.push(bail('S-02', 'no outputPath → path is inside workspace/screenshots/'))
    results.push(bail('S-03', 'absolute outputPath → returns that exact path'))
    results.push(bail('S-04', 'absolute outputPath → does NOT contain workspace/screenshots'))
    results.push(bail('S-05', 'relative outputPath → throws with helpful message'))
    results.push(bail('S-06', 'empty-string outputPath → falls back to workspace/screenshots/'))
    results.forEach(printResult)
    return summarize('S', 'Regression: C3 screenshot outputPath', results)
  }

  const resolve = mod!.resolveScreenshotPath as Function
  const screenshotsDir = path.join(CWD, 'workspace', 'screenshots')

  // ── S-02: no outputPath → workspace/screenshots/ ─────────────────────────
  results.push(await runTest('S-02', 'S',
    'no outputPath → path is inside workspace/screenshots/',
    () => {
      const p = resolve()
      if (!p.startsWith(screenshotsDir))
        return `Expected path inside ${screenshotsDir}, got: ${p}`
      if (!p.endsWith('.png'))
        return `Expected .png extension, got: ${p}`
    }
  ))

  // ── S-03: absolute outputPath → returned as-is ────────────────────────────
  results.push(await runTest('S-03', 'S',
    'absolute Windows outputPath → returns that exact path',
    () => {
      const abs = 'C:\\Users\\shiva\\Desktop\\c3_test.png'
      const p   = resolve(abs)
      if (p !== abs)
        return `Expected "${abs}", got: "${p}"`
    }
  ))

  // ── S-04: absolute outputPath → NOT inside workspace/screenshots ──────────
  results.push(await runTest('S-04', 'S',
    'absolute outputPath → result does NOT contain workspace/screenshots',
    () => {
      const abs = 'C:\\Users\\shiva\\Desktop\\c3_test.png'
      const p   = resolve(abs)
      if (p.includes('workspace') || p.includes('screenshots'))
        return `Path should NOT route through workspace/screenshots. Got: ${p}`
    }
  ))

  // ── S-05: relative outputPath → throws ───────────────────────────────────
  results.push(await runTest('S-05', 'S',
    'relative outputPath → throws with helpful message',
    () => {
      try {
        resolve('relative.png')
        return 'Expected an error for relative path, but none was thrown'
      } catch (e: any) {
        if (!e.message.includes('absolute'))
          return `Error message should mention "absolute". Got: ${e.message}`
        // pass
      }
    }
  ))

  // ── S-06: empty string → same as omitted (workspace default) ─────────────
  results.push(await runTest('S-06', 'S',
    'empty-string outputPath → falls back to workspace/screenshots/',
    () => {
      const p = resolve('')
      if (!p.startsWith(screenshotsDir))
        return `Expected path inside ${screenshotsDir}, got: ${p}`
    }
  ))

  results.forEach(printResult)
  return summarize('S', 'Regression: C3 screenshot outputPath', results)
}
