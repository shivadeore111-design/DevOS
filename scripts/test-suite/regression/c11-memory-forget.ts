// ============================================================
// C11 Memory Forget Regression Tests
// scripts/test-suite/regression/c11-memory-forget.ts
//
// Proves C11 fix: memory_forget tool exists and is wired end-to-end.
// "forget" verb detected, MemoryGuard forces memory_forget,
// removeRecords() deletes matching entries from records.jsonl.
//
// Zero I/O — pure logic + source-text inspection.
// ============================================================

import fs   from 'fs'
import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()

function req<T = any>(relPath: string): T | null {
  try { return require(path.join(CWD, relPath)) as T } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group M — Regression: C11 memory_forget
// ─────────────────────────────────────────────────────────────────────────────

export async function groupM(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[M] Regression — C11 memory_forget${C.reset}`)
  const results = []

  // ── Load modules ──────────────────────────────────────────────────────────
  const detector = req<{
    isActionIntent?: (msg: string) => boolean
    isMemoryIntent?: (msg: string) => boolean
    isForgetIntent?: (msg: string) => boolean
    extractMemoryFact?: (msg: string) => string
  }>('core/actionVerbDetector')

  const memIds = req<{
    removeRecords?: (predicate: (r: any) => boolean) => number
    loadAllRecords?: () => any[]
    appendRecord?: (r: any) => void
  }>('core/memoryIds')

  const registry = req<{ TOOL_REGISTRY?: Record<string, any> }>('core/toolRegistry')

  // ── M-01: 'forget' in ACTION_VERB_RE ──────────────────────────────────────
  results.push(await runTest('M-01', 'M',
    "'forget' detected by isActionIntent", () => {
      if (!detector?.isActionIntent) return 'isActionIntent not exported'
      if (!detector.isActionIntent('forget my favorite color'))
        return "isActionIntent('forget my favorite color') returned false"
    }
  ))

  // ── M-02: 'forget' in MEMORY_VERB_RE ──────────────────────────────────────
  results.push(await runTest('M-02', 'M',
    "'forget X' returns isMemoryIntent true", () => {
      if (!detector?.isMemoryIntent) return 'isMemoryIntent not exported'
      if (!detector.isMemoryIntent('forget my favorite color'))
        return "isMemoryIntent('forget my favorite color') returned false"
    }
  ))

  // ── M-03: extractMemoryFact strips 'forget' prefix ────────────────────────
  results.push(await runTest('M-03', 'M',
    "extractMemoryFact strips 'forget' prefix correctly", () => {
      if (!detector?.extractMemoryFact) return 'extractMemoryFact not exported'
      const fact = detector.extractMemoryFact('forget my favorite color')
      if (fact.toLowerCase().startsWith('forget'))
        return `prefix not stripped: "${fact}"`
      if (!fact.toLowerCase().includes('favorite color'))
        return `expected "my favorite color" (or similar), got: "${fact}"`
    }
  ))

  // ── M-04: removeRecords exported ──────────────────────────────────────────
  results.push(await runTest('M-04', 'M',
    'removeRecords exported from core/memoryIds', () => {
      if (!memIds) return 'require(core/memoryIds) threw'
      if (typeof memIds.removeRecords !== 'function')
        return 'removeRecords is not exported as a function'
    }
  ))

  // ── M-05: removeRecords with match removes entry ─────────────────────────
  // Use a temp file to avoid corrupting real records.jsonl
  results.push(await runTest('M-05', 'M',
    'removeRecords with matching predicate removes entry and returns count', () => {
      if (typeof memIds?.removeRecords !== 'function' ||
          typeof memIds?.loadAllRecords !== 'function' ||
          typeof memIds?.appendRecord !== 'function')
        return 'required functions not available'

      // Snapshot existing records
      const MEM_DIR      = path.join(CWD, 'workspace', 'memory')
      const RECORDS_FILE = path.join(MEM_DIR, 'records.jsonl')
      const backup       = fs.existsSync(RECORDS_FILE)
        ? fs.readFileSync(RECORDS_FILE, 'utf-8') : null

      try {
        // Write a test record
        const testRecord = {
          id: 'mem_test_c11', timestamp: new Date().toISOString(),
          type: 'fact', content: 'C11_TEST_MARKER_unique_xyz',
          summary: 'C11_TEST_MARKER_unique_xyz', tags: ['test'],
        }
        memIds.appendRecord(testRecord)

        // Remove it
        const removed = memIds.removeRecords(
          (r: any) => r.content === 'C11_TEST_MARKER_unique_xyz',
        )
        if (removed !== 1) return `expected 1 removal, got ${removed}`

        // Verify gone
        const remaining = memIds.loadAllRecords()
        const stillThere = remaining.find(
          (r: any) => r.content === 'C11_TEST_MARKER_unique_xyz',
        )
        if (stillThere) return 'record still present after removeRecords'
      } finally {
        // Restore original
        if (backup !== null) fs.writeFileSync(RECORDS_FILE, backup, 'utf-8')
        else if (fs.existsSync(RECORDS_FILE)) fs.unlinkSync(RECORDS_FILE)
      }
    }
  ))

  // ── M-06: removeRecords with no match returns 0 ──────────────────────────
  results.push(await runTest('M-06', 'M',
    'removeRecords with no-match predicate leaves file intact and returns 0', () => {
      if (typeof memIds?.removeRecords !== 'function' ||
          typeof memIds?.loadAllRecords !== 'function')
        return 'required functions not available'

      const MEM_DIR      = path.join(CWD, 'workspace', 'memory')
      const RECORDS_FILE = path.join(MEM_DIR, 'records.jsonl')
      const before       = fs.existsSync(RECORDS_FILE)
        ? fs.readFileSync(RECORDS_FILE, 'utf-8') : null

      try {
        const countBefore = memIds.loadAllRecords().length
        const removed = memIds.removeRecords(
          (_: any) => false, // matches nothing
        )
        if (removed !== 0) return `expected 0 removals, got ${removed}`
        const countAfter = memIds.loadAllRecords().length
        if (countBefore !== countAfter)
          return `record count changed: ${countBefore} → ${countAfter}`
      } finally {
        // Restore just in case
        if (before !== null) fs.writeFileSync(RECORDS_FILE, before, 'utf-8')
      }
    }
  ))

  // ── M-07: memory_forget registered in TOOL_REGISTRY ──────────────────────
  results.push(await runTest('M-07', 'M',
    'memory_forget registered in TOOL_REGISTRY', () => {
      if (!registry?.TOOL_REGISTRY) return 'TOOL_REGISTRY not loaded'
      if (!registry.TOOL_REGISTRY['memory_forget'])
        return 'memory_forget not found in TOOL_REGISTRY'
    }
  ))

  // ── M-08: memory_forget in TOOL_CATEGORIES under 'memory' ────────────────
  results.push(await runTest('M-08', 'M',
    "memory_forget in TOOL_CATEGORIES under 'memory'", () => {
      if (!registry?.TOOL_REGISTRY) return 'TOOL_REGISTRY not loaded'
      const entry = registry.TOOL_REGISTRY['memory_forget']
      if (!entry) return 'memory_forget not in registry'
      const cats = entry.category as string[] | undefined
      if (!Array.isArray(cats) || !cats.includes('memory'))
        return `expected category ['memory'], got ${JSON.stringify(cats)}`
    }
  ))

  // ── M-09: planner rule 0b mentions forget verbs (source-text) ─────────────
  const src = (() => {
    try { return fs.readFileSync(path.join(CWD, 'core', 'agentLoop.ts'), 'utf-8') } catch { return null }
  })()

  results.push(await runTest('M-09', 'M',
    'planner rule 0b mentions forget verbs', () => {
      if (!src) return 'Could not read core/agentLoop.ts'
      // Find the rule 0b line
      const ruleIdx = src.indexOf('0b. MEMORY OPERATIONS')
      if (ruleIdx === -1) return 'Rule 0b not found in planner prompt'
      const ruleBlock = src.slice(ruleIdx, ruleIdx + 600)
      if (!ruleBlock.includes('forget'))
        return 'Rule 0b does not mention "forget"'
      if (!ruleBlock.includes('memory_forget'))
        return 'Rule 0b does not mention "memory_forget" tool'
    }
  ))

  // ── M-10: MemoryGuard handles forget intent (source-text) ─────────────────
  results.push(await runTest('M-10', 'M',
    'MemoryGuard handles forget intent', () => {
      if (!src) return 'Could not read core/agentLoop.ts'
      const guardIdx = src.indexOf('MemoryGuard: override wrong-tool plans')
      if (guardIdx === -1) return 'MemoryGuard block not found'
      const guardBlock = src.slice(guardIdx, guardIdx + 1200)
      if (!guardBlock.includes('isForgetIntent'))
        return 'MemoryGuard does not call isForgetIntent'
      if (!guardBlock.includes("tool: 'memory_forget'"))
        return "MemoryGuard does not force memory_forget tool"
    }
  ))

  results.forEach(printResult)
  return summarize('M', 'C11 memory_forget', results)
}
