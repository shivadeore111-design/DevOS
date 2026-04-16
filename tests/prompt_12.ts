// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_12.ts — 8 zero-cost audits for Prompt 12 (▲ run tool).
// Run via:  npm run test:audit
// No network. No LLM. No side effects.

import path from 'path'
import fs   from 'fs'
import { test, assert, assertEquals, assertIncludes, assertExcludes, runAll, appendAuditLog } from './harness'

// ── Helpers ─────────────────────────────────────────────────────────────────

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

// ── Test 1 — aidenSdk exports expected symbols ───────────────────────────────
test('aidenSdk: exports getSdkMethods, getSdkNamespaces, buildSdkSurface, buildSdkRuntime', () => {
  const sdk = require('../core/aidenSdk')
  assert(typeof sdk.getSdkMethods    === 'function', 'getSdkMethods must be a function')
  assert(typeof sdk.getSdkNamespaces === 'function', 'getSdkNamespaces must be a function')
  assert(typeof sdk.buildSdkSurface  === 'function', 'buildSdkSurface must be a function')
  assert(typeof sdk.buildSdkRuntime  === 'function', 'buildSdkRuntime must be a function')
})

// ── Test 2 — getSdkMethods returns expected namespaces ───────────────────────
test('aidenSdk: getSdkMethods() covers all required namespaces', () => {
  const { getSdkMethods } = require('../core/aidenSdk')
  const methods: any[] = getSdkMethods()
  assert(methods.length > 0, 'getSdkMethods() must return at least one method')
  const namespaces = new Set(methods.map((m: any) => m.namespace))
  for (const ns of ['web', 'file', 'shell', 'browser', 'screen', 'memory', 'system', 'git', 'data']) {
    assert(namespaces.has(ns), `Missing namespace: "${ns}"`)
  }
})

// ── Test 3 — getSdkNamespaces returns sorted array ───────────────────────────
test('aidenSdk: getSdkNamespaces() returns sorted array', () => {
  const { getSdkNamespaces } = require('../core/aidenSdk')
  const ns: string[] = getSdkNamespaces()
  assert(Array.isArray(ns), 'getSdkNamespaces() must return an array')
  assert(ns.length > 0, 'getSdkNamespaces() must be non-empty')
  for (let i = 1; i < ns.length; i++) {
    assert(ns[i] >= ns[i - 1], `Namespaces not sorted at index ${i}: "${ns[i - 1]}" > "${ns[i]}"`)
  }
})

// ── Test 4 — buildSdkSurface() produces non-empty string with namespace headers
test('aidenSdk: buildSdkSurface() includes expected namespace headers', () => {
  const { buildSdkSurface } = require('../core/aidenSdk')
  const surface: string = buildSdkSurface()
  assert(typeof surface === 'string', 'buildSdkSurface() must return a string')
  assert(surface.length > 100, 'buildSdkSurface() output is suspiciously short')
  assertIncludes(surface, 'aiden.web',   'Surface must include aiden.web namespace')
  assertIncludes(surface, 'aiden.file',  'Surface must include aiden.file namespace')
  assertIncludes(surface, 'aiden.shell', 'Surface must include aiden.shell namespace')
})

// ── Test 5 — buildSdkRuntime() returns object with correct shape ──────────────
test('aidenSdk: buildSdkRuntime() returns object with all namespace keys', () => {
  const { buildSdkRuntime } = require('../core/aidenSdk')
  const runtime = buildSdkRuntime(() => {})
  assert(typeof runtime === 'object' && runtime !== null, 'buildSdkRuntime must return an object')
  for (const ns of ['web', 'file', 'shell', 'browser', 'screen', 'memory', 'system', 'git', 'data']) {
    assert(ns in runtime, `Runtime missing namespace: "${ns}"`)
    assert(typeof runtime[ns] === 'object', `Runtime.${ns} must be an object`)
  }
  assert(typeof runtime.web.search    === 'function', 'runtime.web.search must be a function')
  assert(typeof runtime.file.read     === 'function', 'runtime.file.read must be a function')
  assert(typeof runtime.shell.exec    === 'function', 'runtime.shell.exec must be a function')
  assert(typeof runtime.runAgent      === 'function', 'runtime.runAgent must be a function')
})

// ── Test 6 — runSandbox exports RunResult shape ───────────────────────────────
test('runSandbox: module exports runInSandbox function', () => {
  const mod = require('../core/runSandbox')
  assert(typeof mod.runInSandbox === 'function', 'runInSandbox must be exported as a function')
})

// ── Test 7 — run tool is registered in toolRegistry ──────────────────────────
test('toolRegistry: run tool is registered + getToolsForCategories includes run', () => {
  const { TOOLS, getToolsForCategories } = require('../core/toolRegistry')
  assert('run' in TOOLS, '"run" must be a key in TOOLS')
  assert(typeof TOOLS['run'] === 'function', 'TOOLS["run"] must be a function')
  const codeTools: string[] = getToolsForCategories(['code'])
  assertIncludes(codeTools.join(','), 'run', '"run" must appear in getToolsForCategories(["code"])')
})

// ── Test 8 — scripts/ directory contains the 5 Prompt-12 example scripts ─────
test('scripts/: 5 Prompt-12 example scripts exist and use the aiden SDK', () => {
  const scriptsDir = path.join(process.cwd(), 'scripts')
  assert(fs.existsSync(scriptsDir), 'scripts/ directory must exist')
  const EXPECTED = [
    'daily_brief.js',
    'research_and_summarize.js',
    'file_organizer.js',
    'repo_changelog.js',
    'port_checker.js',
  ]
  for (const f of EXPECTED) {
    const fp = path.join(scriptsDir, f)
    assert(fs.existsSync(fp), `Missing example script: scripts/${f}`)
    const src = fs.readFileSync(fp, 'utf-8')
    assertIncludes(src, 'aiden.', `Script ${f} must use the aiden SDK (no "aiden." found)`)
  }
})

// ── Run ──────────────────────────────────────────────────────────────────────

;(async () => {
  const results  = await runAll()
  const logPath  = path.join(process.cwd(), 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  process.exit(failed > 0 ? 1 : 0)
})()
