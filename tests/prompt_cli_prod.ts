// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_cli_prod.ts — 37 zero-cost audits for the
// feat(install): bundle CLI + --cli via Electron's bundled Node.
// fix(install): aiden tui spawns v3.6 CLI, API bundle points at real server entry
// chore(scripts): remove legacy/ references, fix dev script
// fix(startup): ollama optional, CLI waits for API ready, better errors
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

// ── Test 14 — --cli mode spawns API bundle (isolated, not require) ───────────
test('cli-prod: --cli mode spawns API server as isolated child process', () => {
  const src = read('electron/main.js')
  const isCliIdx  = src.indexOf('if (isCliMode)')
  const guiMarker = src.indexOf('// ── GUI mode')
  const cliBlock  = src.substring(isCliIdx, guiMarker)
  // API must be spawned via spawn(process.execPath, [API_BUNDLE]) — NOT require()
  assertIncludes(
    cliBlock,
    'spawn(process.execPath, [API_BUNDLE]',
    '--cli block must spawn API bundle as child process (not require it in-process)',
  )
  assertExcludes(
    cliBlock,
    'require(API_BUNDLE)',
    '--cli block must NOT use require(API_BUNDLE) — process isolation is required',
  )
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

// ── Test 16 — build:api script exists and points at api/entry.ts ─────────────
test('cli-prod: build:api script exists and targets api/entry.ts', () => {
  const pkg = JSON.parse(read('package.json'))
  const script: string = pkg.scripts['build:api'] ?? ''
  assert(script.length > 0, 'package.json must define a build:api script')
  assert(
    script.includes('api/entry.ts'),
    `build:api must target api/entry.ts (not root index.ts) — got: "${script}"`,
  )
  assertExcludes(
    script,
    'index.ts',
    'build:api must NOT target root index.ts — that is the legacy v1.0 CLI entry',
  )
})

// ── Test 17 — dist-bundle/index.js contains API server markers ───────────────
test('cli-prod: dist-bundle/index.js contains API server code', () => {
  const bundle = read('dist-bundle/index.js')
  const hasApiMarker =
    bundle.includes('app.listen') ||
    bundle.includes('/api/chat') ||
    bundle.includes('startApiServer')
  assert(
    hasApiMarker,
    'dist-bundle/index.js must contain API server markers (app.listen, /api/chat, or startApiServer)',
  )
})

// ── Test 18 — dist-bundle/index.js does NOT contain DevOS v1.0 banner ────────
test('cli-prod: dist-bundle/index.js must not contain legacy v1.0 CLI banner', () => {
  const bundle = read('dist-bundle/index.js')
  assertExcludes(
    bundle,
    'DevOS v1',
    'dist-bundle/index.js must NOT contain "DevOS v1" — regression guard against bundling legacy index.ts',
  )
  assertExcludes(
    bundle,
    'DevOS v1.0',
    'dist-bundle/index.js must NOT contain legacy v1.0 banner text',
  )
})

// ── Test 19 — electron/main.js --cli API spawn uses ELECTRON_RUN_AS_NODE ─────
test('cli-prod: API spawn in --cli mode passes ELECTRON_RUN_AS_NODE=1', () => {
  const src       = read('electron/main.js')
  const isCliIdx  = src.indexOf('if (isCliMode)')
  const guiMarker = src.indexOf('// ── GUI mode')
  const cliBlock  = src.substring(isCliIdx, guiMarker)
  assertIncludes(
    cliBlock,
    'ELECTRON_RUN_AS_NODE',
    '--cli API spawn must set ELECTRON_RUN_AS_NODE in the child env so Electron runs as plain Node',
  )
})

// ── Test 20 — legacy index.ts is NOT at root (moved to legacy/) ───────────────
test('cli-prod: root index.ts has been moved to legacy/ (not present at repo root)', () => {
  const rootIndex    = path.join(ROOT, 'index.ts')
  const legacyIndex  = path.join(ROOT, 'legacy', 'index.ts')
  assert(
    !fs.existsSync(rootIndex),
    'index.ts must NOT exist at the repo root — it should be in legacy/ or removed',
  )
  assert(
    fs.existsSync(legacyIndex),
    'legacy/index.ts must exist — the v1.0 CLI was moved there, not deleted',
  )
})

// ── Test 21 — package.json "dev" script does NOT contain "legacy/" ───────────
test('cli-prod: package.json dev script does not reference legacy/', () => {
  const pkg = JSON.parse(read('package.json'))
  const script: string = pkg.scripts['dev'] ?? ''
  assertExcludes(
    script,
    'legacy/',
    'package.json "dev" script must not reference legacy/ — the v1.0 CLI is dead',
  )
})

// ── Test 22 — no package.json script references "legacy/index" ───────────────
test('cli-prod: no package.json script references legacy/index', () => {
  const pkg = JSON.parse(read('package.json'))
  const scripts = pkg.scripts as Record<string, string>
  const offenders = Object.entries(scripts)
    .filter(([, v]) => v.includes('legacy/index'))
    .map(([k]) => k)
  assert(
    offenders.length === 0,
    `package.json scripts must not reference legacy/index — offending keys: ${offenders.join(', ')}`,
  )
})

// ── Test 23 — package.json "dev" script launches Electron ────────────────────
test('cli-prod: package.json dev script launches Electron (contains "electron .")', () => {
  const pkg = JSON.parse(read('package.json'))
  const script: string = pkg.scripts['dev'] ?? ''
  assert(
    script.includes('electron .'),
    `package.json "dev" must run "electron ." to launch the app in dev mode (got: "${script}")`,
  )
})

// ── Test 24 — grep-style: legacy/index does not appear in package.json text ──
test('cli-prod: literal grep of package.json contains no "legacy/index" string', () => {
  const raw = read('package.json')
  assertExcludes(
    raw,
    'legacy/index',
    'package.json raw text must not contain "legacy/index" anywhere',
  )
})

// ── Test 25 — legacy/ dir exists but is not referenced from live source ───────
test('cli-prod: legacy/ directory exists but live source files do not import it', () => {
  // Structural: legacy/ must be present (historical archive)
  const legacyDir = path.join(ROOT, 'legacy')
  assert(fs.existsSync(legacyDir), 'legacy/ directory must exist as historical archive')

  // Live source files in core/, api/, cli/, agents/, providers/, coordination/,
  // integrations/, memory/, security/ must not import from legacy/
  const liveDirs = ['core', 'api', 'cli', 'agents', 'providers', 'coordination',
                    'integrations', 'memory', 'security', 'bin']
  const hits: string[] = []
  for (const dir of liveDirs) {
    const absDir = path.join(ROOT, dir)
    if (!fs.existsSync(absDir)) continue
    const walk = (d: string): void => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name)
        if (entry.isDirectory()) { walk(full); continue }
        if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.js')) continue
        const src = fs.readFileSync(full, 'utf-8')
        if (src.includes('legacy/')) hits.push(path.relative(ROOT, full))
      }
    }
    walk(absDir)
  }
  assert(
    hits.length === 0,
    `Live source files must not import legacy/ — found references in: ${hits.join(', ')}`,
  )
})

// ── Test 26 — /api/health endpoint exists in api/server.ts ───────────────────
test('cli-prod: /api/health endpoint is registered in api/server.ts', () => {
  const src = read('api/server.ts')
  assertIncludes(
    src,
    "app.get('/api/health'",
    "api/server.ts must register GET /api/health — used by waitForApi in --cli mode",
  )
})

// ── Test 27 — Ollama execSync uses stdio:'pipe' (no leaking Windows errors) ──
test('cli-prod: ollama execSync in modelRouter uses stdio pipe to suppress Windows errors', () => {
  const src = read('core/modelRouter.ts')
  // The execSync call must have stdio:'pipe' so Windows "not recognized" doesn't leak
  const execIdx = src.indexOf("execSync('ollama list'")
  assert(execIdx !== -1, "core/modelRouter.ts must contain execSync('ollama list')")
  const callSlice = src.substring(execIdx, execIdx + 120)
  assertIncludes(
    callSlice,
    'stdio',
    "execSync('ollama list') must pass stdio option to suppress Windows stderr leakage",
  )
  assertIncludes(
    callSlice,
    'pipe',
    "execSync('ollama list') must set stdio to 'pipe'",
  )
})

// ── Test 28 — electron/main.js --cli branch calls waitForApi ─────────────────
test('cli-prod: electron/main.js --cli branch awaits waitForApi before spawning CLI', () => {
  const src       = read('electron/main.js')
  const isCliIdx  = src.indexOf('if (isCliMode)')
  const guiMarker = src.indexOf('// ── GUI mode')
  const cliBlock  = src.substring(isCliIdx, guiMarker)
  assertIncludes(
    cliBlock,
    'waitForApi',
    '--cli block must call waitForApi() to poll API readiness before spawning the CLI child',
  )
  assertIncludes(
    cliBlock,
    'await waitForApi',
    '--cli block must AWAIT waitForApi (not fire-and-forget)',
  )
})

// ── Test 29 — waitForApi accepts a timeout parameter ─────────────────────────
test('cli-prod: waitForApi function accepts a timeoutMs parameter', () => {
  const src = read('electron/main.js')
  assertIncludes(
    src,
    'async function waitForApi',
    'electron/main.js must define async function waitForApi',
  )
  assertIncludes(
    src,
    'timeoutMs',
    'waitForApi must accept a timeoutMs parameter for configurable timeout',
  )
})

// ── Test 30 — no hardcoded AIDEN_API message in --cli error path ──────────────
test('cli-prod: --cli mode error path does not show "set AIDEN_API env var" message', () => {
  const src = read('cli/aiden.ts')
  // Find the AIDEN_CLI_MODE branch
  const cliModeIdx = src.indexOf('AIDEN_CLI_MODE')
  assert(cliModeIdx !== -1, 'cli/aiden.ts must check process.env.AIDEN_CLI_MODE for error message branching')
  // In the --cli branch (before the else), the "AIDEN_API env var" text must NOT appear
  const cliErrBranch = src.substring(cliModeIdx, src.indexOf('} else {', cliModeIdx))
  assertExcludes(
    cliErrBranch,
    'AIDEN_API env var',
    '--cli error branch must NOT show "AIDEN_API env var" — that message is for standalone mode only',
  )
  // But it must reference the log file
  assertIncludes(
    cliErrBranch,
    'logFile',
    '--cli error branch must reference the log file path',
  )
})

// ── Test 31 — waitForApi checks res.ok ───────────────────────────────────────
test('cli-prod: waitForApi checks res.ok before treating response as success', () => {
  const src = read('electron/main.js')
  // Locate the async waitForApi definition (not the callback-based one)
  const asyncIdx = src.indexOf('async function waitForApi')
  assert(asyncIdx !== -1, 'electron/main.js must define async function waitForApi')
  // Find the closing brace of this function by scanning forward ~30 lines worth
  const funcBody = src.substring(asyncIdx, asyncIdx + 1000)
  assertIncludes(
    funcBody,
    'res.ok',
    'async waitForApi must check res.ok to reject non-2xx responses',
  )
})

// ── Test 32 — waitForApi validates JSON body ──────────────────────────────────
test('cli-prod: waitForApi validates health response body has status ok', () => {
  const src = read('electron/main.js')
  const asyncIdx = src.indexOf('async function waitForApi')
  assert(asyncIdx !== -1, 'electron/main.js must define async function waitForApi')
  const funcBody = src.substring(asyncIdx, asyncIdx + 1000)
  assertIncludes(
    funcBody,
    'res.json()',
    'async waitForApi must parse JSON body to validate the health response',
  )
  assertIncludes(
    funcBody,
    "body.status === 'ok'",
    "async waitForApi must verify body.status === 'ok' to reject proxies/other services",
  )
})

// ── Test 33 — --cli child spawn has AIDEN_CLI_MODE=1 ─────────────────────────
test('cli-prod: --cli block injects AIDEN_CLI_MODE=1 into CLI child env', () => {
  const src = read('electron/main.js')
  // Find the CLI child spawn (after the waitForApi call)
  const cliChildIdx = src.indexOf('AIDEN_CLI_MODE')
  assert(cliChildIdx !== -1, 'electron/main.js must set AIDEN_CLI_MODE in CLI child env')
  const vicinity = src.substring(cliChildIdx, cliChildIdx + 200)
  assertIncludes(
    vicinity,
    "'1'",
    'AIDEN_CLI_MODE must be set to "1" in the CLI child process env',
  )
})

// ── Test 34 — --cli API child spawn has AIDEN_USER_DATA ──────────────────────
test('cli-prod: --cli block injects AIDEN_USER_DATA into API child spawn env', () => {
  const src = read('electron/main.js')
  // Find the API child spawn section (before CLI child spawn)
  assertIncludes(
    src,
    'AIDEN_USER_DATA:  USER_DATA',
    'electron/main.js must inject AIDEN_USER_DATA into the API child process env',
  )
  assertIncludes(
    src,
    'AIDEN_WORKSPACE:  WORKSPACE',
    'electron/main.js must inject AIDEN_WORKSPACE into the API child process env',
  )
  assertIncludes(
    src,
    'AIDEN_CONFIG_DIR: CONFIG_DIR',
    'electron/main.js must inject AIDEN_CONFIG_DIR into the API child process env',
  )
})

// ── Test 35 — CLI bundle has branched error messages ─────────────────────────
test('cli-prod: dist-bundle/cli.js has AIDEN_CLI_MODE branch for error messages', () => {
  const src = read('dist-bundle/cli.js')
  assertIncludes(
    src,
    'AIDEN_CLI_MODE',
    'dist-bundle/cli.js must contain AIDEN_CLI_MODE check for branched error messages',
  )
  // Confirm both branches exist
  assertIncludes(
    src,
    '[CLI] API server did not start',
    'dist-bundle/cli.js must have the CLI-mode error message branch',
  )
  assertIncludes(
    src,
    'Start the Aiden desktop app first',
    'dist-bundle/cli.js must retain the standalone-mode error message in the else branch',
  )
})

// ── Test 36 — CLI bundle CLI-mode branch does NOT show "AIDEN_API env var" ───
test('cli-prod: dist-bundle/cli.js CLI-mode error branch excludes "AIDEN_API env var"', () => {
  const src = read('dist-bundle/cli.js')
  const cliModeIdx = src.indexOf('AIDEN_CLI_MODE')
  assert(cliModeIdx !== -1, 'dist-bundle/cli.js must contain AIDEN_CLI_MODE')
  // The CLI branch ends at the "} else {" that precedes the standalone message
  const elseIdx = src.indexOf('} else {', cliModeIdx)
  assert(elseIdx !== -1, 'dist-bundle/cli.js must have an else branch after AIDEN_CLI_MODE check')
  const cliBranch = src.substring(cliModeIdx, elseIdx)
  assertExcludes(
    cliBranch,
    'AIDEN_API env var',
    'The AIDEN_CLI_MODE=1 branch must NOT contain "AIDEN_API env var" — that belongs in the else branch only',
  )
})

// ── Test 37 — providers/index.ts CONFIG_PATH respects AIDEN_CONFIG_DIR ───────
test('cli-prod: providers/index.ts CONFIG_PATH respects AIDEN_CONFIG_DIR env var', () => {
  const src = read('providers/index.ts')
  assertIncludes(
    src,
    'AIDEN_CONFIG_DIR',
    'providers/index.ts CONFIG_PATH must check process.env.AIDEN_CONFIG_DIR',
  )
  // Ensure fallback is present so standalone mode still works
  assertIncludes(
    src,
    'process.cwd()',
    'providers/index.ts CONFIG_PATH must fall back to process.cwd() when AIDEN_CONFIG_DIR is not set',
  )
  // Confirm the config path uses whichever is set
  const configPathIdx = src.indexOf('CONFIG_PATH')
  assert(configPathIdx !== -1, 'providers/index.ts must declare CONFIG_PATH')
  const configPathLine = src.substring(configPathIdx, configPathIdx + 300)
  assertIncludes(
    configPathLine,
    'AIDEN_CONFIG_DIR',
    'CONFIG_PATH declaration must reference AIDEN_CONFIG_DIR',
  )
})

// ── Runner ────────────────────────────────────────────────────────────────────

runAll().then(results => {
  const logPath = path.join(ROOT, 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  if (failed > 0) process.exit(1)
})
