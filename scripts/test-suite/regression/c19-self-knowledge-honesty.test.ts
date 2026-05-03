// ============================================================
// C19 Self-Knowledge Honesty Regression Tests
// scripts/test-suite/regression/c19-self-knowledge-honesty.test.ts
//
// Proves C19 fix: hardcoded "48 tools, 31 specialist agents,
// 500+ memories, 714-node entity graph, 6-layer memory system"
// replaced with dynamic counts from TOOL_REGISTRY, skillLoader,
// semanticMemory, and entityGraph.
//
// All source-text checks — no LLM calls, no I/O beyond fs.read.
// ============================================================

import fs   from 'fs'
import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()
const SERVER_SRC = fs.readFileSync(path.join(CWD, 'api', 'server.ts'), 'utf-8')

// ─────────────────────────────────────────────────────────────────────────────
// Group O — Regression: C19 self-knowledge honesty
// ─────────────────────────────────────────────────────────────────────────────

export async function groupO(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[O] Regression — C19 self-knowledge honesty${C.reset}`)
  const results = []

  // ── O-01: no hardcoded "31 specialist agents" in api/server.ts ────────────
  results.push(await runTest('O-01', 'O',
    'no hardcoded "31 specialist agents" in api/server.ts', () => {
      if (SERVER_SRC.includes('31 specialist agents'))
        return 'found hardcoded "31 specialist agents" — should be removed'
    }
  ))

  // ── O-02: no hardcoded "714-node entity graph" ────────────────────────────
  results.push(await runTest('O-02', 'O',
    'no hardcoded "714-node entity graph" in api/server.ts', () => {
      if (SERVER_SRC.includes('714-node entity graph'))
        return 'found hardcoded "714-node entity graph" — should use entityGraph.getStats().nodes'
    }
  ))

  // ── O-03: no hardcoded "500+ memories" ────────────────────────────────────
  results.push(await runTest('O-03', 'O',
    'no hardcoded "500+ memories" in api/server.ts', () => {
      if (SERVER_SRC.includes('500+ memories'))
        return 'found hardcoded "500+ memories" — should use semanticMemory.getStats().total'
    }
  ))

  // ── O-04: no hardcoded "6-layer memory system" ────────────────────────────
  results.push(await runTest('O-04', 'O',
    'no hardcoded "6-layer memory system" in api/server.ts', () => {
      if (SERVER_SRC.includes('6-layer memory system'))
        return 'found hardcoded "6-layer memory system" — marketing term should be removed'
    }
  ))

  // ── O-05: no hardcoded "48 tools" ────────────────────────────────────────
  results.push(await runTest('O-05', 'O',
    'no hardcoded "48 tools" in api/server.ts', () => {
      if (SERVER_SRC.includes('48 tools'))
        return 'found hardcoded "48 tools" — should use Object.keys(TOOL_REGISTRY).length'
    }
  ))

  // ── O-06: fast-path uses Object.keys(TOOL_REGISTRY).length ───────────────
  results.push(await runTest('O-06', 'O',
    'fast-path response uses dynamic TOOL_REGISTRY count', () => {
      if (!SERVER_SRC.includes('Object.keys(TOOL_REGISTRY).length'))
        return 'Object.keys(TOOL_REGISTRY).length not found — fast-path should use dynamic tool count'
    }
  ))

  // ── O-07: fast-path uses skillLoader.loadAll().length ────────────────────
  results.push(await runTest('O-07', 'O',
    'fast-path response uses dynamic skillLoader count', () => {
      if (!SERVER_SRC.includes('skillLoader.loadAll().length'))
        return 'skillLoader.loadAll().length not found — fast-path should use dynamic skill count'
    }
  ))

  // ── O-08: IDENTITY block uses semanticMemory.getStats() ──────────────────
  results.push(await runTest('O-08', 'O',
    'system prompt IDENTITY block uses semanticMemory.getStats()', () => {
      if (!SERVER_SRC.includes('semanticMemory.getStats().total'))
        return 'semanticMemory.getStats().total not found in IDENTITY block'
    }
  ))

  // ── O-09: IDENTITY block uses entityGraph.getStats() ─────────────────────
  results.push(await runTest('O-09', 'O',
    'system prompt IDENTITY block uses entityGraph.getStats()', () => {
      if (!SERVER_SRC.includes('entityGraph.getStats().nodes'))
        return 'entityGraph.getStats().nodes not found in IDENTITY block'
    }
  ))

  return summarize('O', 'C19 self-knowledge honesty', results)
}
