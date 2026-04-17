// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_r3.ts — 8 zero-cost audits for Prompt R3
// (Electron auto-updater wiring).
// Run via:  npm run test:audit
// No LLM. No network. No side effects.

import path from 'path'
import fs   from 'fs'
import { test, assert, assertIncludes, assertExcludes, runAll, appendAuditLog } from './harness'

const ROOT     = process.cwd()
const MAIN_JS  = path.join(ROOT, 'electron', 'main.js')
const PRELOAD  = path.join(ROOT, 'electron', 'preload.js')
const PKG      = path.join(ROOT, 'package.json')
const CLI      = path.join(ROOT, 'cli', 'aiden.ts')

// ── Test 1 — electron-updater in package.json dependencies ───────────────────
test('r3: electron-updater present in package.json dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(PKG, 'utf-8'))
  const inDeps    = 'electron-updater' in (pkg.dependencies    ?? {})
  const inDevDeps = 'electron-updater' in (pkg.devDependencies ?? {})
  assert(inDeps || inDevDeps, 'electron-updater must be in dependencies or devDependencies')
})

// ── Test 2 — electron-builder publish config ──────────────────────────────────
test('r3: electron-builder publish config has github/taracodlabs/aiden-releases', () => {
  const pkg = JSON.parse(fs.readFileSync(PKG, 'utf-8'))
  const pub = pkg.build?.publish
  assert(pub !== undefined, 'package.json build.publish must exist')

  // publish can be an object or an array — check first entry
  const entry = Array.isArray(pub) ? pub[0] : pub
  assert(entry.provider === 'github',         'publish.provider must be "github"')
  assert(entry.owner    === 'taracodlabs',    'publish.owner must be "taracodlabs"')
  assert(entry.repo     === 'aiden-releases', 'publish.repo must be "aiden-releases"')
})

// ── Test 3 — autoUpdater wiring in main.js ────────────────────────────────────
test('r3: electron/main.js requires electron-updater and calls checkForUpdatesAndNotify', () => {
  const content = fs.readFileSync(MAIN_JS, 'utf-8')
  assert(
    content.includes("require('electron-updater')") || content.includes('from \'electron-updater\''),
    'main.js must require/import electron-updater',
  )
  assert(
    content.includes('checkForUpdatesAndNotify'),
    'main.js must call autoUpdater.checkForUpdatesAndNotify()',
  )
})

// ── Test 4 — ipcMain.handle for spec-compliant IPC names ─────────────────────
test('r3: electron/main.js has ipcMain.handle for install-update-now and check-for-update', () => {
  const content = fs.readFileSync(MAIN_JS, 'utf-8')
  assert(
    content.includes("ipcMain.handle('install-update-now'") ||
    content.includes('ipcMain.handle("install-update-now"'),
    'main.js must have ipcMain.handle for install-update-now',
  )
  assert(
    content.includes("ipcMain.handle('check-for-update'") ||
    content.includes('ipcMain.handle("check-for-update"'),
    'main.js must have ipcMain.handle for check-for-update',
  )
})

// ── Test 5 — preload.js exposes aidenUpdater with installNow + checkNow ───────
test('r3: electron/preload.js exposes aidenUpdater with installNow and checkNow', () => {
  const content = fs.readFileSync(PRELOAD, 'utf-8')
  assert(
    content.includes("exposeInMainWorld('aidenUpdater'") ||
    content.includes('exposeInMainWorld("aidenUpdater"'),
    'preload.js must exposeInMainWorld aidenUpdater',
  )
  assertIncludes(content, 'installNow', 'aidenUpdater must expose installNow')
  assertIncludes(content, 'checkNow',   'aidenUpdater must expose checkNow')
})

// ── Test 6 — /refresh command triggers update check ──────────────────────────
test('r3: cli/aiden.ts /refresh handler references update-check function', () => {
  const content = fs.readFileSync(CLI, 'utf-8')
  // /refresh must be in COMMANDS
  assert(content.includes("'/refresh'"), '/refresh must be in COMMANDS array')
  // handler must reference checkForUpdate or checkNow
  assert(
    content.includes("command === '/refresh'"),
    'handleCommand must have /refresh branch',
  )
  assert(
    content.includes('checkForUpdate') || content.includes('checkNow'),
    '/refresh handler must call checkForUpdate or checkNow',
  )
})

// ── Test 7 — no dev URLs in update paths ─────────────────────────────────────
test('r3: no localhost/127.0.0.1 in update-related config in main.js', () => {
  const content = fs.readFileSync(MAIN_JS, 'utf-8')
  // Grab only the setupAutoUpdater / autoUpdater block (first 800 chars of that section)
  const setupIdx = content.indexOf('setupAutoUpdater')
  const section  = setupIdx >= 0 ? content.substring(setupIdx, setupIdx + 2000) : ''
  assert(
    !section.includes('localhost') && !section.includes('127.0.0.1'),
    'Update config must not reference localhost or 127.0.0.1',
  )
})

// ── Test 8 — publish config produces correct electron-updater feed URL ────────
test('r3: publish config structure is valid for electron-updater GitHub provider', () => {
  const pkg   = JSON.parse(fs.readFileSync(PKG, 'utf-8'))
  const pub   = pkg.build?.publish
  const entry = Array.isArray(pub) ? pub[0] : pub
  // electron-updater resolves:
  // https://github.com/{owner}/{repo}/releases/latest/download/latest.yml
  const feedUrl = `https://github.com/${entry.owner}/${entry.repo}/releases/latest/download/latest.yml`
  assert(
    feedUrl === 'https://github.com/taracodlabs/aiden-releases/releases/latest/download/latest.yml',
    `Feed URL must resolve to taracodlabs/aiden-releases; got: ${feedUrl}`,
  )
  assert(
    entry.releaseType === undefined || entry.releaseType === 'release',
    'releaseType if present must be "release"',
  )
})

// ── Run ───────────────────────────────────────────────────────────────────────

;(async () => {
  const results = await runAll()
  const logPath = path.join(ROOT, 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  process.exit(failed > 0 ? 1 : 0)
})()
