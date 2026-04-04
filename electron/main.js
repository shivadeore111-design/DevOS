// ============================================================
// Aiden — Electron Main Process
// Copyright (c) 2026 Taracod / White Lotus. All rights reserved.
// ============================================================
'use strict'

const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, shell } = require('electron')
const { spawn, execSync }  = require('child_process')
const path  = require('path')
const http  = require('http')
const fs    = require('fs')
const os    = require('os')

// ── State ─────────────────────────────────────────────────────
let mainWindow    = null
let tray          = null
let dashProcess   = null
let splashWindow  = null
let isQuitting    = false

// ── Paths ─────────────────────────────────────────────────────
const IS_PACKAGED = app.isPackaged
const USER_DATA   = app.getPath('userData')
const RESOURCES   = IS_PACKAGED ? process.resourcesPath : path.join(__dirname, '..')

// Inside packaged app:  resources/app.asar/electron/main.js
// dist/ is inside the asar, require()d fine by Node's asar patching
const DIST_DIR    = IS_PACKAGED
  ? path.join(__dirname, '..', 'dist')                   // asar virtual path
  : path.join(__dirname, '..', 'dist')
const DASH_DIR    = IS_PACKAGED
  ? path.join(RESOURCES, 'dashboard', 'standalone')      // extraResource
  : path.join(__dirname, '..', 'dashboard-next', '.next', 'standalone')
const CONFIG_SRC  = IS_PACKAGED
  ? path.join(RESOURCES, 'config')                       // extraResource default config
  : path.join(__dirname, '..', 'config')
const CONFIG_DIR  = path.join(USER_DATA, 'config')
const WORKSPACE   = path.join(USER_DATA, 'workspace')
const LOGS_DIR    = path.join(USER_DATA, 'logs')

// ── Bootstrap user data dirs ──────────────────────────────────
function bootstrapUserData () {
  // Create required directories
  for (const dir of [
    CONFIG_DIR,
    path.join(WORKSPACE, 'sandbox'),
    path.join(WORKSPACE, 'uploads'),
    path.join(WORKSPACE, 'artifacts'),
    path.join(WORKSPACE, 'memory'),
    LOGS_DIR,
  ]) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Copy default config files on first run (don't overwrite existing)
  if (fs.existsSync(CONFIG_SRC)) {
    const defaults = fs.readdirSync(CONFIG_SRC)
    for (const f of defaults) {
      const dest = path.join(CONFIG_DIR, f)
      if (!fs.existsSync(dest) && f !== 'whatsapp-auth') {
        try {
          const src = path.join(CONFIG_SRC, f)
          if (fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dest)
          }
        } catch { /* skip */ }
      }
    }
  }

  // Write a clean default config if devos.config.json doesn't exist
  const cfgPath = path.join(CONFIG_DIR, 'devos.config.json')
  if (!fs.existsSync(cfgPath)) {
    fs.writeFileSync(cfgPath, JSON.stringify({
      user:    { name: '' },
      model:   { active: 'ollama', activeModel: 'mistral-nemo:12b' },
      providers: { ollama: { enabled: true, models: [] }, apis: [] },
      onboardingComplete: false,
      routing: { mode: 'auto', fallbackToOllama: true }
    }, null, 2), 'utf-8')
  }

  // Change cwd so server.ts path.join(process.cwd(), ...) resolves to userData
  try { process.chdir(USER_DATA) } catch { /* non-fatal */ }
}

// ── Find system Node.js (for spawning dashboard) ──────────────
function findNodeBin () {
  // Try where.exe on Windows first
  if (process.platform === 'win32') {
    try {
      const result = execSync('where.exe node.exe', { encoding: 'utf8', stdio: 'pipe', timeout: 3000 })
      const found  = result.trim().split('\n')[0].trim()
      if (found && fs.existsSync(found)) return found
    } catch { /* fall through */ }
    // Common install paths
    for (const p of [
      'C:\\Program Files\\nodejs\\node.exe',
      'C:\\Program Files (x86)\\nodejs\\node.exe',
      path.join(os.homedir(), 'AppData', 'Roaming', 'nvm', 'current', 'node.exe'),
    ]) {
      if (fs.existsSync(p)) return p
    }
  }
  // macOS / Linux
  try {
    const result = execSync('which node', { encoding: 'utf8', stdio: 'pipe', timeout: 3000 })
    const found  = result.trim()
    if (found) return found
  } catch { /* fall through */ }
  return 'node' // last resort — hope it's in PATH
}

// ── Ollama check ──────────────────────────────────────────────
function checkOllama () {
  try { execSync('ollama --version', { stdio: 'pipe', timeout: 3000 }); return true }
  catch { return false }
}

// ── Start API server in-process (runs inside main process) ────
// This means dist/ code is NEVER exposed on the filesystem and is
// fully protected inside app.asar
function startApiServer () {
  try {
    // Override process.cwd() result used by server paths
    process.env.AIDEN_USER_DATA = USER_DATA
    process.env.NODE_ENV        = 'production'

    // Require API server module directly — works because Electron's Node.js
    // patched require() transparently reads from .asar archives
    const serverMod = require(path.join(DIST_DIR, 'api', 'server.js'))
    if (typeof serverMod.startApiServer === 'function') {
      serverMod.startApiServer(4200)
      console.log('[Aiden] API server started on port 4200')
    } else {
      throw new Error('startApiServer export not found')
    }
  } catch (err) {
    console.error('[Aiden] Failed to start API server:', err.message)
    // Non-fatal — dashboard can still load, API calls will fail gracefully
  }
}

// ── Start Next.js dashboard as child process ──────────────────
function startDashboard () {
  const serverJs = path.join(DASH_DIR, 'server.js')
  if (!fs.existsSync(serverJs)) {
    console.error('[Aiden] Dashboard server.js not found at:', serverJs)
    return
  }

  const nodeBin = findNodeBin()
  console.log('[Aiden] Starting dashboard with:', nodeBin)

  dashProcess = spawn(nodeBin, [serverJs], {
    cwd: DASH_DIR,
    env: {
      ...process.env,
      PORT:     '3000',
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const logFile = path.join(LOGS_DIR, 'dashboard.log')
  const logStream = fs.createWriteStream(logFile, { flags: 'a' })

  dashProcess.stdout.on('data', d => {
    logStream.write(d)
    console.log('[Dashboard]', d.toString().trim())
  })
  dashProcess.stderr.on('data', d => {
    logStream.write(d)
    console.error('[Dashboard]', d.toString().trim())
  })
  dashProcess.on('exit', (code) => {
    console.log('[Dashboard] exited with code', code)
    if (!isQuitting) {
      // Restart after 2 s if it crashed
      setTimeout(startDashboard, 2000)
    }
  })
}

// ── Poll until API is ready ───────────────────────────────────
function waitForApi (cb, retries = 40) {
  const req = http.get('http://127.0.0.1:4200/api/health', (res) => {
    if (res.statusCode === 200) {
      console.log('[Aiden] API ready')
      cb()
    } else if (retries > 0) {
      setTimeout(() => waitForApi(cb, retries - 1), 1000)
    }
    res.resume()
  })
  req.on('error', () => {
    if (retries > 0) setTimeout(() => waitForApi(cb, retries - 1), 1000)
  })
  req.setTimeout(900, () => req.destroy())
}

// ── Poll until dashboard is ready ─────────────────────────────
function waitForDash (cb, retries = 40) {
  const req = http.get('http://127.0.0.1:3000/', (res) => {
    if (res.statusCode < 500) { console.log('[Aiden] Dashboard ready'); cb() }
    else if (retries > 0) setTimeout(() => waitForDash(cb, retries - 1), 1000)
    res.resume()
  })
  req.on('error', () => {
    if (retries > 0) setTimeout(() => waitForDash(cb, retries - 1), 1000)
  })
  req.setTimeout(900, () => req.destroy())
}

// ── Splash window while services start ───────────────────────
function createSplash () {
  splashWindow = new BrowserWindow({
    width: 400, height: 280,
    frame:         false,
    transparent:   false,
    alwaysOnTop:   true,
    resizable:     false,
    skipTaskbar:   true,
    backgroundColor: '#0e0e0e',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })

  // Inline splash HTML — no external file needed
  splashWindow.loadURL(`data:text/html,
    <html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{background:#0e0e0e;color:#e8e8e8;font-family:'Segoe UI',sans-serif;
           display:flex;flex-direction:column;align-items:center;justify-content:center;
           height:100vh;gap:16px;user-select:none}
      .logo{width:56px;height:56px;background:#f97316;border-radius:12px;
            display:flex;align-items:center;justify-content:center;
            font-family:monospace;font-size:22px;font-weight:800;color:#000}
      h1{font-size:22px;font-weight:700;letter-spacing:-0.5px}
      p{color:#666;font-size:13px}
      .dot{display:inline-block;width:6px;height:6px;background:#f97316;
           border-radius:50%;margin:0 3px;animation:pulse 1.2s ease-in-out infinite}
      .dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
      @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
    </style></head>
    <body>
      <div class="logo">A/</div>
      <h1>Aiden</h1>
      <p>Starting your personal AI OS<span class="dot"></span><span class="dot"></span><span class="dot"></span></p>
    </body></html>`)
}

// ── Main browser window ───────────────────────────────────────
function createWindow () {
  if (splashWindow) { splashWindow.close(); splashWindow = null }

  const identityPath   = path.join(WORKSPACE, 'identity.json')
  const onboardingPath = path.join(WORKSPACE, 'onboarding-complete.json')
  const isFirstRun     = !fs.existsSync(identityPath) && !fs.existsSync(onboardingPath)

  // Write system status so onboarding page can query it
  try {
    fs.writeFileSync(
      path.join(USER_DATA, 'system-status.json'),
      JSON.stringify({ ollamaInstalled: checkOllama(), firstRun: isFirstRun }),
      'utf-8'
    )
  } catch { /* non-fatal */ }

  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png')
  mainWindow = new BrowserWindow({
    width:   1280,
    height:  800,
    minWidth:  900,
    minHeight: 600,
    title:     'Aiden',
    backgroundColor: '#0e0e0e',
    icon:    fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  const startUrl = isFirstRun
    ? 'http://localhost:3000/onboarding'
    : 'http://localhost:3000'

  mainWindow.loadURL(startUrl)
  mainWindow.setMenuBarVisibility(false)

  mainWindow.webContents.on('new-window', (e, url) => {
    e.preventDefault()
    shell.openExternal(url)
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── System tray ───────────────────────────────────────────────
function createTray () {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png')
  let icon
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) throw new Error('empty')
    icon = icon.resize({ width: 16, height: 16 })
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('Aiden — Your Personal AI OS')

  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: mainWindow && mainWindow.isVisible() ? 'Hide Aiden' : 'Show Aiden',
      click () {
        if (!mainWindow) { createWindow(); return }
        if (mainWindow.isVisible()) mainWindow.hide()
        else { mainWindow.show(); mainWindow.focus() }
        tray.setContextMenu(buildMenu())
      },
    },
    { type: 'separator' },
    { label: 'Open in Browser', click () { shell.openExternal('http://localhost:3000') } },
    { type: 'separator' },
    { label: 'Quit Aiden', click () { isQuitting = true; app.quit() } },
  ])

  tray.setContextMenu(buildMenu())
  tray.on('click', () => {
    if (!mainWindow) { createWindow(); return }
    if (mainWindow.isVisible()) mainWindow.focus()
    else { mainWindow.show(); mainWindow.focus() }
  })
  tray.on('right-click', () => {
    tray.setContextMenu(buildMenu())
    tray.popUpContextMenu()
  })
}

// ── App lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  // 1. Bootstrap user data dirs + default config
  bootstrapUserData()

  // 2. Show splash while services start
  createSplash()

  // 3. Start API server in-process (asar-protected)
  startApiServer()

  // 4. Start Next.js dashboard as child process
  startDashboard()

  // 5. Create tray icon immediately
  createTray()

  // 6. Wait for both services, then open window
  waitForApi(() => {
    waitForDash(() => {
      createWindow()
    })
  })
})

// Keep app alive when all windows are closed (lives in tray)
app.on('window-all-closed', (e) => {
  if (!isQuitting) e.preventDefault()
})

app.on('activate', () => {
  // macOS: re-open on dock click
  if (!mainWindow) createWindow()
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  if (dashProcess) {
    try { dashProcess.kill('SIGTERM') } catch { /* ignore */ }
  }
})
