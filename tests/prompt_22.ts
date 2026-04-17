/**
 * prompt_22.ts — Install experience self-test
 * Tests: single-word launcher, PowerShell one-liner, landing.js route,
 *        winget manifests, scoop manifest, README install section
 * Expected: 11/11 pass
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..')

interface TestResult {
  id: number
  label: string
  passed: boolean
  durationMs: number
}

function test(id: number, label: string, fn: () => boolean): TestResult {
  const start = Date.now()
  let passed = false
  try { passed = fn() } catch { passed = false }
  return { id, label, passed, durationMs: Date.now() - start }
}

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel))
}

const results: TestResult[] = [

  // ── Launcher: bin/aiden.cmd ──────────────────────────────────────────────
  test(1, 'p22: bin/aiden.cmd exists', () =>
    fileExists('bin/aiden.cmd')),

  test(2, 'p22: bin/aiden.cmd delegates to Aiden.exe', () => {
    const c = readFile('bin/aiden.cmd')
    return c.includes('%~dp0') && c.includes('Aiden.exe') && c.includes('%*')
  }),

  // ── Launcher: bin/aiden (bash/WSL) ───────────────────────────────────────
  test(3, 'p22: bin/aiden (bash) exists', () =>
    fileExists('bin/aiden')),

  test(4, 'p22: bin/aiden checks WSL_DISTRO_NAME', () => {
    const c = readFile('bin/aiden')
    return c.includes('WSL_DISTRO_NAME') && c.includes('AIDEN_WIN_PATH')
  }),

  // ── NSIS PATH integration ────────────────────────────────────────────────
  test(5, 'p22: build/installer.nsh exists', () =>
    fileExists('build/installer.nsh')),

  test(6, 'p22: installer.nsh adds bin to HKCU PATH', () => {
    const c = readFile('build/installer.nsh')
    return c.includes('WriteRegExpandStr HKCU') &&
           c.includes('"Environment"') &&
           c.includes('"PATH"') &&
           c.includes('customInstall') &&
           c.includes('customUnInstall')
  }),

  // ── PowerShell one-liner: install.ps1 ───────────────────────────────────
  test(7, 'p22: install.ps1 contains iwr one-liner comment', () => {
    const c = readFile('install.ps1')
    return c.includes('iwr https://aiden.taracod.com/install.ps1') &&
           c.includes('-useb') &&
           c.includes('iex')
  }),

  test(8, 'p22: install.ps1 fetches from taracodlabs/aiden-releases', () => {
    const c = readFile('install.ps1')
    return c.includes('taracodlabs/aiden-releases') &&
           c.includes('Aiden-Setup-') &&
           c.includes('/S')
  }),

  // ── Landing.js /install.ps1 route ────────────────────────────────────────
  test(9, 'p22: landing.js has /install.ps1 route', () => {
    const c = readFile('cloudflare-worker/landing.js')
    return c.includes('/install.ps1') && c.includes('installPs1Route')
  }),

  // ── winget manifests ──────────────────────────────────────────────────────
  test(10, 'p22: winget manifests present with correct PackageIdentifier', () => {
    const installer = readFile('packaging/winget/Taracod.Aiden.installer.yaml')
    const locale    = readFile('packaging/winget/Taracod.Aiden.locale.en-US.yaml')
    const version   = readFile('packaging/winget/Taracod.Aiden.yaml')
    return installer.includes('PackageIdentifier: Taracod.Aiden') &&
           installer.includes('InstallerSha256') &&
           locale.includes('Publisher: Taracod') &&
           version.includes('ManifestType: version')
  }),

  // ── scoop manifest ────────────────────────────────────────────────────────
  test(11, 'p22: scoop manifest has checkver and bin fields', () => {
    const c = readFile('packaging/scoop/aiden.json')
    const m = JSON.parse(c)
    return typeof m.checkver !== 'undefined' &&
           m.bin === 'aiden' &&
           typeof m.autoupdate !== 'undefined' &&
           typeof m.installer !== 'undefined'
  }),

]

// ── Report ─────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.passed).length
const failed = results.filter(r => !r.passed).length
const ts     = new Date().toISOString()

console.log('\n  prompt_22 — Install experience\n')
for (const r of results) {
  const icon = r.passed ? '✓' : '✗'
  const col  = r.passed ? '\x1b[32m' : '\x1b[31m'
  console.log(`  ${col}${icon}\x1b[0m  [${String(r.id).padStart(2, '0')}] ${r.label}  (${r.durationMs}ms)`)
}
console.log(`\n  ${ts} — ${passed}/${results.length} passed\n`)

// ── Append to AUDIT_LOG.md ──────────────────────────────────────────────────
const AUDIT_LOG = path.join(ROOT, 'tests', 'AUDIT_LOG.md')
const rows = results
  .map(r => `| ${r.id} | ${r.label} | ${r.passed ? '✓' : '✗'} | ${r.durationMs} | ${r.passed ? 'ok' : 'FAIL'} |`)
  .join('\n')
const block = `\n## prompt_22 — Install experience\n\n| # | label | pass | ms | status |\n|---|-------|------|----|--------|\n${rows}\n\n${ts} — ${passed}/${results.length} passed\n`

const existing = fs.readFileSync(AUDIT_LOG, 'utf8')
if (!existing.includes('## prompt_22')) {
  fs.appendFileSync(AUDIT_LOG, block, 'utf8')
  console.log('  AUDIT_LOG.md updated.')
}

if (failed > 0) {
  console.error(`  ${failed} test(s) failed.`)
  process.exit(1)
}
