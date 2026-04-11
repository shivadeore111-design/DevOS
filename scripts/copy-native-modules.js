#!/usr/bin/env node
// ============================================================
// Aiden — Native Module Copier
// Copies only the externalized packages + their transitive
// dependencies to native-modules/ so the bundled app can find
// them at runtime via NODE_PATH.
// ============================================================
'use strict'

const path = require('path')
const fs   = require('fs')

const ROOT       = path.join(__dirname, '..')
const SRC_NM     = path.join(ROOT, 'node_modules')
const DST_NM     = path.join(ROOT, 'native-modules')

// Root packages to copy (must match EXTERNALS in bundle-api.js,
// minus 'electron' which is never shipped in resources/).
const ROOT_PACKAGES = [
  'bcrypt',
  'screenshot-desktop',
  'ssh2',
  'sql.js',
  'puppeteer',
  'puppeteer-core',
  'playwright',
  'playwright-core',
  'whatsapp-web.js',
  'epub2',
  '@nut-tree-fork/nut-js',
]

// ── Helpers ───────────────────────────────────────────────────

function copyDir (src, dst) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else {
      try { fs.copyFileSync(s, d) } catch { /* skip locked files */ }
    }
  }
}

// Walk the dependency tree starting from pkgName and collect all transitive deps.
function collectDeps (pkgName, visited = new Set()) {
  if (visited.has(pkgName)) return visited
  visited.add(pkgName)

  const pkgDir = path.join(SRC_NM, pkgName)
  if (!fs.existsSync(pkgDir)) return visited

  const pkgJsonPath = path.join(pkgDir, 'package.json')
  if (!fs.existsSync(pkgJsonPath)) return visited

  let pkg
  try { pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) } catch { return visited }

  for (const dep of Object.keys(pkg.dependencies || {})) {
    collectDeps(dep, visited)
  }
  // optionalDependencies too — native packages often list their bindings here
  for (const dep of Object.keys(pkg.optionalDependencies || {})) {
    collectDeps(dep, visited)
  }
  return visited
}

// ── Main ──────────────────────────────────────────────────────

console.log('\n═══ Collecting native module dependencies ═══')

// Clean previous output
if (fs.existsSync(DST_NM)) {
  fs.rmSync(DST_NM, { recursive: true, force: true })
}
fs.mkdirSync(DST_NM, { recursive: true })

// Collect the full set of packages to copy
const toCopy = new Set()
for (const pkg of ROOT_PACKAGES) {
  collectDeps(pkg, toCopy)
}

console.log(`  Packages to copy: ${toCopy.size}`)

// Packages never needed at runtime
const SKIP_PATTERNS = [
  /^@types\//,     // TypeScript type-only packages
]

// Copy each package
let copied = 0
let skipped = 0
for (const pkg of [...toCopy].sort()) {
  if (SKIP_PATTERNS.some(p => p.test(pkg))) { skipped++; continue }
  const src = path.join(SRC_NM, pkg)
  const dst = path.join(DST_NM, pkg)
  if (!fs.existsSync(src)) {
    skipped++
    continue
  }
  copyDir(src, dst)
  copied++
}

// Report final size
function dirSizeMB (dir) {
  let total = 0
  function walk (d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else { try { total += fs.statSync(p).size } catch {} }
    }
  }
  walk(dir)
  return (total / 1024 / 1024).toFixed(1)
}

const sizeMb = dirSizeMB(DST_NM)
console.log(`  ✅ Copied ${copied} packages (${skipped} skipped/missing) — ${sizeMb} MB`)
