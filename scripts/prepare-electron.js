#!/usr/bin/env node
// ============================================================
// Aiden — Electron Build Preparation Script
// Runs before electron-builder to:
//   1. Compile TypeScript → dist/
//   2. Build Next.js with standalone output
//   3. Copy .next/static + public into standalone dir
//      (Next.js standalone doesn't bundle them automatically)
// ============================================================
'use strict'

const { execSync } = require('child_process')
const path = require('path')
const fs   = require('fs')

const ROOT  = path.join(__dirname, '..')
const DASH  = path.join(ROOT, 'dashboard-next')
const NEXT  = path.join(DASH, '.next')

function run (cmd, cwd) {
  console.log(`\n▶ ${cmd}`)
  execSync(cmd, { cwd: cwd || ROOT, stdio: 'inherit' })
}

function copyDir (src, dst) {
  if (!fs.existsSync(src)) { console.log(`  skip (missing): ${src}`); return }
  fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

// ── Step 1: TypeScript build ──────────────────────────────────
console.log('\n═══ Step 1: TypeScript build ═══')
run('npx tsc --outDir dist', ROOT)
console.log('  ✅ dist/ compiled')

// ── Step 1.5: Bundle API server with esbuild ─────────────────
console.log('\n═══ Step 1.5: Bundle API server (esbuild) ═══')
run('node scripts/bundle-api.js', ROOT)
console.log('  ✅ dist-bundle/index.js produced')

// ── Step 1.6: Copy native modules ────────────────────────────
console.log('\n═══ Step 1.6: Copy native modules ═══')
run('node scripts/copy-native-modules.js', ROOT)
console.log('  ✅ native-modules/ populated')

// ── Step 2: Next.js standalone build ─────────────────────────
console.log('\n═══ Step 2: Next.js dashboard (standalone) ═══')
// Ensure dashboard dependencies are installed
if (!fs.existsSync(path.join(DASH, 'node_modules'))) {
  run('npm install', DASH)
}
run('npm run build', DASH)
console.log('  ✅ .next/standalone built')

// ── Step 3: Copy static assets into standalone dir ───────────
// Next.js standalone server.js serves from relative paths:
//   .next/static → served at /_next/static
//   public       → served at /
console.log('\n═══ Step 3: Copy static assets into standalone/ ═══')
const standalone = path.join(NEXT, 'standalone')

if (!fs.existsSync(standalone)) {
  console.error('ERROR: .next/standalone/ not found — did next.config.js set output: "standalone"?')
  process.exit(1)
}

// Copy .next/static → standalone/.next/static
const staticSrc = path.join(NEXT, 'static')
const staticDst = path.join(standalone, '.next', 'static')
console.log(`  Copying .next/static → standalone/.next/static`)
copyDir(staticSrc, staticDst)
console.log('  ✅ static assets copied')

// Copy public/ → standalone/public
const publicSrc = path.join(DASH, 'public')
const publicDst = path.join(standalone, 'public')
if (fs.existsSync(publicSrc)) {
  console.log(`  Copying public/ → standalone/public/`)
  copyDir(publicSrc, publicDst)
  console.log('  ✅ public/ copied')
} else {
  console.log('  (no public/ dir, skipping)')
}

// ── Step 3.5: Reset workspace/USER.md to blank template ──────
// Ensures the developer's personal profile never ships in the installer.
// Each user populates their own USER.md via onboarding or Settings → My Profile.
console.log('\n═══ Step 3.5: Reset USER.md to blank template ═══')
const userMdPath = path.join(ROOT, 'workspace', 'USER.md')
const userMdTemplate = '# User Profile\nName: User\n'
try {
  fs.mkdirSync(path.dirname(userMdPath), { recursive: true })
  fs.writeFileSync(userMdPath, userMdTemplate, 'utf8')
  console.log('  ✅ workspace/USER.md reset to blank template')
} catch (e) {
  console.warn('  ⚠️  Could not reset USER.md:', e.message)
}

// ── Step 4: Point main at Electron entry ─────────────────────
console.log('\n═══ Step 4: Set Electron entry point ═══')
const pkgPath = path.join(ROOT, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const oldMain = pkg.main
pkg.main = 'electron/main.js'
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`  main: "${oldMain}" → "electron/main.js"`)
console.log('  ✅ package.json updated for Electron build')

// ── Done ─────────────────────────────────────────────────────
console.log('\n═══ Preparation complete ═══')
console.log('  dist/            → compiled API server')
console.log('  .next/standalone → self-contained Next.js server')
console.log('\nReady for: electron-builder --win\n')
