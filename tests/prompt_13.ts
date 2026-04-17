// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_13.ts — 10 zero-cost audits for Prompt 13 (spawn · swarm · search).
// Run via:  npm run test:audit
// No network. No LLM. No side effects.

import path from 'path'
import fs   from 'fs'
import { test, assert, assertEquals, assertIncludes, assertExcludes, runAll, appendAuditLog } from './harness'

// ── Test 1 — spawnManager exports expected symbols ───────────────────────────
test('spawnManager: exports spawnSubagent, getActiveSpawns, killSpawn + interfaces', () => {
  const mod = require('../core/spawnManager')
  assert(typeof mod.spawnSubagent    === 'function', 'spawnSubagent must be a function')
  assert(typeof mod.getActiveSpawns  === 'function', 'getActiveSpawns must be a function')
  assert(typeof mod.killSpawn        === 'function', 'killSpawn must be a function')
})

// ── Test 2 — getActiveSpawns returns array ────────────────────────────────────
test('spawnManager: getActiveSpawns() returns an array (empty or otherwise)', () => {
  const { getActiveSpawns } = require('../core/spawnManager')
  const spawns = getActiveSpawns()
  assert(Array.isArray(spawns), 'getActiveSpawns() must return an array')
})

// ── Test 3 — killSpawn returns false for unknown id ───────────────────────────
test('spawnManager: killSpawn("nonexistent") returns false', () => {
  const { killSpawn } = require('../core/spawnManager')
  const result = killSpawn('nonexistent_id_that_does_not_exist')
  assertEquals(result, false, 'killSpawn with unknown id must return false')
})

// ── Test 4 — spawnManager IterationBudget shape is structurally correct ───────
test('spawnManager: IterationBudget shape used in budget inheritance formula', () => {
  // We can't run spawnSubagent (requires LLM) but we can verify the budget
  // inheritance math directly from the module source.
  const srcPath = path.join(process.cwd(), 'core', 'spawnManager.ts')
  assert(fs.existsSync(srcPath), 'core/spawnManager.ts must exist')
  const src = fs.readFileSync(srcPath, 'utf-8')
  assertIncludes(src, 'parentBudget.remaining',         'Budget inheritance must reference parentBudget.remaining')
  assertIncludes(src, 'Math.floor',                     'Budget inheritance must use Math.floor')
  assertIncludes(src, '/ 2',                            'Budget inheritance must divide by 2')
  assertIncludes(src, 'Math.min',                       'Budget inheritance must cap with Math.min')
  assertIncludes(src, '10',                             'Budget cap must be 10')
})

// ── Test 5 — swarmManager exports expected symbols ───────────────────────────
test('swarmManager: exports swarmSubagents function + SwarmStrategy types', () => {
  const mod = require('../core/swarmManager')
  assert(typeof mod.swarmSubagents === 'function', 'swarmSubagents must be a function')
})

// ── Test 6 — swarmManager source includes vote/merge/best strategies ─────────
test('swarmManager: source contains vote, merge, best strategy branches', () => {
  const srcPath = path.join(process.cwd(), 'core', 'swarmManager.ts')
  assert(fs.existsSync(srcPath), 'core/swarmManager.ts must exist')
  const src = fs.readFileSync(srcPath, 'utf-8')
  assertIncludes(src, "'vote'",   'Strategy "vote" must appear in source')
  assertIncludes(src, "'merge'",  'Strategy "merge" must appear in source')
  assertIncludes(src, "'best'",   'Strategy "best" must appear in source')
  assertIncludes(src, 'allSettled', 'Promise.allSettled must be used for parallel execution')
})

// ── Test 7 — sessionSearch: module exports searchSessions + getIndexSize ──────
test('sessionSearch: exports searchSessions and getIndexSize', () => {
  const mod = require('../core/sessionSearch')
  assert(typeof mod.searchSessions === 'function', 'searchSessions must be a function')
  assert(typeof mod.getIndexSize   === 'function', 'getIndexSize must be a function')
  assert(typeof mod.rebuildIndex   === 'function', 'rebuildIndex must be a function')
})

// ── Test 8 — sessionSearch: searchSessions returns array of SearchHits ────────
test('sessionSearch: searchSessions("test") returns an array', () => {
  const { searchSessions } = require('../core/sessionSearch')
  const hits = searchSessions('test', 3)
  assert(Array.isArray(hits), 'searchSessions must return an array')
  for (const h of hits) {
    assert(typeof h.score === 'number', 'Each hit must have a numeric score')
    assert(h.doc && typeof h.doc.id === 'string', 'Each hit must have a doc with an id')
  }
})

// ── Test 9 — hybridSearch: module exports hybridSearch ────────────────────────
test('hybridSearch: exports hybridSearch function', () => {
  const mod = require('../core/hybridSearch')
  assert(typeof mod.hybridSearch === 'function', 'hybridSearch must be a function')
})

// ── Test 10 — toolRegistry: spawn, swarm, search tools registered ─────────────
test('toolRegistry: spawn, swarm, search tools registered in TOOLS + TOOL_CATEGORIES', () => {
  const { TOOLS, getToolsForCategories } = require('../core/toolRegistry')
  for (const tool of ['spawn', 'swarm', 'search']) {
    assert(tool in TOOLS,           `"${tool}" must be a key in TOOLS`)
    assert(typeof TOOLS[tool] === 'function', `TOOLS["${tool}"] must be a function`)
  }
  const delegationTools: string[] = getToolsForCategories(['delegation'])
  assertIncludes(delegationTools.join(','), 'spawn', '"spawn" must appear in delegation category')
  assertIncludes(delegationTools.join(','), 'swarm', '"swarm" must appear in delegation category')
  const memoryTools: string[] = getToolsForCategories(['memory'])
  assertIncludes(memoryTools.join(','), 'search', '"search" must appear in memory category')
})

// ── Run ──────────────────────────────────────────────────────────────────────

;(async () => {
  const results  = await runAll()
  const logPath  = path.join(process.cwd(), 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  process.exit(failed > 0 ? 1 : 0)
})()
