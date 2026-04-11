#!/usr/bin/env node
// ============================================================
// Aiden — esbuild API Bundler
// Bundles dist/index.js + all JS deps into dist-bundle/index.js
// Native / binary-dependent packages are externalized and
// copied separately by copy-native-modules.js
// ============================================================
'use strict'

const esbuild = require('esbuild')
const path    = require('path')
const fs      = require('fs')

const ROOT    = path.join(__dirname, '..')
const ENTRY   = path.join(ROOT, 'dist', 'index.js')
const OUTFILE = path.join(ROOT, 'dist-bundle', 'index.js')

// Packages that cannot be bundled:
// - native addons (.node files)
// - browser-binary packages (puppeteer / playwright)
// - WASM packages
// - packages with deeply dynamic require() at runtime
const EXTERNALS = [
  'electron',
  // Native addons
  'bcrypt',
  'screenshot-desktop',
  'ssh2',
  // Browser automation (binary deps)
  'puppeteer',
  'puppeteer-core',
  'playwright',
  'playwright-core',
  // WASM
  'sql.js',
  // Dynamic internal require chains
  'whatsapp-web.js',
  // epub2 uses xmldom which has complex requires
  'epub2',
  // nut-js is a native GUI automation package (optional, may not be installed)
  '@nut-tree-fork/nut-js',
]

async function bundle () {
  if (!fs.existsSync(ENTRY)) {
    console.error(`ERROR: entry not found — ${ENTRY}`)
    console.error('Run "npm run build" first to compile TypeScript.')
    process.exit(1)
  }

  fs.mkdirSync(path.join(ROOT, 'dist-bundle'), { recursive: true })

  console.log(`Bundling: ${ENTRY}`)
  console.log(`Output:   ${OUTFILE}`)
  console.log(`Externals: ${EXTERNALS.join(', ')}`)

  const result = await esbuild.build({
    entryPoints: [ENTRY],
    bundle:      true,
    platform:    'node',
    format:      'cjs',
    target:      'node18',
    outfile:     OUTFILE,
    external:    EXTERNALS,
    keepNames:   true,    // preserve function/class names (needed by some reflection)
    sourcemap:   false,
    // Suppress warnings about dynamic requires — expected in server code
    logLevel:    'warning',
    metafile:    true,    // for size reporting
  })

  // Size report
  const stat = fs.statSync(OUTFILE)
  const mb   = (stat.size / 1024 / 1024).toFixed(1)
  console.log(`  ✅ dist-bundle/index.js — ${mb} MB`)

  if (result.warnings.length > 0) {
    console.log(`  ⚠  ${result.warnings.length} warnings (non-fatal)`)
  }
}

bundle().catch(e => { console.error(e); process.exit(1) })
