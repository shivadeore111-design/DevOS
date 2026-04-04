// postinstall.js — runs after npm install
// Creates required workspace directories
'use strict'
const fs   = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')

const dirs = [
  'workspace/sandbox',
  'workspace/uploads',
  'workspace/artifacts',
  'workspace/memory',
  'logs',
]

for (const d of dirs) {
  const p = path.join(root, d)
  if (!fs.existsSync(p)) {
    try { fs.mkdirSync(p, { recursive: true }) } catch { /* skip */ }
  }
}
