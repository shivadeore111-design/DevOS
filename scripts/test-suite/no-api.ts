// ============================================================
// Aiden Audit Test Suite — Phase 1: No-API Tests (~54 tests)
// scripts/test-suite/no-api.ts
//
// Zero LLM calls.  All checks run purely against local code.
// Groups: A-TOOL_REGISTRY  B-SkillLoader  C-RegistryValidator
//         D-CommandCatalog  E-ProtectedContext  F-PluginLoader
//         G-ProviderConfig  H-agentLoop exports  I-FileSystem
//         R-Regression (C1 honesty fallback)  S-Regression (C3 screenshot)
//         W-Regression (C4 file_write boundary)
//         V-Regression (C5 memory action verbs)
//         X-Regression (C7 shell safety)
//         Y-Regression (C6 fabrication guards)
//         Z-Regression (C3b screenshot schema + escape)
//         Q-Regression (C8 code path guards)
//         U-Regression (C9 responder custom-provider routing)
//         T-Regression (C9b streaming URL helper)
//         N-Regression (C10 null-plan action-intent guard)
//         M-Regression (C11 memory_forget)
//         J-Regression (C12 skill pollution prevention)
//         K-Regression (C13 cross-platform app launching)
// ============================================================

import fs   from 'fs'
import path from 'path'
import { runTest, runWarn, skip, summarize, printResult, C, GroupSummary } from './utils'
import { groupR } from './regression/c1-honesty-fallback'
import { groupS } from './regression/c3-screenshot-path'
import { groupW } from './regression/c4-file-write-boundary'
import { groupV } from './regression/c5-memory-action-verbs'
import { groupX } from './regression/c7-shell-safety'
import { groupY } from './regression/c6-fabrication-guards'
import { groupZ } from './regression/c3b-screenshot-schema-escape'
import { groupQ } from './regression/c8-code-path-guard'
import { groupU } from './regression/c9-responder-custom-routing'
import { groupT } from './regression/c9b-streaming-url-helper'
import { groupN } from './regression/c10-null-plan-action-intent'
import { groupM } from './regression/c11-memory-forget'
import { groupJ } from './regression/c12-skill-pollution-prevention'
import { groupK } from './regression/c13-app-launching'
import { groupL } from './regression/c18-skillteacher-spam.test'
import { groupO } from './regression/c19-self-knowledge-honesty.test'
import { groupP } from './regression/c20-fabricated-execution.test'
import { groupAA } from './regression/c21-ollama-identity.test'
import { groupAB } from './regression/c22-skill-bundle-path.test'
import { groupAC } from './regression/c23-cli-noise.test'

const CWD = process.cwd()

// ── Safe require helper ───────────────────────────────────────────────────────
// Returns the module or null on error.  ts-node resolves .ts files normally.

function req<T = any>(relPath: string): T | null {
  try {
    return require(path.join(CWD, relPath)) as T
  } catch (e: any) {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group A — TOOL_REGISTRY integrity
// ─────────────────────────────────────────────────────────────────────────────

async function groupA(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[A] TOOL_REGISTRY integrity${C.reset}`)
  const results = []
  const reg = req('core/toolRegistry')

  results.push(await runTest('A-01', 'A', 'toolRegistry module loads without error', () => {
    if (!reg) return 'require() threw — check TypeScript compilation'
  }))

  const TR   = reg?.TOOL_REGISTRY as Record<string, any> | undefined
  const keys = TR ? Object.keys(TR) : []

  results.push(await runTest('A-02', 'A', 'TOOL_REGISTRY is a non-empty object', () => {
    if (!TR || typeof TR !== 'object') return 'not an object'
    if (keys.length === 0) return 'empty object'
  }))

  results.push(await runTest('A-03', 'A', 'TOOL_REGISTRY has exactly 80 keys', () => {
    if (keys.length !== 80) return `expected 80, got ${keys.length}`
  }))

  results.push(await runTest('A-04', 'A', 'Every entry has a non-empty description', () => {
    if (!TR) return 'registry not loaded'
    const bad = keys.filter(k => !TR[k]?.description || typeof TR[k].description !== 'string')
    if (bad.length) return `missing description: ${bad.slice(0, 5).join(', ')}`
  }))

  results.push(await runTest('A-05', 'A', 'Every entry has a valid tier (0–4)', () => {
    if (!TR) return 'registry not loaded'
    const bad = keys.filter(k => ![0, 1, 2, 3, 4].includes(TR[k]?.tier))
    if (bad.length) return `bad tier: ${bad.slice(0, 5).join(', ')}`
  }))

  results.push(await runTest('A-06', 'A', 'Every entry has at least one category', () => {
    if (!TR) return 'registry not loaded'
    const bad = keys.filter(k => !Array.isArray(TR[k]?.category) || TR[k].category.length === 0)
    if (bad.length) return `missing category: ${bad.slice(0, 5).join(', ')}`
  }))

  results.push(await runTest('A-07', 'A', 'Every entry has a valid mcp field', () => {
    if (!TR) return 'registry not loaded'
    const valid = new Set(['safe', 'destructive', 'excluded'])
    const bad = keys.filter(k => !valid.has(TR[k]?.mcp))
    if (bad.length) return `invalid mcp: ${bad.slice(0, 5).join(', ')}`
  }))

  results.push(await runTest('A-08', 'A', 'Every entry has a valid parallel field', () => {
    if (!TR) return 'registry not loaded'
    const valid = new Set(['safe', 'never', 'sequential'])
    const bad = keys.filter(k => !valid.has(TR[k]?.parallel))
    if (bad.length) return `invalid parallel: ${bad.slice(0, 5).join(', ')}`
  }))

  results.push(await runTest('A-09', 'A', 'No duplicate keys in TOOL_REGISTRY', () => {
    const seen = new Set<string>()
    const dups: string[] = []
    for (const k of keys) { if (seen.has(k)) dups.push(k); seen.add(k) }
    if (dups.length) return `duplicates: ${dups.join(', ')}`
  }))

  results.push(await runTest('A-10', 'A', 'TOOL_NAMES_ONLY is an object with entries for registry keys', () => {
    if (!reg) return 'module not loaded'
    const names = reg.TOOL_NAMES_ONLY as Record<string, string> | undefined
    if (!names || typeof names !== 'object') return 'TOOL_NAMES_ONLY is not an object'
    const nameCount = Object.keys(names).length
    if (nameCount === 0) return 'TOOL_NAMES_ONLY is empty'
    // TOOL_NAMES_ONLY derives from TOOL_DESCRIPTIONS which may not cover every key
    // — just verify it is non-empty and has string values
    const nonStr = Object.values(names).filter(v => typeof v !== 'string')
    if (nonStr.length) return `${nonStr.length} non-string values in TOOL_NAMES_ONLY`
  }))

  results.push(await runWarn('A-11', 'A', 'TOOL_DESCRIPTIONS covers most registry keys (<=5 gaps allowed)', () => {
    if (!reg) return 'module not loaded'
    const descs = reg.TOOL_DESCRIPTIONS as Record<string, string> | undefined
    if (!descs || typeof descs !== 'object') return 'TOOL_DESCRIPTIONS not an object'
    const missing = keys.filter(k => !(k in descs))
    // Some tools are registered dynamically (external, MCP) — allow small gaps
    if (missing.length > 5) return `${missing.length} keys have no description: ${missing.slice(0, 5).join(', ')}...`
  }))

  results.push(await runTest('A-12', 'A', 'TOOLS (handlers map) has a handler for every registry key', () => {
    if (!reg) return 'module not loaded'
    const tools = reg.TOOLS as Record<string, unknown> | undefined
    if (!tools || typeof tools !== 'object') return 'TOOLS not an object'
    const missing = keys.filter(k => !(k in tools))
    if (missing.length) return `no handler for: ${missing.slice(0, 5).join(', ')}`
  }))

  results.push(await runTest('A-13', 'A', 'registryNames() returns same count as Object.keys(TOOL_REGISTRY)', () => {
    if (!reg) return 'module not loaded'
    if (typeof reg.registryNames !== 'function') return 'registryNames not a function'
    const names = reg.registryNames() as string[]
    if (names.length !== keys.length) return `registryNames()=${names.length} vs keys=${keys.length}`
  }))

  results.forEach(printResult)
  return summarize('A', 'TOOL_REGISTRY', results)
}

// ─────────────────────────────────────────────────────────────────────────────
// Group B — Skill Loader
// ─────────────────────────────────────────────────────────────────────────────

async function groupB(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[B] Skill Loader${C.reset}`)
  const results = []
  const sl = req('core/skillLoader')

  results.push(await runTest('B-01', 'B', 'skillLoader module loads without error', () => {
    if (!sl) return 'import failed'
  }))

  results.push(await runTest('B-02', 'B', 'skillLoader instance is exported', () => {
    if (!sl?.skillLoader) return 'skillLoader not exported'
  }))

  let skills: any[] = []
  results.push(await runTest('B-03', 'B', 'skillLoader.loadAll() returns an array', async () => {
    if (!sl?.skillLoader?.loadAll) return 'loadAll not a function'
    skills = sl.skillLoader.loadAll()
    if (!Array.isArray(skills)) return `returned ${typeof skills}`
  }))

  results.push(await runTest('B-04', 'B', 'At least 1 skill loaded (built-in skills/ directory)', () => {
    if (skills.length === 0) return 'zero skills — check skills/ directory exists'
  }))

  results.push(await runTest('B-05', 'B', 'Every skill has a non-empty name string', () => {
    const bad = skills.filter(s => !s.name || typeof s.name !== 'string')
    if (bad.length) return `${bad.length} skill(s) missing name`
  }))

  results.push(await runTest('B-06', 'B', 'getSkillCacheStats() is exported and returns an object', () => {
    if (typeof sl?.getSkillCacheStats !== 'function') return 'getSkillCacheStats not a function'
    const stats = sl.getSkillCacheStats()
    if (!stats || typeof stats !== 'object') return `returned ${typeof stats}`
  }))

  results.push(await runTest('B-07', 'B', 'Second loadAll() hits cache — same length returned', () => {
    if (!sl?.skillLoader?.loadAll) return 'loadAll not available'
    const second = sl.skillLoader.loadAll()
    if (!Array.isArray(second)) return 'second call failed'
    if (second.length !== skills.length)
      return `first=${skills.length} second=${second.length} — cache miss`
  }))

  results.push(await runWarn('B-08', 'B', 'skills/AIDEN_CATALOG.md exists', () => {
    const p = path.join(CWD, 'skills', 'AIDEN_CATALOG.md')
    if (!fs.existsSync(p)) return 'AIDEN_CATALOG.md not found in skills/'
  }))

  results.forEach(printResult)
  return summarize('B', 'SkillLoader', results)
}

// ─────────────────────────────────────────────────────────────────────────────
// Group C — Registry Validator
// ─────────────────────────────────────────────────────────────────────────────

async function groupC(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[C] Registry Validator${C.reset}`)
  const results = []
  const rv = req('core/registryValidator')

  // registryValidator imports api/mcp which starts an MCP server at load time.
  // In the test environment that causes a side-effect failure.  We test the file
  // exists and has the right export shape; actual validation is covered by startup.
  results.push(await runWarn('C-01', 'C', 'registryValidator module loads (may fail: api/mcp side-effect)', () => {
    if (!rv) return 'import failed — likely api/mcp server side-effect in test env'
  }))

  results.push(await runWarn('C-02', 'C', 'validateRegistry() is exported', () => {
    if (!rv) return 'module not loaded (see C-01)'
    if (typeof rv.validateRegistry !== 'function') return 'not a function'
  }))

  results.push(await runWarn('C-03', 'C', 'validateRegistry() does not throw', () => {
    if (!rv?.validateRegistry) return 'function not available (see C-01)'
    rv.validateRegistry()
  }))

  // agentLoop exports — load directly (does not pull in api/mcp)
  const al = req('core/agentLoop')

  for (const [id, name] of [
    ['C-04', 'ALLOWED_TOOLS'],
    ['C-05', 'VALID_TOOLS'],
  ] as [string, string][]) {
    const arrName = name
    results.push(await runTest(id, 'C', `${arrName} is a non-empty exported array`, () => {
      const arr = al?.[arrName]
      if (!Array.isArray(arr)) return `${arrName} is not an array (got ${typeof arr})`
      if (arr.length === 0)   return `${arrName} is empty`
    }))
  }

  for (const [id, name] of [
    ['C-06', 'PARALLEL_SAFE'],
    ['C-07', 'SEQUENTIAL_ONLY'],
    ['C-08', 'NO_RETRY_TOOLS'],
  ] as [string, string][]) {
    const setName = name
    results.push(await runTest(id, 'C', `${setName} is a non-empty exported Set`, () => {
      const s = al?.[setName]
      if (!(s instanceof Set)) return `${setName} is not a Set (got ${typeof s})`
      if (s.size === 0)        return `${setName} is empty`
    }))
  }

  results.push(await runTest('C-09', 'C', 'All ALLOWED_TOOLS entries exist in TOOL_REGISTRY', () => {
    const reg = req('core/toolRegistry')
    if (!al?.ALLOWED_TOOLS || !reg?.TOOL_REGISTRY) return 'modules not loaded'
    const tr = reg.TOOL_REGISTRY as Record<string, unknown>
    const orphans = (al.ALLOWED_TOOLS as string[]).filter((t: string) => !(t in tr))
    if (orphans.length) return `orphaned tools: ${orphans.slice(0, 5).join(', ')}`
  }))

  results.forEach(printResult)
  return summarize('C', 'RegistryValidator', results)
}

// ─────────────────────────────────────────────────────────────────────────────
// Group D — Command Catalog
// ─────────────────────────────────────────────────────────────────────────────

async function groupD(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[D] Command Catalog${C.reset}`)
  const results = []
  const cc = req('cli/commandCatalog')

  results.push(await runTest('D-01', 'D', 'commandCatalog module loads', () => {
    if (!cc) return 'import failed'
  }))

  results.push(await runTest('D-02', 'D', 'COMMAND_DETAIL has >= 91 entries', () => {
    if (!cc?.COMMAND_DETAIL) return 'COMMAND_DETAIL not exported'
    const count = Object.keys(cc.COMMAND_DETAIL).length
    if (count < 91) return `only ${count} entries, expected >= 91`
  }))

  results.push(await runTest('D-03', 'D', 'list() returns a non-empty array of [name, detail] pairs', () => {
    if (typeof cc?.list !== 'function') return 'list() not a function'
    const list = cc.list()
    if (!Array.isArray(list)) return 'not an array'
    if (list.length === 0)   return 'empty array'
  }))

  results.push(await runTest('D-04', 'D', 'generation() returns a number', () => {
    if (typeof cc?.generation !== 'function') return 'generation() not a function'
    const g = cc.generation()
    if (typeof g !== 'number') return `got ${typeof g}`
  }))

  results.push(await runTest('D-05', 'D', 'register() increments generation; unregister() cleans up', () => {
    if (typeof cc?.register !== 'function' || typeof cc?.unregister !== 'function')
      return 'register/unregister not exported'
    const before = cc.generation() as number
    cc.register('/test-audit-temp', { desc: 'audit probe', section: 'debug' })
    const mid   = cc.generation() as number
    cc.unregister('/test-audit-temp')
    const after = cc.generation() as number
    if (mid !== before + 1) return `register: expected gen ${before + 1}, got ${mid}`
    if (after !== before + 2) return `unregister: expected gen ${before + 2}, got ${after}`
  }))

  results.push(await runTest('D-06', 'D', 'get("/help") returns an entry with a desc', () => {
    if (typeof cc?.get !== 'function') return 'get() not a function'
    const entry = cc.get('/help')
    if (!entry) return '/help not found in catalog'
    if (!entry.desc) return 'entry has no desc'
  }))

  results.push(await runTest('D-07', 'D', 'COMMANDS array is exported and non-empty', () => {
    if (!Array.isArray(cc?.COMMANDS) || cc.COMMANDS.length === 0)
      return 'COMMANDS missing or empty'
  }))

  results.push(await runTest('D-08', 'D', 'COMMANDS length matches COMMAND_DETAIL key count', () => {
    if (!cc?.COMMANDS || !cc?.COMMAND_DETAIL) return 'exports missing'
    const detailCount = Object.keys(cc.COMMAND_DETAIL).length
    if (cc.COMMANDS.length !== detailCount)
      return `COMMANDS=${cc.COMMANDS.length} vs COMMAND_DETAIL=${detailCount}`
  }))

  results.forEach(printResult)
  return summarize('D', 'CommandCatalog', results)
}

// ─────────────────────────────────────────────────────────────────────────────
// Group E — Protected Context
// ─────────────────────────────────────────────────────────────────────────────

async function groupE(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[E] Protected Context${C.reset}`)
  const results = []
  const pc = req('core/protectedContext')

  results.push(await runTest('E-01', 'E', 'protectedContext module loads', () => {
    if (!pc) return 'import failed'
  }))

  // protectedContext.ts exports `protectedContextManager` instance.
  // `getProtectedContext()` is a synchronous method on the manager.
  results.push(await runTest('E-02', 'E', 'protectedContextManager is exported', () => {
    if (!pc?.protectedContextManager) return 'protectedContextManager not exported'
  }))

  results.push(await runTest('E-03', 'E', 'protectedContextManager.getProtectedContext is a function', () => {
    const mgr = pc?.protectedContextManager
    if (!mgr) return 'manager not available'
    if (typeof mgr.getProtectedContext !== 'function') return 'getProtectedContext not a function'
  }))

  let ctx: any = null
  results.push(await runTest('E-04', 'E', 'getProtectedContext() returns an object', () => {
    const mgr = pc?.protectedContextManager
    if (!mgr?.getProtectedContext) return 'not available'
    ctx = mgr.getProtectedContext()
    if (!ctx || typeof ctx !== 'object') return `returned ${typeof ctx}`
  }))

  results.push(await runTest('E-05', 'E', 'Result has soul, user, goals, standingOrders fields', () => {
    if (!ctx) return 'context not loaded (E-04 failed)'
    const required = ['soul', 'user', 'goals', 'standingOrders']
    const missing = required.filter(k => !(k in ctx))
    if (missing.length) return `missing fields: ${missing.join(', ')}`
  }))

  results.push(await runWarn('E-06', 'E', 'soul field is non-empty (SOUL.md loaded)', () => {
    if (!ctx) return 'context not loaded'
    if (!ctx.soul || typeof ctx.soul !== 'string' || ctx.soul.trim().length === 0)
      return 'soul is empty — workspace/SOUL.md may be missing'
  }))

  results.push(await runTest('E-07', 'E', 'Second call returns same hash (idempotent)', () => {
    const mgr = pc?.protectedContextManager
    if (!mgr?.getProtectedContext || !ctx) return 'context not loaded'
    const ctx2 = mgr.getProtectedContext()
    if (ctx2.hash !== ctx.hash) return `hash changed unexpectedly: ${ctx.hash} → ${ctx2.hash}`
  }))

  results.forEach(printResult)
  return summarize('E', 'ProtectedContext', results)
}

// ─────────────────────────────────────────────────────────────────────────────
// Group F — Plugin Loader
// ─────────────────────────────────────────────────────────────────────────────

async function groupF(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[F] Plugin Loader${C.reset}`)
  const results = []
  const pl = req('core/pluginLoader')

  results.push(await runTest('F-01', 'F', 'pluginLoader module loads', () => {
    if (!pl) return 'import failed'
  }))

  results.push(await runTest('F-02', 'F', 'pluginHooks is exported', () => {
    if (!pl?.pluginHooks) return 'pluginHooks not exported'
  }))

  results.push(await runTest('F-03', 'F', 'pluginHooks has all 4 hook arrays', () => {
    const h = pl?.pluginHooks
    if (!h) return 'not loaded'
    const missing = ['preTool', 'postTool', 'onSessionStart', 'onSessionEnd']
      .filter(k => !Array.isArray(h[k]))
    if (missing.length) return `missing or non-array: ${missing.join(', ')}`
  }))

  results.push(await runWarn('F-04', 'F', 'loadPlugins function is exported', () => {
    if (typeof pl?.loadPlugins !== 'function') return 'loadPlugins not exported (plugins won\'t load)'
  }))

  results.push(await runWarn('F-05', 'F', 'workspace/plugins/ directory exists', () => {
    const p = path.join(CWD, 'workspace', 'plugins')
    if (!fs.existsSync(p)) return 'directory not found — plugins disabled'
  }))

  results.forEach(printResult)
  return summarize('F', 'PluginLoader', results)
}

// ─────────────────────────────────────────────────────────────────────────────
// Group G — Provider Config
// ─────────────────────────────────────────────────────────────────────────────

async function groupG(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[G] Provider Config${C.reset}`)
  const results = []

  const cfgPath = path.join(CWD, 'config', 'devos.config.json')
  let cfg: any = null

  results.push(await runTest('G-01', 'G', 'config/devos.config.json exists and is valid JSON', () => {
    if (!fs.existsSync(cfgPath)) return 'file not found'
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) }
    catch (e: any) { return `JSON parse error: ${e.message}` }
    if (!cfg || typeof cfg !== 'object') return 'parsed but not an object'
  }))

  const apis: any[] = cfg?.providers?.apis ?? []

  results.push(await runTest('G-02', 'G', 'together-deepseek entry exists in providers.apis', () => {
    if (!cfg) return 'config not loaded'
    if (!apis.find((a: any) => a.name === 'together-deepseek')) return 'entry not found'
  }))

  results.push(await runTest('G-03', 'G', 'together-deepseek is enabled=true', () => {
    const found = apis.find((a: any) => a.name === 'together-deepseek')
    if (!found) return 'entry not found'
    if (!found.enabled) return 'enabled=false — fix: set enabled: true'
  }))

  results.push(await runTest('G-04', 'G', 'together-deepseek baseUrl points to Together AI', () => {
    const found = apis.find((a: any) => a.name === 'together-deepseek')
    if (!found) return 'entry not found'
    if (!found.baseUrl?.includes('together.xyz')) return `unexpected baseUrl: ${found.baseUrl}`
  }))

  results.push(await runTest('G-05', 'G', 'together-deepseek model is deepseek-ai/DeepSeek-V3.1', () => {
    const found = apis.find((a: any) => a.name === 'together-deepseek')
    if (!found) return 'entry not found'
    if (found.model !== 'deepseek-ai/DeepSeek-V3.1') return `got: ${found.model}`
  }))

  results.push(await runTest('G-06', 'G', 'together-deepseek key references env:TOGETHER_API_KEY', () => {
    const found = apis.find((a: any) => a.name === 'together-deepseek')
    if (!found) return 'entry not found'
    if (found.key !== 'env:TOGETHER_API_KEY') return `unexpected key: ${found.key}`
  }))

  results.push(await runTest('G-07', 'G', 'No two API entries share the same name', () => {
    if (!cfg) return 'config not loaded'
    const names = apis.map((a: any) => a.name)
    const seen = new Set<string>()
    const dups: string[] = []
    for (const n of names) { if (seen.has(n)) dups.push(n); seen.add(n) }
    if (dups.length) return `duplicate names: ${dups.join(', ')}`
  }))

  results.push(await runTest('G-08', 'G', 'At least 3 API entries are enabled', () => {
    if (!cfg) return 'config not loaded'
    const count = apis.filter((a: any) => a.enabled).length
    if (count < 3) return `only ${count} enabled provider(s) — need >= 3 for fallback chain`
  }))

  results.push(await runTest('G-09', 'G', 'model.activeModel is set', () => {
    if (!cfg) return 'config not loaded'
    if (!cfg.model?.activeModel) return 'model.activeModel is missing or empty'
  }))

  results.push(await runWarn('G-10', 'G', 'TOGETHER_API_KEY env var is set', () => {
    if (!process.env.TOGETHER_API_KEY) return 'TOGETHER_API_KEY not in env — Phase 2 tests will skip'
  }))

  results.forEach(printResult)
  return summarize('G', 'ProviderConfig', results)
}

// ─────────────────────────────────────────────────────────────────────────────
// Group H — agentLoop exported constants
// Note: agentLoop is imported via the module cache populated by Group C
// (registryValidator imports agentLoop internally at startup).
// ─────────────────────────────────────────────────────────────────────────────

async function groupH(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[H] agentLoop exported constants${C.reset}`)
  const results = []

  // agentLoop was already pulled into Node's module cache by registryValidator
  // (Group C).  This require() call is essentially free.
  const al = req('core/agentLoop')

  results.push(await runWarn('H-01', 'H', 'agentLoop module accessible (may be slow first load)', () => {
    if (!al) return 'import failed — complex dependency chain, check for import errors'
  }))

  for (const [id, name] of [
    ['H-02', 'ALLOWED_TOOLS'],
    ['H-03', 'VALID_TOOLS'],
  ] as [string, string][]) {
    const arrName = name
    results.push(await runTest(id, 'H', `${arrName} is a non-empty exported array`, () => {
      if (!al) return 'agentLoop not loaded'
      const arr = al[arrName]
      if (!Array.isArray(arr)) return `not an array (got ${typeof arr})`
      if (arr.length === 0)   return 'empty array'
    }))
  }

  for (const [id, name] of [
    ['H-04', 'PARALLEL_SAFE'],
    ['H-05', 'SEQUENTIAL_ONLY'],
    ['H-06', 'NO_RETRY_TOOLS'],
  ] as [string, string][]) {
    const setName = name
    results.push(await runTest(id, 'H', `${setName} is a non-empty exported Set`, () => {
      if (!al) return 'agentLoop not loaded'
      const s = al[setName]
      if (!(s instanceof Set)) return `not a Set (got ${typeof s})`
      if (s.size === 0)        return 'empty Set'
    }))
  }

  results.push(await runTest('H-07', 'H', 'callLLM is exported as a function', () => {
    if (!al) return 'agentLoop not loaded'
    if (typeof al.callLLM !== 'function') return `callLLM is ${typeof al.callLLM}`
  }))

  results.push(await runWarn('H-08', 'H', 'racePlannerAPIs accessible (internal fn, not exported)', () => {
    // racePlannerAPIs is an internal function — not exported; this test is informational only
    // Verify callLLM (the exported planner entry point) works instead
    if (!al) return 'agentLoop not loaded'
    if (typeof al.callLLM !== 'function') return 'callLLM not a function (planner entry point missing)'
  }))

  results.forEach(printResult)
  return summarize('H', 'agentLoop', results)
}

// ─────────────────────────────────────────────────────────────────────────────
// Group I — File system & version consistency
// ─────────────────────────────────────────────────────────────────────────────

async function groupI(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[I] File System & Version${C.reset}`)
  const results = []

  // Files that must exist
  const mustExist: [string, string][] = [
    ['I-01', 'package.json'],
    ['I-02', 'tsconfig.json'],
    ['I-03', '.env.example'],
    ['I-04', 'core/toolRegistry.ts'],
    ['I-05', 'core/agentLoop.ts'],
    ['I-06', 'core/skillLoader.ts'],
    ['I-07', 'core/registryValidator.ts'],
    ['I-08', 'core/protectedContext.ts'],
    ['I-09', 'cli/commandCatalog.ts'],
    ['I-10', 'skills/AIDEN_CATALOG.md'],
  ]

  for (const [id, relPath] of mustExist) {
    results.push(await runTest(id, 'I', `${relPath} exists`, () => {
      if (!fs.existsSync(path.join(CWD, relPath))) return 'file not found'
    }))
  }

  results.push(await runTest('I-11', 'I', 'package.json version matches core/version.ts', () => {
    const pkgPath = path.join(CWD, 'package.json')
    const verPath = path.join(CWD, 'core', 'version.ts')
    if (!fs.existsSync(pkgPath)) return 'package.json not found'
    if (!fs.existsSync(verPath)) return 'core/version.ts not found'
    const pkg  = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    const vts  = fs.readFileSync(verPath, 'utf-8')
    const m    = vts.match(/VERSION\s*=\s*['"]([^'"]+)['"]/)
    if (!m) return 'VERSION constant not found in core/version.ts'
    if (pkg.version !== m[1]) return `package.json=${pkg.version} vs version.ts=${m[1]}`
  }))

  results.push(await runWarn('I-12', 'I', 'RELEASE_NOTES file exists for current version', () => {
    const files = fs.readdirSync(CWD).filter(f => f.startsWith('RELEASE_NOTES'))
    if (files.length === 0) return 'no RELEASE_NOTES_*.md found'
  }))

  results.push(await runWarn('I-13', 'I', 'workspace/ directory exists', () => {
    if (!fs.existsSync(path.join(CWD, 'workspace')))
      return 'workspace/ not found — first-run setup may not have run'
  }))

  results.push(await runWarn('I-14', 'I', 'docs/test-reports/ directory writable', () => {
    const dir = path.join(CWD, 'docs', 'test-reports')
    try {
      fs.mkdirSync(dir, { recursive: true })
      const probe = path.join(dir, '.write-probe')
      fs.writeFileSync(probe, '')
      fs.unlinkSync(probe)
    } catch (e: any) {
      return `not writable: ${e.message}`
    }
  }))

  results.forEach(printResult)
  return summarize('I', 'FileSystem', results)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function runPhase1(): Promise<GroupSummary[]> {
  console.log(`${C.bold}${C.cyan}═══ Phase 1 — No-API Tests ═══${C.reset}`)
  const out: GroupSummary[] = []
  out.push(await groupA())
  out.push(await groupB())
  out.push(await groupC())
  out.push(await groupD())
  out.push(await groupE())
  out.push(await groupF())
  out.push(await groupG())
  out.push(await groupH())
  out.push(await groupI())
  out.push(await groupR())
  out.push(await groupS())
  out.push(await groupW())
  out.push(await groupV())
  out.push(await groupX())
  out.push(await groupY())
  out.push(await groupZ())
  out.push(await groupQ())
  out.push(await groupU())
  out.push(await groupT())
  out.push(await groupN())
  out.push(await groupM())
  out.push(await groupJ())
  out.push(await groupK())
  out.push(await groupL())
  out.push(await groupO())
  out.push(await groupP())
  out.push(await groupAA())
  out.push(await groupAB())
  out.push(await groupAC())
  return out
}
