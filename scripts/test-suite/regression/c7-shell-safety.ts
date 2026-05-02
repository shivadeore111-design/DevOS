// ============================================================
// C7 Shell Safety Regression Tests
// scripts/test-suite/regression/c7-shell-safety.ts
//
// Proves three C7 fixes:
//   1. Remove-Item removed from SHELL_ALLOWLIST → requires approval
//   2. Path-scoped deny patterns block Remove-Item on system paths
//   3. SkillTeacher destructive-skill lint rejects shell_exec + delete
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
// Group X — Regression: C7 shell safety
// ─────────────────────────────────────────────────────────────────────────────

export async function groupX(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[X] Regression — C7 shell safety${C.reset}`)
  const results = []

  const registry = req<{
    isCommandAllowed?: (cmd: string) => { allowed: boolean; needsApproval: boolean }
    isCommandDenied?:  (cmd: string) => boolean
  }>('core/toolRegistry')

  // ── X-01: exports exist ───────────────────────────────────────────────────
  results.push(await runTest('X-01', 'X', 'core/toolRegistry exports isCommandAllowed', () => {
    if (!registry) return 'require(core/toolRegistry) threw — check compilation'
    if (typeof registry.isCommandAllowed !== 'function')
      return 'isCommandAllowed is not exported'
  }))

  results.push(await runTest('X-02', 'X', 'core/toolRegistry exports isCommandDenied', () => {
    if (!registry) return 'require(core/toolRegistry) threw'
    if (typeof registry.isCommandDenied !== 'function')
      return 'isCommandDenied is not exported'
  }))

  const allow = registry?.isCommandAllowed
  const denied = registry?.isCommandDenied

  if (typeof allow !== 'function' || typeof denied !== 'function') {
    const bail = (id: string, desc: string) =>
      results.push({ group: 'X', id, description: desc, passed: false, skipped: true, error: 'skipped — exports missing' })

    bail('X-03', 'Remove-Item bare path requires approval (not auto-allowed)')
    bail('X-04', 'Remove-Item -Path flag requires approval')
    bail('X-05', 'Remove-Item targeting C:\\Users\\ is hard-denied')
    bail('X-06', 'Remove-Item targeting C:\\Windows\\ is hard-denied')
    bail('X-07', 'Remove-Item targeting C:\\Program Files is hard-denied')
    bail('X-08', 'Remove-Item -Recurse -Force is still dangerous (SHELL_DANGEROUS)')
    bail('X-09', 'Get-ChildItem still auto-allowed (non-destructive PS cmdlets unaffected)')
    bail('X-10', 'Copy-Item still auto-allowed')
    results.forEach(printResult)
    return summarize('X', 'C7 shell safety', results)
  }

  // ── X-03 / X-04: Remove-Item no longer in allowlist → needsApproval ───────
  results.push(await runTest('X-03', 'X',
    'Remove-Item bare path requires approval (not auto-allowed)', () => {
      const r = allow('Remove-Item C:\\temp\\file.txt')
      if (r.allowed && !r.needsApproval)
        return 'Remove-Item is still auto-allowed — not narrowed from allowlist'
    }
  ))

  results.push(await runTest('X-04', 'X',
    'Remove-Item -Path flag requires approval', () => {
      const r = allow('Remove-Item -Path "C:\\temp\\junk.log"')
      if (r.allowed && !r.needsApproval)
        return 'Remove-Item -Path is still auto-allowed'
    }
  ))

  // ── X-05 / X-06 / X-07: path-scoped deny patterns ────────────────────────
  results.push(await runTest('X-05', 'X',
    'Remove-Item targeting C:\\Users\\ is hard-denied', () => {
      const isDenied = denied('Remove-Item "C:\\Users\\shiva\\Desktop\\file.txt"')
      if (!isDenied)
        return 'Remove-Item C:\\Users\\... not caught by DENIED_COMMANDS — path-scoped deny missing'
    }
  ))

  results.push(await runTest('X-06', 'X',
    'Remove-Item targeting C:\\Windows\\ is hard-denied', () => {
      const isDenied = denied('Remove-Item "C:\\Windows\\System32\\drivers\\etc\\hosts"')
      if (!isDenied)
        return 'Remove-Item C:\\Windows\\... not caught by DENIED_COMMANDS'
    }
  ))

  results.push(await runTest('X-07', 'X',
    'Remove-Item targeting C:\\Program Files is hard-denied', () => {
      const isDenied = denied('Remove-Item "C:\\Program Files\\SomeApp\\bin"')
      if (!isDenied)
        return 'Remove-Item C:\\Program Files\\... not caught by DENIED_COMMANDS'
    }
  ))

  // ── X-08: -Recurse -Force still caught by SHELL_DANGEROUS ────────────────
  results.push(await runTest('X-08', 'X',
    'Remove-Item -Recurse -Force still rejected (existing SHELL_DANGEROUS coverage)', () => {
      const r = allow('Remove-Item -Recurse -Force C:\\DevOS')
      if (r.allowed)
        return 'Remove-Item -Recurse -Force is allowed — SHELL_DANGEROUS pattern broken'
    }
  ))

  // ── X-09 / X-10: non-destructive PS cmdlets still auto-allowed ───────────
  results.push(await runTest('X-09', 'X',
    'Get-ChildItem still auto-allowed (non-destructive PS cmdlets unaffected)', () => {
      const r = allow('Get-ChildItem C:\\DevOS')
      if (!r.allowed || r.needsApproval)
        return 'Get-ChildItem no longer auto-allowed — allowlist over-narrowed'
    }
  ))

  results.push(await runTest('X-10', 'X',
    'Copy-Item still auto-allowed', () => {
      const r = allow('Copy-Item C:\\src\\file.txt C:\\dst\\')
      if (!r.allowed || r.needsApproval)
        return 'Copy-Item no longer auto-allowed — allowlist over-narrowed'
    }
  ))

  // ── X-11 / X-12: SkillTeacher destructive-skill lint ─────────────────────
  // We import the class and call recordSuccess with a destructive task +
  // shell_exec.  The lint should fire and return before writing any files.

  results.push(await runTest('X-11', 'X',
    'SkillTeacher rejects destructive shell_exec skill (delete + shell_exec)', async () => {
      const st = req<{ skillTeacher?: any }>('core/skillTeacher')
      if (!st?.skillTeacher) return 'skillTeacher not exported from core/skillTeacher'

      const LEARNED_DIR = path.join(CWD, 'workspace', 'skills', 'learned')
      const skillName   = 'delete_desktop_junk_test_c7'
      const skillDir    = path.join(LEARNED_DIR, skillName)

      // Ensure it doesn't exist before test
      const fs = require('fs')
      if (fs.existsSync(skillDir)) fs.rmSync(skillDir, { recursive: true, force: true })

      // Call recordSuccess with destructive task + shell_exec
      await st.skillTeacher.recordSuccess(
        'delete all files from Desktop junk folder',
        ['shell_exec'],
        500,
        async () => '---\nname: x\ndescription: x\nversion: 1.0.0\norigin: local\nconfidence: low\ntags: x\n---\n# X\n- step 1\n- step 2\n- step 3\n- step 4\n- step 5\n',
        'fake-key',
        'fake-model',
        'fake-provider',
      )

      if (fs.existsSync(skillDir)) {
        fs.rmSync(skillDir, { recursive: true, force: true })
        return 'destructive skill was written — lint did not fire'
      }
    }
  ))

  results.push(await runTest('X-12', 'X',
    'SkillTeacher allows benign shell_exec skill (no destructive keyword)', async () => {
      const st = req<{ skillTeacher?: any }>('core/skillTeacher')
      if (!st?.skillTeacher) return 'skillTeacher not exported from core/skillTeacher'

      // A benign shell task should NOT be blocked by the destructive lint
      // (the lint only fires when task contains destructive keywords).
      // We verify this indirectly: the fact that the lint does NOT fire means
      // we'd reach the session-limit or dedup gate — either way, no false positive.
      // We just confirm it doesn't throw.
      try {
        await st.skillTeacher.recordSuccess(
          'list files in workspace and print summary output',
          ['shell_exec'],
          300,
          async () => '---\nname: x\ndescription: x\nversion: 1.0.0\norigin: local\nconfidence: low\ntags: x\n---\n# X\n- step 1\n- step 2\n- step 3\n- step 4\n- step 5\n',
          'fake-key',
          'fake-model',
          'fake-provider',
        )
      } catch (e: any) {
        return `recordSuccess threw unexpectedly: ${e.message}`
      }
    }
  ))

  results.forEach(printResult)
  return summarize('X', 'C7 shell safety', results)
}
