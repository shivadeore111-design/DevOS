// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_r1.ts — 8 zero-cost audits for Prompt R1 (v3.6.0 release integrity).
// Run via:  npm run test:audit
// No LLM. No side effects. Verifies release artifacts and source hygiene.

import path from 'path'
import fs   from 'fs'
import { execSync } from 'child_process'
import { test, assert, assertEquals, assertIncludes, assertExcludes, runAll, appendAuditLog } from './harness'

// ── Test 1 — package.json version is 3.6.0 ───────────────────────────────────
test('release: package.json version === "3.6.0"', () => {
  const pkgPath = path.join(process.cwd(), 'package.json')
  assert(fs.existsSync(pkgPath), 'package.json must exist')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  assertEquals(pkg.version, '3.6.0', `package.json version must be "3.6.0", got "${pkg.version}"`)
})

// ── Test 2 — CHANGELOG.md contains v3.5.0 header ─────────────────────────────
test('release: CHANGELOG.md contains "## v3.5.0" header', () => {
  const clPath = path.join(process.cwd(), 'CHANGELOG.md')
  assert(fs.existsSync(clPath), 'CHANGELOG.md must exist')
  const content = fs.readFileSync(clPath, 'utf-8')
  assertIncludes(content, '## v3.5.0', 'CHANGELOG.md must contain ## v3.5.0 header')
  assertIncludes(content, '▲IDEN', 'CHANGELOG.md must mention ▲IDEN release name')
})

// ── Test 3 — local git tag v3.5.0 exists ─────────────────────────────────────
test('release: local git tag v3.5.0 exists', () => {
  let tags: string
  try {
    tags = execSync('git tag --list v3.5.0', { encoding: 'utf-8', cwd: process.cwd() }).trim()
  } catch (e: any) {
    throw new Error('git tag --list failed: ' + e.message)
  }
  assertEquals(tags, 'v3.5.0', `git tag v3.5.0 must exist locally, got: "${tags}"`)
})

// ── Test 4 — no stale 3.1.0 or 3.4.0 version strings in source ───────────────
test('release: no stale 3.1.0 or 3.4.0 version strings in source files', () => {
  const sourceFiles = [
    'package.json',
    'index.ts',
    'api/server.ts',
    'cli/aiden.ts',
    'electron/preload.js',
    'cloudflare-worker/license-server.js',
  ]
  const stalePatterns = ['3.1.0', '3.4.0']
  for (const file of sourceFiles) {
    const fullPath = path.join(process.cwd(), file)
    if (!fs.existsSync(fullPath)) continue
    const content = fs.readFileSync(fullPath, 'utf-8')
    for (const pattern of stalePatterns) {
      // Allow cloudflare-worker download URLs to reference older release assets
      if (file === 'cloudflare-worker/license-server.js') continue
      assert(
        !content.includes(pattern),
        `"${pattern}" stale version string found in ${file}`
      )
    }
  }
})

// ── Test 5 — CHANGELOG.md has correct audit count ────────────────────────────
test('release: CHANGELOG.md references "34 zero-cost audits across 4 suites"', () => {
  const clPath = path.join(process.cwd(), 'CHANGELOG.md')
  const content = fs.readFileSync(clPath, 'utf-8')
  assertIncludes(content, '34 zero-cost audits across 4 suites',
    'CHANGELOG.md must reference 34 zero-cost audits across 4 suites')
})

// ── Test 6 — installer artifact exists in release/ ───────────────────────────
test('release: Aiden-Setup-3.5.0.exe exists in release/ and is > 100 MB', () => {
  const exePath = path.join(process.cwd(), 'release', 'Aiden-Setup-3.5.0.exe')
  assert(fs.existsSync(exePath), 'release/Aiden-Setup-3.5.0.exe must exist')
  const sizeBytes = fs.statSync(exePath).size
  const sizeMB = sizeBytes / (1024 * 1024)
  assert(sizeMB > 100, `Installer must be > 100 MB, got ${sizeMB.toFixed(1)} MB`)
})

// ── Test 7 — test:audit script includes prompt_r1 ────────────────────────────
test('release: package.json test:audit script includes prompt_r1', () => {
  const pkgPath = path.join(process.cwd(), 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const auditScript: string = pkg.scripts?.['test:audit'] ?? ''
  assertIncludes(auditScript, 'prompt_r1',
    'package.json test:audit must include prompt_r1')
})

// ── Test 8 — all 4 test suite files exist ────────────────────────────────────
test('release: all 4 audit suite files exist (prompt_11 · 12 · 13 · r1)', () => {
  const suites = ['prompt_11', 'prompt_12', 'prompt_13', 'prompt_r1']
  for (const suite of suites) {
    const p = path.join(process.cwd(), 'tests', `${suite}.ts`)
    assert(fs.existsSync(p), `tests/${suite}.ts must exist`)
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
