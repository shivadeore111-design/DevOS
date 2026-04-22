// electron/spawn-api-only.js — Headless API server launcher.
//
// Called by electron/main.js when AIDEN_HEADLESS=true or --headless is passed.
// Works both inside the Electron context (packaged app) and as a plain Node.js
// script (npm start already runs the server directly, so this path is mainly
// for the packaged .exe launched with --headless).
'use strict'

const { spawn } = require('child_process')
const path      = require('path')
const os        = require('os')

// ── Resolve USER_DATA cross-platform ────────────────────────────
function getUserDataDir () {
  if (process.env.AIDEN_USER_DATA) return process.env.AIDEN_USER_DATA

  // Inside Electron we can use app.getPath — but this file is intentionally
  // dependency-free so it also works from plain Node. Fall back to OS defaults.
  let electron
  try { electron = require('electron') } catch { electron = null }

  if (electron && electron.app) {
    return electron.app.getPath('userData')
  }

  switch (process.platform) {
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        'aiden',
      )
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'aiden')
    default:
      return path.join(
        process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
        'aiden',
      )
  }
}

// ── Resolve the API entry point ──────────────────────────────────
let electron
try { electron = require('electron') } catch { electron = null }

const IS_PACKAGED = electron && electron.app && electron.app.isPackaged

const API_BUNDLE = IS_PACKAGED
  ? path.join(process.resourcesPath, 'dist', 'index.js')
  : path.join(__dirname, '..', 'dist-bundle', 'index.js')

const USER_DATA = getUserDataDir()

console.log('[Aiden] Headless mode — API server only')
console.log(`[Aiden] User data: ${USER_DATA}`)
console.log(`[Aiden] Bundle:    ${API_BUNDLE}`)

// ── Spawn the API server ─────────────────────────────────────────
const child = spawn(process.execPath, [API_BUNDLE, 'serve'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    AIDEN_USER_DATA: USER_DATA,
    AIDEN_HEADLESS:  'true',
  },
})

child.on('error', err => {
  console.error('[Aiden] Failed to start API server:', err.message)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    console.log(`[Aiden] API server killed by signal: ${signal}`)
  } else {
    console.log(`[Aiden] API server exited with code: ${code}`)
  }
  process.exit(code ?? 0)
})

// Forward termination signals to the child
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`[Aiden] ${sig} received — shutting down API server`)
    child.kill(sig)
  })
}
