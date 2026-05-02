// ============================================================
// C5 Memory Action Verbs Regression Test
// scripts/test-suite/regression/c5-memory-action-verbs.ts
//
// Proves that ACTION_VERB_RE in core/actionVerbDetector.ts
// correctly flags memory-store intents so PlannerGuard forces
// a tool call instead of silently returning respond-only.
// Zero I/O — pure logic tests.
// ============================================================

import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()

function req<T = any>(relPath: string): T | null {
  try { return require(path.join(CWD, relPath)) as T } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group V — Regression: C5 memory action verbs
// ─────────────────────────────────────────────────────────────────────────────

export async function groupV(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[V] Regression — C5 memory action verbs${C.reset}`)
  const results = []

  const mod = req<{ isActionIntent?: Function; detectActionVerb?: Function }>(
    'core/actionVerbDetector'
  )

  // ── V-01: export exists ───────────────────────────────────────────────────
  results.push(await runTest('V-01', 'V', 'core/actionVerbDetector exports isActionIntent', () => {
    if (!mod) return 'require(core/actionVerbDetector) threw — check compilation'
    if (typeof mod.isActionIntent !== 'function')
      return 'isActionIntent is not exported'
  }))

  if (typeof mod?.isActionIntent !== 'function') {
    const bail = (id: string, desc: string) =>
      ({ id, group: 'V', desc, verdict: 'FAIL' as const, durationMs: 0,
         detail: 'skipped — isActionIntent not available' })
    results.push(bail('V-02', '"remember my color is purple" → isActionIntent true'))
    results.push(bail('V-03', '"track my water intake" → isActionIntent true'))
    results.push(bail('V-04', '"note that my name is shiva" → isActionIntent true'))
    results.push(bail('V-05', '"store this fact" → isActionIntent true'))
    results.push(bail('V-06', '"save the file" → isActionIntent true (pre-existing)'))
    results.push(bail('V-07', '"delete test.txt" → isActionIntent true (pre-existing)'))
    results.push(bail('V-08', '"what is the weather" → isActionIntent false'))
    results.push(bail('V-09', '"open notepad please" → true (matches open, not note in notepad)'))
    results.push(bail('V-10', '"remembered yesterday I bought milk" → false (past-tense narrative)'))
    results.forEach(printResult)
    return summarize('V', 'Regression: C5 memory action verbs', results)
  }

  const ia = mod!.isActionIntent as Function

  // ── V-02: remember ────────────────────────────────────────────────────────
  results.push(await runTest('V-02', 'V',
    '"remember my color is purple" → isActionIntent true',
    () => {
      if (!ia('remember my color is purple'))
        return 'Expected true for "remember my color is purple"'
    }
  ))

  // ── V-03: track ───────────────────────────────────────────────────────────
  results.push(await runTest('V-03', 'V',
    '"track my water intake" → isActionIntent true',
    () => {
      if (!ia('track my water intake'))
        return 'Expected true for "track my water intake"'
    }
  ))

  // ── V-04: note ────────────────────────────────────────────────────────────
  results.push(await runTest('V-04', 'V',
    '"note that my name is shiva" → isActionIntent true',
    () => {
      if (!ia('note that my name is shiva'))
        return 'Expected true for "note that my name is shiva"'
    }
  ))

  // ── V-05: store ───────────────────────────────────────────────────────────
  results.push(await runTest('V-05', 'V',
    '"store this fact" → isActionIntent true',
    () => {
      if (!ia('store this fact'))
        return 'Expected true for "store this fact"'
    }
  ))

  // ── V-06: save (pre-existing) ─────────────────────────────────────────────
  results.push(await runTest('V-06', 'V',
    '"save the file" → isActionIntent true (pre-existing verb)',
    () => {
      if (!ia('save the file'))
        return 'Expected true for "save the file" — pre-existing verb regressed'
    }
  ))

  // ── V-07: delete (pre-existing) ───────────────────────────────────────────
  results.push(await runTest('V-07', 'V',
    '"delete test.txt" → isActionIntent true (pre-existing verb)',
    () => {
      if (!ia('delete test.txt'))
        return 'Expected true for "delete test.txt" — pre-existing verb regressed'
    }
  ))

  // ── V-08: question → false ────────────────────────────────────────────────
  results.push(await runTest('V-08', 'V',
    '"what is the weather" → isActionIntent false',
    () => {
      if (ia('what is the weather'))
        return 'Expected false for "what is the weather" — question should not match'
    }
  ))

  // ── V-09: open notepad → true (matches 'open', not 'note' inside 'notepad') ──
  results.push(await runTest('V-09', 'V',
    '"open notepad please" → true via open verb, not partial note match',
    () => {
      // Must be true (via 'open'), but we also verify detectActionVerb returns 'open'
      if (!ia('open notepad please'))
        return 'Expected true for "open notepad please"'
      const mod2 = req<{ detectActionVerb?: Function }>('core/actionVerbDetector')
      if (typeof mod2?.detectActionVerb === 'function') {
        const verb = mod2.detectActionVerb('open notepad please')
        if (verb !== 'open')
          return `detectActionVerb returned "${verb}", expected "open" — 'note' may be over-matching inside 'notepad'`
      }
    }
  ))

  // ── V-10: past-tense narrative → false ────────────────────────────────────
  results.push(await runTest('V-10', 'V',
    '"remembered yesterday I bought milk" → false (past-tense narrative)',
    () => {
      // "remembered" starts with "remember" but with suffix — \b anchor ensures it matches
      // only if the word boundary falls right after "remember". "remembered" has 'ed' after,
      // so \b is between 'r' and 'e' of 'ed'? No — \b is between non-word and word char.
      // "remembered" — 'remember' ends at 'r', 'ed' follows — no word boundary at 'remember\b'.
      // But wait: "remembered" contains "remember" as a prefix. Does /remember\b/ match inside
      // "remembered"? Let's verify: \b matches at a word boundary; in "remembered", after the
      // 'r' of 'remember' comes 'e' (still \w), so \b does NOT match there.
      // Therefore isActionIntent('remembered...') should be false.
      if (ia('remembered yesterday I bought milk'))
        return 'Expected false for "remembered yesterday I bought milk" — past-tense should not match'
    }
  ))

  results.forEach(printResult)
  return summarize('V', 'Regression: C5 memory action verbs', results)
}
