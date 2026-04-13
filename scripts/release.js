#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const newVersion = process.argv[2]

if (!newVersion) {
  console.error('Usage: node scripts/release.js <version>')
  console.error('Example: node scripts/release.js 3.2.0')
  process.exit(1)
}

// Validate semver format
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(`Invalid version: ${newVersion} (expected X.Y.Z)`)
  process.exit(1)
}

const REPO = 'taracodlabs/aiden-releases'

function run(cmd, options = {}) {
  console.log(`\n> ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit', ...options })
  } catch (error) {
    console.error(`Command failed: ${cmd}`)
    process.exit(1)
  }
}

function runSilent(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim()
}

console.log(`\n========================================`)
console.log(`  AIDEN RELEASE v${newVersion}`)
console.log(`========================================\n`)

// Step 1: Update version in package.json
console.log('Step 1/8: Updating package.json version...')
const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const oldVersion = pkg.version
pkg.version = newVersion
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`  ${oldVersion} → ${newVersion}`)

// Step 2: Update version in electron/main.js if hardcoded
console.log('Step 2/8: Checking for hardcoded versions...')
const filesToUpdate = [
  'electron/main.js',
  'core/aidenIdentity.ts',
  'api/server.ts'
]
for (const file of filesToUpdate) {
  const fullPath = path.join(__dirname, '..', file)
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8')
    if (content.includes(oldVersion)) {
      content = content.replace(new RegExp(oldVersion.replace(/\./g, '\\.'), 'g'), newVersion)
      fs.writeFileSync(fullPath, content)
      console.log(`  Updated ${file}`)
    }
  }
}

// Step 3: TypeScript check
console.log('Step 3/8: TypeScript check...')
run('npx tsc --noEmit')

// Step 4: Kill existing node processes
console.log('Step 4/8: Killing node processes...')
try { execSync('taskkill /F /IM node.exe /T', { stdio: 'ignore' }) } catch {}

// Step 5: Build
console.log('Step 5/8: Building installer...')
run('npm run build:win')

// Step 6: Rename installer
console.log('Step 6/8: Renaming installer...')
const releaseDir = path.join(__dirname, '..', 'release')
const oldName = path.join(releaseDir, `Aiden Setup ${newVersion}.exe`)
const newName = path.join(releaseDir, `Aiden-Setup-${newVersion}.exe`)

if (fs.existsSync(newName)) fs.unlinkSync(newName)
if (fs.existsSync(oldName)) {
  fs.renameSync(oldName, newName)
} else {
  console.error(`Installer not found: ${oldName}`)
  process.exit(1)
}

const size = (fs.statSync(newName).size / (1024 * 1024)).toFixed(1)
console.log(`  Installer: ${size} MB`)

// Step 7: Delete old GitHub release
console.log('Step 7/8: Uploading to GitHub...')
try {
  execSync(`gh release delete v${newVersion} --repo ${REPO} --yes`, { stdio: 'ignore' })
} catch {}

// Step 8: Create new release
run(
  `gh release create v${newVersion} "${newName}" ` +
  `--repo ${REPO} ` +
  `--title "Aiden v${newVersion}" ` +
  `--notes "v${newVersion} release" ` +
  `--latest`
)

// Verify
console.log('\nStep 8/8: Verifying download...')
const url = `https://github.com/${REPO}/releases/download/v${newVersion}/Aiden-Setup-${newVersion}.exe`
try {
  const headers = runSilent(`curl.exe -sI "${url}"`)
  if (headers.includes('302') || headers.includes('200')) {
    console.log('  ✅ Download verified')
  } else {
    console.log('  ⚠️ Download check returned unexpected status')
  }
} catch {}

console.log(`\n========================================`)
console.log(`  ✅ RELEASE v${newVersion} COMPLETE`)
console.log(`  File: Aiden-Setup-${newVersion}.exe (${size} MB)`)
console.log(`  URL: ${url}`)
console.log(`========================================\n`)
