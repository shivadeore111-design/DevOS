// ============================================================
// C1 Honesty-Fallback Regression Test
// scripts/test-suite/regression/c1-honesty-fallback.ts
//
// Proves that respondWithResults() surfaces BOTH successes and
// failures when ALL LLM providers are down (synthesis throws).
//
// Zero network calls — global.fetch is monkey-patched to throw.
// ============================================================

import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()

// ── Safe require ──────────────────────────────────────────────────────────────

function req<T = any>(relPath: string): T | null {
  try {
    return require(path.join(CWD, relPath)) as T
  } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group R — Regression: C1 honesty fallback
// ─────────────────────────────────────────────────────────────────────────────

export async function groupR(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[R] Regression — C1 honesty fallback${C.reset}`)
  const results = []

  // ── Import respondWithResults ─────────────────────────────────────────────
  const agentLoopMod = req<{ respondWithResults?: Function }>('core/agentLoop')

  results.push(await runTest('R-01', 'R', 'core/agentLoop exports respondWithResults', () => {
    if (!agentLoopMod) return 'require(core/agentLoop) threw — check compilation'
    if (typeof agentLoopMod.respondWithResults !== 'function')
      return 'respondWithResults is not exported'
  }))

  if (typeof agentLoopMod?.respondWithResults !== 'function') {
    // Can't run the rest — mark them all failed
    const bail = (id: string, desc: string) =>
      ({ id, group: 'R', desc, verdict: 'FAIL' as const, durationMs: 0,
         detail: 'skipped — respondWithResults not available' })
    results.push(bail('R-02', 'C1: mixed results — output contains success tool name'))
    results.push(bail('R-03', 'C1: mixed results — output contains failure error text'))
    results.push(bail('R-04', 'C1: mixed results — output contains provider-unavailable notice'))
    results.push(bail('R-05', 'C1: all-success — falls back to last output, no provider notice'))
    results.push(bail('R-06', 'C1: all-failed — no success prefix in output'))
    results.forEach(printResult)
    return summarize('R', 'Regression: C1 honesty fallback', results)
  }

  const respondWithResults = agentLoopMod!.respondWithResults as Function

  // ── Minimal mock objects ──────────────────────────────────────────────────

  const mockPlan = {
    goal:               'test',
    requires_execution: true,
    plan:               [],
    planId:             'test-plan-001',
  }

  const mixedResults = [
    { step: 1, tool: 'file_write', success: true,  output: 'wrote test.txt', input: {}, duration: 10 },
    { step: 2, tool: 'file_read',  success: false, output: '',               input: {}, duration: 5,
      error: 'ENOENT: no such file or directory' },
  ]

  const allSuccessResults = [
    { step: 1, tool: 'file_write', success: true, output: 'wrote output.txt', input: {}, duration: 10 },
    { step: 2, tool: 'shell_exec', success: true, output: 'exit 0',           input: {}, duration: 20 },
  ]

  const allFailResults = [
    { step: 1, tool: 'file_read',  success: false, output: '', input: {}, duration: 5,
      error: 'ENOENT: no such file or directory' },
    { step: 2, tool: 'shell_exec', success: false, output: '', input: {}, duration: 3,
      error: 'command not found: blah' },
  ]

  // ── Helper: run respondWithResults with fetch stubbed to throw ────────────

  async function runWithProviderDown(stepResults: any[]): Promise<string> {
    const origFetch = global.fetch
    // Stub ALL fetch (covers primary LLM + Ollama fallback)
    ;(global as any).fetch = async () => { throw new Error('All providers down (stub)') }

    const tokens: string[] = []
    try {
      await respondWithResults(
        'test message',
        mockPlan,
        stepResults,
        [],           // history
        'testuser',
        'test-key',
        'test-model',
        'test-provider',
        (t: string) => tokens.push(t),
        undefined,    // sessionId
        undefined,    // goals
      )
    } finally {
      ;(global as any).fetch = origFetch
    }

    return tokens.join('')
  }

  // ── R-02 — Mixed: output contains the success tool name ──────────────────

  results.push(await runTest('R-02', 'R',
    'C1 mixed results — output contains success tool name (file_write)',
    async () => {
      const out = await runWithProviderDown(mixedResults)
      if (!out.includes('file_write'))
        return `Expected "file_write" in output. Got: ${JSON.stringify(out.slice(0, 200))}`
    }
  ))

  // ── R-03 — Mixed: output contains the failure error text ─────────────────

  results.push(await runTest('R-03', 'R',
    'C1 mixed results — output contains failure error (ENOENT)',
    async () => {
      const out = await runWithProviderDown(mixedResults)
      const hasEnoent = out.toLowerCase().includes('enoent') ||
                        out.toLowerCase().includes('no such file')
      if (!hasEnoent)
        return `Expected ENOENT / "no such file" in output. Got: ${JSON.stringify(out.slice(0, 200))}`
    }
  ))

  // ── R-04 — Mixed: output contains the provider-unavailable notice ─────────

  results.push(await runTest('R-04', 'R',
    'C1 mixed results — output contains provider-unavailable notice',
    async () => {
      const out = await runWithProviderDown(mixedResults)
      if (!out.includes('(All language providers'))
        return `Expected "(All language providers" in output. Got: ${JSON.stringify(out.slice(0, 200))}`
    }
  ))

  // ── R-05 — All-success: falls back to last output, no provider notice ─────

  results.push(await runTest('R-05', 'R',
    'C1 all-success — returns last step output, no provider notice',
    async () => {
      const out = await runWithProviderDown(allSuccessResults)
      if (!out.includes('exit 0'))
        return `Expected last step output "exit 0". Got: ${JSON.stringify(out.slice(0, 200))}`
      if (out.includes('(All language providers'))
        return `Should NOT contain provider notice for all-success. Got: ${JSON.stringify(out.slice(0, 200))}`
    }
  ))

  // ── R-06 — All-failed: no "Completed:" prefix, still has provider notice ──

  results.push(await runTest('R-06', 'R',
    'C1 all-failed — no "Completed:" prefix, still surfaces failures + notice',
    async () => {
      const out = await runWithProviderDown(allFailResults)
      if (out.includes('Completed:'))
        return `Should NOT contain "Completed:" when all steps failed. Got: ${JSON.stringify(out.slice(0, 200))}`
      if (!out.includes('(All language providers'))
        return `Expected provider notice. Got: ${JSON.stringify(out.slice(0, 200))}`
      if (!out.toLowerCase().includes('enoent') && !out.toLowerCase().includes('no such file'))
        return `Expected ENOENT in all-failed output. Got: ${JSON.stringify(out.slice(0, 200))}`
    }
  ))

  results.forEach(printResult)
  return summarize('R', 'Regression: C1 honesty fallback', results)
}
