// ============================================================
// Aiden — Electron Main Process
// Copyright (c) 2026 Taracod / White Lotus. All rights reserved.
// ============================================================
'use strict'

const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, shell } = require('electron')
const { spawn, execSync }  = require('child_process')
const path  = require('path')
const http  = require('http')
const net   = require('net')
const fs    = require('fs')
const os    = require('os')

// ── State ─────────────────────────────────────────────────────
let mainWindow    = null
let tray          = null
let dashProcess   = null
let isQuitting    = false

// ── Paths ─────────────────────────────────────────────────────
const IS_PACKAGED = app.isPackaged
const USER_DATA   = app.getPath('userData')
const RESOURCES   = IS_PACKAGED ? process.resourcesPath : path.join(__dirname, '..')

const DIST_DIR    = IS_PACKAGED
  ? path.join(__dirname, '..', 'dist')
  : path.join(__dirname, '..', 'dist')
const DASH_DIR    = IS_PACKAGED
  ? path.join(RESOURCES, 'dashboard', 'standalone')
  : path.join(__dirname, '..', 'dashboard-next', '.next', 'standalone')
const CONFIG_SRC  = IS_PACKAGED
  ? path.join(RESOURCES, 'config')
  : path.join(__dirname, '..', 'config')
const CONFIG_DIR  = path.join(USER_DATA, 'config')
const WORKSPACE   = path.join(USER_DATA, 'workspace')
const LOGS_DIR    = path.join(USER_DATA, 'logs')
const LOG_FILE    = path.join(USER_DATA, 'aiden.log')

// ── Logging ───────────────────────────────────────────────────
function log (msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { fs.appendFileSync(LOG_FILE, line) } catch { /* ignore */ }
  console.log(msg)
}

// ── Bootstrap user data dirs ──────────────────────────────────
function bootstrapUserData () {
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

  if (fs.existsSync(CONFIG_SRC)) {
    const defaults = fs.readdirSync(CONFIG_SRC)
    for (const f of defaults) {
      const dest = path.join(CONFIG_DIR, f)
      if (!fs.existsSync(dest) && f !== 'whatsapp-auth') {
        try {
          const src = path.join(CONFIG_SRC, f)
          if (fs.statSync(src).isFile()) fs.copyFileSync(src, dest)
        } catch { /* skip */ }
      }
    }
  }

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

  try { process.chdir(USER_DATA) } catch { /* non-fatal */ }
}

// ── Find system Node.js ───────────────────────────────────────
function findNodeBin () {
  if (process.platform === 'win32') {
    try {
      const result = execSync('where.exe node.exe', { encoding: 'utf8', stdio: 'pipe', timeout: 3000 })
      const found  = result.trim().split('\n')[0].trim()
      if (found && fs.existsSync(found)) return found
    } catch { /* fall through */ }
    for (const p of [
      'C:\\Program Files\\nodejs\\node.exe',
      'C:\\Program Files (x86)\\nodejs\\node.exe',
      path.join(os.homedir(), 'AppData', 'Roaming', 'nvm', 'current', 'node.exe'),
    ]) {
      if (fs.existsSync(p)) return p
    }
  }
  try {
    const result = execSync('which node', { encoding: 'utf8', stdio: 'pipe', timeout: 3000 })
    const found  = result.trim()
    if (found) return found
  } catch { /* fall through */ }
  return 'node'
}

// ── Node.js version check ─────────────────────────────────────
function checkNodeJs () {
  try {
    const nodeBin = findNodeBin()
    const version = execSync(`"${nodeBin}" --version`, { encoding: 'utf8', stdio: 'pipe', timeout: 5000 }).trim()
    const major   = parseInt(version.replace('v', '').split('.')[0], 10)
    log(`Node.js found: ${version} at ${nodeBin}`)
    if (major < 18) {
      dialog.showErrorBox(
        'Node.js Update Required',
        `Aiden needs Node.js 18 or newer.\n\nYou have: ${version}\n\nPlease download and install Node.js from:\nhttps://nodejs.org\n\nThen restart Aiden.`
      )
      app.quit()
      return false
    }
    return true
  } catch (e) {
    dialog.showErrorBox(
      'Node.js Not Found',
      'Aiden needs Node.js to run.\n\nPlease install Node.js 18+ from:\nhttps://nodejs.org/en/download\n\nChoose the "Windows Installer (.msi)" option.\nThen restart Aiden.'
    )
    app.quit()
    return false
  }
}

// ── Ollama check ──────────────────────────────────────────────
function checkOllama () {
  try { execSync('ollama --version', { stdio: 'pipe', timeout: 3000 }); return true }
  catch { return false }
}

// ── Port availability check ───────────────────────────────────
function checkPort (port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))   // port in use
    server.once('listening', () => { server.close(); resolve(true) })
    server.listen(port, '127.0.0.1')
  })
}

// ── Kill processes on a port (Windows) ───────────────────────
async function freePort (port) {
  log(`Port ${port} in use — attempting to free it`)
  try {
    execSync(`for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port}') do taskkill /F /PID %a`,
      { stdio: 'ignore', shell: true, timeout: 5000 })
  } catch { /* ignore errors */ }
  await new Promise(r => setTimeout(r, 1500))
}

// ── Update loading status text in main window ─────────────────
function setStatus (msg) {
  log(msg)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(
      `document.getElementById('s') && (document.getElementById('s').textContent = ${JSON.stringify(msg)})`
    ).catch(() => {})
  }
}

// ── Main window with inline loading screen ────────────────────
function createMainWindow () {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png')

  mainWindow = new BrowserWindow({
    width:   1280,
    height:  800,
    minWidth:  900,
    minHeight: 600,
    show:      false,
    title:     'Aiden',
    backgroundColor: '#0e0e0e',
    icon:    fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow.loadURL(`data:text/html,<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:%230e0e0e;color:%23e8e8e8;font-family:'Segoe UI',monospace;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  height:100vh;gap:16px;user-select:none}
.logo{width:64px;height:64px;background:%23f97316;border-radius:14px;
  display:flex;align-items:center;justify-content:center;
  font-family:monospace;font-size:26px;font-weight:900;color:%23000}
h1{font-size:24px;font-weight:700;letter-spacing:-0.5px;color:%23e8e8e8}
#s{font-size:12px;color:%23555;font-family:monospace;max-width:400px;text-align:center}
.dots{display:flex;gap:6px;margin-top:4px}
.dot{width:7px;height:7px;background:%23f97316;border-radius:50%;
  animation:pulse 1.4s ease-in-out infinite}
.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}
@keyframes pulse{0%,100%{opacity:.2;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
.log-hint{font-size:10px;color:%23333;position:fixed;bottom:16px;font-family:monospace}
</style></head>
<body>
  <div class="logo">A/</div>
  <h1>Aiden</h1>
  <div id="s">Starting up...</div>
  <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
  <div class="log-hint">Log: ${LOG_FILE.replace(/\\/g, '/')}</div>
</body></html>`)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.setMenuBarVisibility(false)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); mainWindow.hide() }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── Navigate main window to dashboard ────────────────────────
function loadDashboard () {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const identityPath   = path.join(WORKSPACE, 'identity.json')
  const onboardingPath = path.join(WORKSPACE, 'onboarding-complete.json')
  const isFirstRun     = !fs.existsSync(identityPath) && !fs.existsSync(onboardingPath)

  try {
    fs.writeFileSync(
      path.join(USER_DATA, 'system-status.json'),
      JSON.stringify({ ollamaInstalled: checkOllama(), firstRun: isFirstRun }),
      'utf-8'
    )
  } catch { /* non-fatal */ }

  const startUrl = isFirstRun ? 'http://localhost:3000/onboarding' : 'http://localhost:3000'
  log(`Loading dashboard: ${startUrl}`)
  mainWindow.loadURL(startUrl)
}

// ── Start API server in-process ───────────────────────────────
function startApiServer () {
  try {
    process.env.AIDEN_USER_DATA = USER_DATA
    process.env.NODE_ENV        = 'production'
    log(`Loading API server from: ${path.join(DIST_DIR, 'api', 'server.js')}`)
    const serverMod = require(path.join(DIST_DIR, 'api', 'server.js'))
    if (typeof serverMod.startApiServer === 'function') {
      serverMod.startApiServer(4200)
      log('API server started on port 4200')
    } else {
      throw new Error('startApiServer export not found in dist/api/server.js')
    }
  } catch (err) {
    log(`API server FAILED: ${err.message}\n${err.stack}`)
    // Non-fatal — show error but continue (dashboard may still work)
    setStatus(`Warning: API server failed to start — ${err.message}`)
  }
}

// ── Start Next.js dashboard ───────────────────────────────────
function startDashboard () {
  const serverJs = path.join(DASH_DIR, 'server.js')
  log(`Dashboard server.js path: ${serverJs}`)
  log(`Dashboard server.js exists: ${fs.existsSync(serverJs)}`)

  if (!fs.existsSync(serverJs)) {
    const msg = `Dashboard not found at:\n${serverJs}\n\nThis is a build issue. Please reinstall Aiden.\n\nLog: ${LOG_FILE}`
    log('ERROR: ' + msg)
    dialog.showErrorBox('Aiden — Missing Files', msg)
    return
  }

  const nodeBin = findNodeBin()
  log(`Starting dashboard with Node: ${nodeBin}`)
  setStatus('Starting dashboard...')

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

  const dashLog  = path.join(LOGS_DIR, 'dashboard.log')
  const logStream = fs.createWriteStream(dashLog, { flags: 'a' })
  let   crashCount = 0

  dashProcess.stdout.on('data', (d) => {
    const text = d.toString().trim()
    logStream.write(d)
    log('DASH OUT: ' + text)
  })

  dashProcess.stderr.on('data', (d) => {
    const text = d.toString().trim()
    logStream.write(d)
    log('DASH ERR: ' + text)
  })

  dashProcess.on('error', (err) => {
    log(`DASH SPAWN ERROR: ${err.message}`)
    dialog.showMessageBox(mainWindow, {
      type:    'error',
      title:   'Aiden — Could not start dashboard',
      message: 'Failed to launch the dashboard process.',
      detail:  `Error: ${err.message}\n\nNode.js used: ${nodeBin}\nLog file: ${LOG_FILE}\n\nPlease send this log to hello@taracod.com`,
      buttons: ['Open Log File', 'OK'],
    }).then(({ response }) => { if (response === 0) shell.openPath(LOG_FILE) })
  })

  dashProcess.on('exit', (code, signal) => {
    log(`DASH EXIT: code=${code} signal=${signal}`)
    if (!isQuitting) {
      crashCount++
      if (crashCount >= 3) {
        log('Dashboard crashed 3 times — showing error dialog')
        dialog.showMessageBox(mainWindow || null, {
          type:    'error',
          title:   'Aiden — Dashboard keeps crashing',
          message: `Server exited with code ${code}`,
          detail:  `Crashed ${crashCount} times.\n\nLog file: ${LOG_FILE}\n\nPlease send this log to hello@taracod.com`,
          buttons: ['Open Log File', 'OK'],
        }).then(({ response }) => { if (response === 0) shell.openPath(LOG_FILE) })
        return
      }
      log(`Restarting dashboard in 2s (crash #${crashCount})`)
      setTimeout(startDashboard, 2000)
    }
  })
}

// ── Poll until API is ready ───────────────────────────────────
function waitForApi (onReady, onFail, retries = 40) {
  const req = http.get('http://127.0.0.1:4200/api/health', (res) => {
    if (res.statusCode === 200) {
      log('API ready')
      onReady()
    } else if (retries > 0) {
      setTimeout(() => waitForApi(onReady, onFail, retries - 1), 1000)
    } else {
      onFail('API server did not respond after 40 seconds')
    }
    res.resume()
  })
  req.on('error', () => {
    if (retries > 0) setTimeout(() => waitForApi(onReady, onFail, retries - 1), 1000)
    else onFail('API server did not start (connection refused after 40s)')
  })
  req.setTimeout(900, () => req.destroy())
}

// ── Poll until dashboard is ready ─────────────────────────────
function waitForDash (onReady, onFail, retries = 40) {
  const req = http.get('http://127.0.0.1:3000/', (res) => {
    if (res.statusCode < 500) {
      log('Dashboard ready')
      onReady()
    } else if (retries > 0) {
      setTimeout(() => waitForDash(onReady, onFail, retries - 1), 1000)
    } else {
      onFail('Dashboard did not respond after 40 seconds')
    }
    res.resume()
  })
  req.on('error', () => {
    if (retries > 0) setTimeout(() => waitForDash(onReady, onFail, retries - 1), 1000)
    else onFail('Dashboard did not start (connection refused after 40s)')
  })
  req.setTimeout(900, () => req.destroy())
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
        if (!mainWindow) { createMainWindow(); return }
        if (mainWindow.isVisible()) mainWindow.hide()
        else { mainWindow.show(); mainWindow.focus() }
        tray.setContextMenu(buildMenu())
      },
    },
    { type: 'separator' },
    { label: 'Open in Browser', click () { shell.openExternal('http://localhost:3000') } },
    { label: 'Open Log File',   click () { shell.openPath(LOG_FILE) } },
    { type: 'separator' },
    { label: 'Quit Aiden', click () { isQuitting = true; app.quit() } },
  ])

  tray.setContextMenu(buildMenu())
  tray.on('click', () => {
    if (!mainWindow) { createMainWindow(); return }
    if (mainWindow.isVisible()) mainWindow.focus()
    else { mainWindow.show(); mainWindow.focus() }
  })
  tray.on('right-click', () => {
    tray.setContextMenu(buildMenu())
    tray.popUpContextMenu()
  })
}

// ── App lifecycle ─────────────────────────────────────────────
app.whenReady().then(async () => {
  log('=== Aiden starting ===')
  log(`userData: ${USER_DATA}`)
  log(`IS_PACKAGED: ${IS_PACKAGED}`)
  log(`DIST_DIR: ${DIST_DIR}`)
  log(`DASH_DIR: ${DASH_DIR}`)

  // 0. Verify Node.js
  if (!checkNodeJs()) return

  // 1. Bootstrap dirs
  bootstrapUserData()

  // 2. Show main window immediately with loading screen
  createMainWindow()

  // 3. Create tray
  createTray()

  // 4. Free port 4200 if occupied
  setStatus('Checking ports...')
  const port4200free = await checkPort(4200)
  if (!port4200free) {
    log('Port 4200 in use — freeing it')
    setStatus('Freeing port 4200...')
    await freePort(4200)
  }

  // 5. Start API server in-process
  setStatus('Starting API server...')
  startApiServer()

  // 6. Start Next.js dashboard
  setStatus('Starting dashboard...')
  startDashboard()

  // 7. Wait for API, then dashboard, then navigate
  setStatus('Waiting for API server (up to 40s)...')
  waitForApi(
    () => {
      setStatus('API ready — waiting for dashboard...')
      waitForDash(
        () => {
          setStatus('All systems ready!')
          loadDashboard()
        },
        (reason) => {
          log(`Dashboard wait FAILED: ${reason}`)
          setStatus(`Dashboard failed: ${reason}`)
          dialog.showMessageBox(mainWindow, {
            type:    'error',
            title:   'Aiden — Dashboard timed out',
            message: 'The dashboard did not start in time.',
            detail:  `${reason}\n\nLog file: ${LOG_FILE}\n\nPlease send this log to hello@taracod.com`,
            buttons: ['Open Log File', 'Keep Waiting', 'Quit'],
          }).then(({ response }) => {
            if (response === 0) shell.openPath(LOG_FILE)
            if (response === 2) { isQuitting = true; app.quit() }
          })
        }
      )
    },
    (reason) => {
      log(`API wait FAILED: ${reason}`)
      setStatus(`API failed: ${reason}`)
      dialog.showMessageBox(mainWindow, {
        type:    'error',
        title:   'Aiden — API server timed out',
        message: 'The Aiden API server did not start in time.',
        detail:  `${reason}\n\nLog file: ${LOG_FILE}\n\nPlease send this log to hello@taracod.com`,
        buttons: ['Open Log File', 'Keep Waiting', 'Quit'],
      }).then(({ response }) => {
        if (response === 0) shell.openPath(LOG_FILE)
        if (response === 2) { isQuitting = true; app.quit() }
      })
    }
  )
})

app.on('window-all-closed', (e) => {
  if (!isQuitting) e.preventDefault()
})

app.on('activate', () => {
  if (!mainWindow) createMainWindow()
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  if (dashProcess) {
    try { dashProcess.kill('SIGTERM') } catch { /* ignore */ }
  }
})
