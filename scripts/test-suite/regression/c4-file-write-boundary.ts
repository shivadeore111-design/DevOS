// ============================================================
// C4 file_write Boundary Check Regression Test
// scripts/test-suite/regression/c4-file-write-boundary.ts
//
// Proves that resolveWritePath() allows workspace/Desktop/Documents
// and rejects everything else — zero I/O, pure logic tests.
// ============================================================

import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()

function req<T = any>(relPath: string): T | null {
  try { return require(path.join(CWD, relPath)) as T } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group W — Regression: C4 file_write boundary check
// ─────────────────────────────────────────────────────────────────────────────

export async function groupW(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[W] Regression — C4 file_write boundary check${C.reset}`)
  const results = []

  const mod = req<{ resolveWritePath?: Function }>('core/toolRegistry')

  // ── W-01: export exists ───────────────────────────────────────────────────
  results.push(await runTest('W-01', 'W', 'core/toolRegistry exports resolveWritePath', () => {
    if (!mod) return 'require(core/toolRegistry) threw — check compilation'
    if (typeof mod.resolveWritePath !== 'function')
      return 'resolveWritePath is not exported'
  }))

  if (typeof mod?.resolveWritePath !== 'function') {
    const bail = (id: string, desc: string) =>
      ({ id, group: 'W', desc, verdict: 'FAIL' as const, durationMs: 0,
         detail: 'skipped — resolveWritePath not available' })
    results.push(bail('W-02', 'workspace-relative path resolves OK'))
    results.push(bail('W-03', 'Desktop absolute path resolves OK'))
    results.push(bail('W-04', 'Documents absolute path resolves OK'))
    results.push(bail('W-05', 'C:\\Windows\\test.txt → throws boundary error'))
    results.push(bail('W-06', 'C:\\test.txt (drive root) → throws boundary error'))
    results.push(bail('W-07', 'D:\\test.txt (other drive) → throws boundary error'))
    results.push(bail('W-08', 'error message contains "outside allowed write locations"'))
    results.forEach(printResult)
    return summarize('W', 'Regression: C4 file_write boundary check', results)
  }

  const resolve = mod!.resolveWritePath as Function

  // Fixed home/cwd so tests are hermetic regardless of machine
  const home = 'C:\\Users\\shiva'
  const cwd  = 'C:\\Users\\shiva\\DevOS'
  const opts = { home, cwd }

  // ── W-02: workspace-relative path → resolves to cwd/... ──────────────────
  results.push(await runTest('W-02', 'W',
    'workspace-relative path resolves inside workspace',
    () => {
      const r = resolve('notes\\foo.txt', opts)
      if (!r.startsWith(cwd))
        return `Expected path inside ${cwd}, got: ${r}`
    }
  ))

  // ── W-03: Desktop absolute path → allowed ─────────────────────────────────
  results.push(await runTest('W-03', 'W',
    'Desktop absolute path resolves OK',
    () => {
      const abs = `${home}\\Desktop\\c4_test.txt`
      const r   = resolve(abs, opts)
      if (r !== abs) return `Expected "${abs}", got: "${r}"`
    }
  ))

  // ── W-04: Documents absolute path → allowed ───────────────────────────────
  results.push(await runTest('W-04', 'W',
    'Documents absolute path resolves OK',
    () => {
      const abs = `${home}\\Documents\\report.txt`
      const r   = resolve(abs, opts)
      if (r !== abs) return `Expected "${abs}", got: "${r}"`
    }
  ))

  // ── W-05: C:\Windows\test.txt → boundary error ────────────────────────────
  results.push(await runTest('W-05', 'W',
    'C:\\Windows\\test.txt → throws boundary error',
    () => {
      try {
        resolve('C:\\Windows\\test.txt', opts)
        return 'Expected a boundary error, but no error was thrown'
      } catch (e: any) {
        if (!e.message.includes('outside allowed write locations'))
          return `Error should mention "outside allowed write locations". Got: ${e.message}`
      }
    }
  ))

  // ── W-06: C:\test.txt (drive root) → boundary error ──────────────────────
  results.push(await runTest('W-06', 'W',
    'C:\\test.txt (drive root) → throws boundary error',
    () => {
      try {
        resolve('C:\\test.txt', opts)
        return 'Expected a boundary error, but no error was thrown'
      } catch (e: any) {
        if (!e.message.includes('outside allowed write locations'))
          return `Error should mention "outside allowed write locations". Got: ${e.message}`
      }
    }
  ))

  // ── W-07: D:\test.txt (other drive) → boundary error ─────────────────────
  results.push(await runTest('W-07', 'W',
    'D:\\test.txt (different drive) → throws boundary error',
    () => {
      try {
        resolve('D:\\test.txt', opts)
        return 'Expected a boundary error, but no error was thrown'
      } catch (e: any) {
        if (!e.message.includes('outside allowed write locations'))
          return `Error should mention "outside allowed write locations". Got: ${e.message}`
      }
    }
  ))

  // ── W-08: error message mentions the specific blocked path ────────────────
  results.push(await runTest('W-08', 'W',
    'boundary error message names the blocked path',
    () => {
      try {
        resolve('C:\\Windows\\system32\\evil.dll', opts)
        return 'Expected a boundary error, but no error was thrown'
      } catch (e: any) {
        if (!e.message.includes('C:\\Windows\\system32\\evil.dll'))
          return `Error should include the path. Got: ${e.message}`
      }
    }
  ))

  results.forEach(printResult)
  return summarize('W', 'Regression: C4 file_write boundary check', results)
}
