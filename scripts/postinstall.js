// postinstall.js — runs after npm install
// Creates required workspace directories and copies bundled starter skills
'use strict'
const fs   = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')

const dirs = [
  'workspace/sandbox',
  'workspace/uploads',
  'workspace/artifacts',
  'workspace/memory',
  'workspace/skills',
  'logs',
]

for (const d of dirs) {
  const p = path.join(root, d)
  if (!fs.existsSync(p)) {
    try { fs.mkdirSync(p, { recursive: true }) } catch { /* skip */ }
  }
}

// ── Copy bundled starter skills on first install ─────────────
// Only runs when workspace/skills/ is empty (no learned/ or approved/ subdirs
// with content). Does NOT overwrite existing user skills.
const skillsDst = path.join(root, 'workspace', 'skills')
const skillsSrc = path.join(root, 'workspace-templates', 'skills')

function dirHasSkills(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    return entries.some(e => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'SKILL.md')))
  } catch { return false }
}

function copyDirRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(s, d)
    } else {
      fs.copyFileSync(s, d)
    }
  }
}

if (fs.existsSync(skillsSrc)) {
  // Check if user already has skills anywhere in workspace/skills/
  const hasExisting =
    dirHasSkills(skillsDst) ||
    dirHasSkills(path.join(skillsDst, 'learned')) ||
    dirHasSkills(path.join(skillsDst, 'approved'))

  if (!hasExisting) {
    try {
      const srcEntries = fs.readdirSync(skillsSrc, { withFileTypes: true })
        .filter(e => e.isDirectory())
      let copied = 0
      for (const entry of srcEntries) {
        const from = path.join(skillsSrc, entry.name)
        const to   = path.join(skillsDst, entry.name)
        if (!fs.existsSync(to)) {
          copyDirRecursive(from, to)
          copied++
        }
      }
      if (copied > 0) {
        console.log(`  Installed ${copied} starter skills. Type /skills to view.`)
      }
    } catch (e) {
      // Non-fatal — skills copy failure shouldn't break install
      console.log('  Note: Could not copy starter skills:', e.message)
    }
  }
}
