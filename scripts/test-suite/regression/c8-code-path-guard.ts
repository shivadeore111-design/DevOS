// ============================================================
// C8 Code Path Guard Regression Tests
// scripts/test-suite/regression/c8-code-path-guard.ts
//
// Proves C8 fix: run_node and run_python now scan code for
// destructive fs operations targeting protected system paths.
// Closes the bypass where planner re-routes through run_node
// after shell_exec is denied.
//
// Zero I/O — pure logic tests (no server, no LLM calls).
// ============================================================

import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()

function req<T = any>(relPath: string): T | null {
  try { return require(path.join(CWD, relPath)) as T } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Q — Regression: C8 run_node/run_python path guards
// ─────────────────────────────────────────────────────────────────────────────

export async function groupQ(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[Q] Regression — C8 code path guards${C.reset}`)
  const results = []

  const registry = req<{
    scanCodeForDestructivePaths?: (code: string, lang: 'node' | 'python') => { denied: boolean; reason: string }
  }>('core/toolRegistry')

  // ── Q-01: export exists ───────────────────────────────────────────────────
  results.push(await runTest('Q-01', 'Q', 'core/toolRegistry exports scanCodeForDestructivePaths', () => {
    if (!registry) return 'require(core/toolRegistry) threw — check compilation'
    if (typeof registry.scanCodeForDestructivePaths !== 'function')
      return 'scanCodeForDestructivePaths is not exported'
  }))

  const scan = registry?.scanCodeForDestructivePaths
  if (typeof scan !== 'function') {
    const bail = (id: string, desc: string) =>
      results.push({ id, group: 'Q', desc, verdict: 'SKIP' as const, durationMs: 0, detail: 'skipped — export missing' })
    bail('Q-02', 'Node: fs.rmSync + C:\\Users\\ → denied')
    bail('Q-03', 'Node: fs.unlinkSync + C:\\Windows\\ → denied')
    bail('Q-04', 'Node: fs.promises.rm + C:\\Program Files → denied')
    bail('Q-05', 'Python: shutil.rmtree + C:\\Users\\ → denied')
    bail('Q-06', 'Python: os.remove + /home/ → denied')
    bail('Q-07', 'Node: fs.rmSync + workspace path → allowed (not protected)')
    bail('Q-08', 'Node: fs.readFileSync + C:\\Users\\ → allowed (read, not destructive)')
    bail('Q-09', 'Python: open() + C:\\Users\\ → allowed (read, not destructive)')
    bail('Q-10', 'Node: console.log only → allowed (no destructive op)')
    bail('Q-11', 'Python: os.remove + /tmp/ → allowed (not protected)')
    bail('Q-12', 'Node: rimraf + C:\\Users\\ → denied')
    results.forEach(printResult)
    return summarize('Q', 'C8 code path guards', results)
  }

  // ── Destructive + protected path → DENIED ─────────────────────────────────

  results.push(await runTest('Q-02', 'Q',
    'Node: fs.rmSync + C:\\Users\\ → denied', () => {
      const r = scan('const fs = require("fs"); fs.rmSync("C:\\\\Users\\\\shiva\\\\Desktop", { recursive: true })', 'node')
      if (!r.denied) return 'fs.rmSync targeting C:\\Users\\ was NOT denied'
    }
  ))

  results.push(await runTest('Q-03', 'Q',
    'Node: fs.unlinkSync + C:\\Windows\\ → denied', () => {
      const r = scan('fs.unlinkSync("C:\\\\Windows\\\\System32\\\\file.dll")', 'node')
      if (!r.denied) return 'fs.unlinkSync targeting C:\\Windows\\ was NOT denied'
    }
  ))

  results.push(await runTest('Q-04', 'Q',
    'Node: fs.promises.rm + C:\\Program Files → denied', () => {
      const r = scan('await fs.promises.rm("C:\\\\Program Files\\\\App", { recursive: true })', 'node')
      if (!r.denied) return 'fs.promises.rm targeting C:\\Program Files was NOT denied'
    }
  ))

  results.push(await runTest('Q-05', 'Q',
    'Python: shutil.rmtree + C:\\Users\\ → denied', () => {
      const r = scan('import shutil\nshutil.rmtree("C:\\\\Users\\\\shiva")', 'python')
      if (!r.denied) return 'shutil.rmtree targeting C:\\Users\\ was NOT denied'
    }
  ))

  results.push(await runTest('Q-06', 'Q',
    'Python: os.remove + /home/ → denied', () => {
      const r = scan('import os\nos.remove("/home/user/file.txt")', 'python')
      if (!r.denied) return 'os.remove targeting /home/ was NOT denied'
    }
  ))

  results.push(await runTest('Q-12', 'Q',
    'Node: rimraf + C:\\Users\\ → denied', () => {
      const r = scan('const rimraf = require("rimraf"); rimraf.sync("C:\\\\Users\\\\shiva\\\\junk")', 'node')
      if (!r.denied) return 'rimraf targeting C:\\Users\\ was NOT denied'
    }
  ))

  // ── Destructive + non-protected path → ALLOWED ────────────────────────────

  results.push(await runTest('Q-07', 'Q',
    'Node: fs.rmSync + workspace path → allowed (not protected)', () => {
      const r = scan('fs.rmSync("./workspace/tmp/old.json")', 'node')
      if (r.denied) return 'fs.rmSync on workspace path was incorrectly denied'
    }
  ))

  results.push(await runTest('Q-11', 'Q',
    'Python: os.remove + /tmp/ → allowed (not protected)', () => {
      const r = scan('os.remove("/tmp/scratch.txt")', 'python')
      if (r.denied) return 'os.remove on /tmp/ was incorrectly denied'
    }
  ))

  // ── Non-destructive + protected path → ALLOWED ────────────────────────────

  results.push(await runTest('Q-08', 'Q',
    'Node: fs.readFileSync + C:\\Users\\ → allowed (read, not destructive)', () => {
      const r = scan('const data = fs.readFileSync("C:\\\\Users\\\\shiva\\\\file.txt", "utf-8")', 'node')
      if (r.denied) return 'fs.readFileSync on C:\\Users\\ was incorrectly denied — reads should be allowed'
    }
  ))

  results.push(await runTest('Q-09', 'Q',
    'Python: open() + C:\\Users\\ → allowed (read, not destructive)', () => {
      const r = scan('with open("C:\\\\Users\\\\shiva\\\\file.txt") as f:\n  data = f.read()', 'python')
      if (r.denied) return 'open() on C:\\Users\\ was incorrectly denied — reads should be allowed'
    }
  ))

  // ── No destructive op at all → ALLOWED ────────────────────────────────────

  results.push(await runTest('Q-10', 'Q',
    'Node: console.log only → allowed (no destructive op)', () => {
      const r = scan('console.log("Hello from C:\\\\Users\\\\shiva")', 'node')
      if (r.denied) return 'console.log mentioning C:\\Users\\ was incorrectly denied'
    }
  ))

  results.forEach(printResult)
  return summarize('Q', 'C8 code path guards', results)
}
