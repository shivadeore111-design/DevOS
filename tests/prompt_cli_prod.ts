// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_cli_prod.ts — 15 zero-cost audits for the
// feat(install): bundle CLI + --cli via Electron's bundled Node.
// No LLM. No network. No side effects.
// Run via:  npm run test:audit

import path from 'path'
import fs   from 'fs'
import { test, assert, assertIncludes, assertExcludes, runAll, appendAuditLog } from './harness'

const ROOT = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

// ── Test 1 — package.json has build:cli script ────────────────────────────────
test('cli-prod: package.json has build:cli script', () => {
  const src = read('package.json')
  assertIncludes(src, '"build:cli"', 'package.json must define a build:cli script')
})

// ── Test 2 — build:cli targets cli/aiden.ts ───────────────────────────────────
test('cli-prod: build:cli entry point is cli/aiden.ts', () => {
  const pkg = JSON.parse(read('package.json'))
  const script: string = pkg.scripts['build:cli'] ?? ''
  assert(script.includes('cli/aiden.ts'), `build:cli must target cli/aiden.ts (got: "${script}")`)
})

// ── Test 3 — build:cli outputs to dist-bundle/cli.js ─────────────────────────
test('cli-prod: build:cli outputs to dist-bundle/cli.js', () => {
  const pkg = JSON.parse(read('package.json'))
  const script: string = pkg.scripts['build:cli'] ?? ''
  assert(
    script.includes('dist-bundle/cli.js'),
    `build:cli must output to dist-bundle/cli.js (got: "${script}")`,
  )
})

// ── Test 4 — build:cli marks electron as external ────────────────────────────
test('cli-prod: build:cli marks electron as external dependency', () => {
  const pkg = JSON.parse(read('package.json'))
  const script: string = pkg.scripts['build:cli'] ?? ''
  assert(
    script.includes('--external:electron'),
    `build:cli must pass --external:electron to esbuild (got: "${script}")`,
  )
})

// ── Test 5 — main build script runs build:cli ─────────────────────────────────
test('cli-prod: main build script invokes build:cli', () => {
  const pkg = JSON.parse(read('package.json'))
  const buildScript: string = pkg.scripts['build'] ?? ''
  assert(
    buildScript.includes('build:cli'),
    `main build script must include build:cli step (got: "${buildScript}")`,
  )
})

// ── Test 6 — electron-builder includes dist-bundle in extraResources ─────────
test('cli-prod: electron-builder ships dist-bundle via extraResources', () => {
  const pkg = JSON.parse(read('package.json'))
  const extras: any[] = pkg.build?.extraResources ?? []
  const hasDist = extras.some((e: any) => e.from === 'dist-bundle')
  assert(hasDist, 'electron-builder extraResources must include { from: "dist-bundle" }')
})

// ── Test 7 — bin/aiden.cmd handles tui subcommand ────────────────────────────
test('cli-prod: bin/aiden.cmd handles "tui" subcommand', () => {
  const src = read('bin/aiden.cmd')
  assertIncludes(src, '"tui"', 'bin/aiden.cmd must handle the "tui" subcommand')
})

// ── Test 8 — bin/aiden.cmd handles pc subcommand ─────────────────────────────
test('cli-prod: bin/aiden.cmd handles "pc" subcommand', () => {
  const src = read('bin/aiden.cmd')
  assertIncludes(src, '"pc"', 'bin/aiden.cmd must handle the "pc" subcommand')
})

// ── Test 9 — bin/aiden.cmd uses Aiden.exe --cli, NOT node ────────────────────
test('cli-prod: bin/aiden.cmd uses Aiden.exe --cli (not node) for tui', () => {
  const src = read('bin/aiden.cmd')
  assertIncludes(
    src,
    'Aiden.exe" --cli',
    'bin/aiden.cmd must invoke Aiden.exe --cli for tui (not system node)',
  )
  // Must NOT invoke node for the tui path
  assertExcludes(
    src,
    'node --enable-source-maps',
    'bin/aiden.cmd must NOT use "node --enable-source-maps" — system Node is no longer required',
  )
})

// ── Test 10 — bin/aiden (bash) handles tui and pc ────────────────────────────
test('cli-prod: bin/aiden (bash) handles tui and pc subcommands', () => {
  const src = read('bin/aiden')
  assertIncludes(src, 'tui)',   'bin/aiden must have a tui) case')
  assertIncludes(src, 'pc)',    'bin/aiden must have a pc) case')
  assertIncludes(src, '--cli',  'bin/aiden tui must pass --cli to Aiden.exe')
  assertExcludes(src, 'node "$CLI_BUNDLE"', 'bin/aiden must NOT use node to run CLI bundle directly')
})

// ── Test 11 — electron main.js detects --cli flag ────────────────────────────
test('cli-prod: electron/main.js detects --cli flag via process.argv', () => {
  const src = read('electron/main.js')
  assertIncludes(
    src,
    "process.argv.includes('--cli')",
    'electron/main.js must check process.argv for --cli flag',
  )
  assertIncludes(
    src,
    'isCliMode',
    'electron/main.js must store CLI mode in an isCliMode variable',
  )
})

// ── Test 12 — --cli mode sets ELECTRON_RUN_AS_NODE on child ──────────────────
test('cli-prod: --cli mode sets ELECTRON_RUN_AS_NODE=1 on spawned child', () => {
  const src = read('electron/main.js')
  assertIncludes(
    src,
    'ELECTRON_RUN_AS_NODE',
    'electron/main.js --cli mode must set ELECTRON_RUN_AS_NODE on the child process env',
  )
})

// ── Test 13 — --cli mode does NOT create a BrowserWindow ─────────────────────
test('cli-prod: --cli mode path does not call createMainWindow()', () => {
  const src = read('electron/main.js')
  // Use the unique comment that marks the GUI-only else branch as the boundary
  const isCliIdx  = src.indexOf('if (isCliMode)')
  const guiMarker = src.indexOf('// ── GUI mode')
  assert(isCliIdx  !== -1, 'isCliMode block must exist in main.js')
  assert(guiMarker !== -1, '"// ── GUI mode" comment must exist to mark GUI branch')
  assert(isCliIdx  < guiMarker, 'isCliMode block must appear before the GUI mode branch')
  // Extract just the CLI block (between isCliMode and the GUI marker)
  const cliBlock = src.substring(isCliIdx, guiMarker)
  assertExcludes(
    cliBlock,
    'createMainWindow',
    '--cli mode must NOT call createMainWindow() — no window in CLI mode',
  )
})

// ── Test 14 — --cli mode requires API bundle before spawning CLI ──────────────
test('cli-prod: --cli mode starts API server before spawning CLI child', () => {
  const src = read('electron/main.js')
  const isCliIdx  = src.indexOf('if (isCliMode)')
  const guiMarker = src.indexOf('// ── GUI mode')
  const cliBlock  = src.substring(isCliIdx, guiMarker)
  // API bundle require must appear before spawn in the CLI block
  const requireIdx = cliBlock.indexOf('require(API_BUNDLE)')
  const spawnIdx   = cliBlock.indexOf('spawn(process.execPath')
  assert(requireIdx !== -1, '--cli block must require(API_BUNDLE) to start API in-process')
  assert(spawnIdx   !== -1, '--cli block must spawn the CLI child process')
  assert(requireIdx < spawnIdx, 'API bundle require must appear before CLI spawn')
})

// ── Test 15 — --cli mode hides macOS dock icon ────────────────────────────────
test('cli-prod: --cli mode hides macOS dock icon', () => {
  const src = read('electron/main.js')
  assertIncludes(
    src,
    "app.dock.hide()",
    '--cli mode must call app.dock.hide() to suppress macOS dock icon',
  )
  // The dock.hide() call must be inside the isCliMode block, not the GUI block
  const isCliIdx  = src.indexOf('if (isCliMode)')
  const guiMarker = src.indexOf('// ── GUI mode')
  const cliBlock  = src.substring(isCliIdx, guiMarker)
  assertIncludes(
    cliBlock,
    'app.dock.hide()',
    'app.dock.hide() must be inside the isCliMode block, not the GUI block',
  )
})

// ── Runner ────────────────────────────────────────────────────────────────────

runAll().then(results => {
  const logPath = path.join(ROOT, 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  if (failed > 0) process.exit(1)
})
