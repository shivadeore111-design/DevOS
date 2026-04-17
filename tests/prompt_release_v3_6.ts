/**
 * prompt_release_v3_6.ts — v3.6.0 release integrity self-test
 * Tests: CHANGELOG entry, installer artifact, NSIS PATH fix,
 *        MCP client, skill count, git tag, version consistency
 * Target: 148 prior + 7 new = 155/155
 */

import * as fs   from 'fs'
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

  // ── Test 1 — CHANGELOG v3.6.0 entry ─────────────────────────────────────
  test(1, 'rv36: CHANGELOG.md has v3.6.0 header and Scale positioning', () => {
    const c = readFile('CHANGELOG.md')
    return c.includes('## v3.6.0') &&
           c.includes('The Scale release') &&
           c.includes('52 shipping skills') &&
           c.includes('148/148')
  }),

  // ── Test 2 — installer artifact present and sized ────────────────────────
  test(2, 'rv36: release/Aiden-Setup-3.6.0.exe exists and is > 100 MB', () => {
    const p = path.join(ROOT, 'release', 'Aiden-Setup-3.6.0.exe')
    if (!fs.existsSync(p)) return false
    const sizeMB = fs.statSync(p).size / (1024 * 1024)
    return sizeMB > 100
  }),

  // ── Test 3 — NSIS installer.nsh: WinMessages + PowerShell uninstall ──────
  test(3, 'rv36: installer.nsh includes WinMessages.nsh and uses nsExec for uninstall', () => {
    const c = readFile('build/installer.nsh')
    return c.includes('!include "WinMessages.nsh"') &&
           c.includes('WriteRegExpandStr HKCU') &&
           c.includes('nsExec::ExecToLog') &&
           c.includes('$$p') &&          // PowerShell vars properly escaped
           c.includes('$$entries') &&
           c.includes('$$_')
  }),

  // ── Test 4 — MCP client exists ───────────────────────────────────────────
  test(4, 'rv36: core/mcpClient.ts exists (native MCP client feature)', () => {
    return fileExists('core/mcpClient.ts')
  }),

  // ── Test 5 — skill count: exactly 56 SKILL.md files ─────────────────────
  test(5, 'rv36: exactly 56 SKILL.md files exist under skills/', () => {
    const skillsDir = path.join(ROOT, 'skills')
    if (!fs.existsSync(skillsDir)) return false
    const count = countFiles(skillsDir, 'SKILL.md')
    return count === 56
  }),

  // ── Test 6 — git tag v3.6.0 present locally ─────────────────────────────
  test(6, 'rv36: local git tag v3.6.0 exists', () => {
    try {
      const { execSync } = require('child_process')
      const tags = execSync('git tag --list v3.6.0', {
        encoding: 'utf-8',
        cwd: ROOT,
      }).trim()
      return tags === 'v3.6.0'
    } catch {
      return false
    }
  }),

  // ── Test 7 — package.json version is 3.6.0 ──────────────────────────────
  test(7, 'rv36: package.json version === "3.6.0"', () => {
    const pkg = JSON.parse(readFile('package.json'))
    return pkg.version === '3.6.0'
  }),

]

// ── Helpers ─────────────────────────────────────────────────────────────────
function countFiles(dir: string, name: string): number {
  let count = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name), name)
    } else if (entry.name === name) {
      count++
    }
  }
  return count
}

// ── Report ───────────────────────────────────────────────────────────────────
const passed = results.filter(r => r.passed).length
const failed = results.filter(r => !r.passed).length
const ts     = new Date().toISOString()

console.log('\n  prompt_release_v3_6 — v3.6.0 release integrity\n')
for (const r of results) {
  const icon = r.passed ? '✓' : '✗'
  const col  = r.passed ? '\x1b[32m' : '\x1b[31m'
  console.log(`  ${col}${icon}\x1b[0m  [${String(r.id).padStart(2, '0')}] ${r.label}  (${r.durationMs}ms)`)
}
console.log(`\n  ${ts} — ${passed}/${results.length} passed\n`)

// ── Append to AUDIT_LOG.md ───────────────────────────────────────────────────
const AUDIT_LOG = path.join(ROOT, 'tests', 'AUDIT_LOG.md')
const rows = results
  .map(r => `| ${r.id} | ${r.label} | ${r.passed ? '✓' : '✗'} | ${r.durationMs} | ${r.passed ? 'ok' : 'FAIL'} |`)
  .join('\n')
const block = `\n## prompt_release_v3_6 — v3.6.0 release integrity\n\n| # | label | pass | ms | status |\n|---|-------|------|----|--------|\n${rows}\n\n${ts} — ${passed}/${results.length} passed\n`

const existing = fs.readFileSync(AUDIT_LOG, 'utf8')
if (!existing.includes('## prompt_release_v3_6')) {
  fs.appendFileSync(AUDIT_LOG, block, 'utf8')
  console.log('  AUDIT_LOG.md updated.')
}

if (failed > 0) {
  console.error(`  ${failed} test(s) failed.`)
  process.exit(1)
}
