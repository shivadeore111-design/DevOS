// ============================================================
// Aiden — Electron Main Process
// Copyright (c) 2026 Taracod / White Lotus. All rights reserved.
// ============================================================
'use strict'

const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, shell, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
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
let apiProcess    = null
let isQuitting    = false

const isCliMode   = process.argv.includes('--cli')

// ── Paths ─────────────────────────────────────────────────────
const IS_PACKAGED = app.isPackaged
const USER_DATA   = app.getPath('userData')
const RESOURCES   = IS_PACKAGED ? process.resourcesPath : path.join(__dirname, '..')

const DIST_DIR    = IS_PACKAGED
  ? path.join(process.resourcesPath, 'dist')
  : path.join(__dirname, '..', 'dist')

// Bundle paths used by --cli mode (resolve from resources/dist in packaged app,
// or from dist-bundle/ in dev where esbuild outputs the CLI bundle)
const CLI_BUNDLE  = IS_PACKAGED
  ? path.join(process.resourcesPath, 'dist', 'cli.js')
  : path.join(__dirname, '..', 'dist-bundle', 'cli.js')
const API_BUNDLE  = IS_PACKAGED
  ? path.join(process.resourcesPath, 'dist', 'index.js')
  : path.join(__dirname, '..', 'dist-bundle', 'index.js')
const DASH_DIR    = IS_PACKAGED
  ? path.join(process.resourcesPath, 'dashboard', 'standalone')
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

  // ── Seed workspace template files (only if not already present) ──
  // These ship as resources and are copied to the user's workspace on first boot.
  // We never overwrite existing files to preserve user customizations.
  const WORKSPACE_TEMPLATES_SRC = IS_PACKAGED
    ? path.join(process.resourcesPath, 'workspace-templates')
    : path.join(__dirname, '..', 'workspace-templates')

  const WORKSPACE_TEMPLATE_FILES = ['SOUL.md', 'STANDING_ORDERS.md', 'HEARTBEAT.md']
  for (const file of WORKSPACE_TEMPLATE_FILES) {
    const dest = path.join(WORKSPACE, file)
    const src  = path.join(WORKSPACE_TEMPLATES_SRC, file)
    if (!fs.existsSync(dest) && fs.existsSync(src)) {
      try {
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        fs.copyFileSync(src, dest)
        log(`[Seed] Copied ${file} to workspace`)
      } catch (e) { log(`[Seed] Failed to copy ${file}: ${e.message}`) }
    }
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

// ── Wait for API to become ready ─────────────────────────────
async function waitForApi (url, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(500) })
      if (res.ok) {
        // Validate we got a real health response, not a proxy/other service
        try {
          const body = await res.json()
          if (body && body.status === 'ok') return true
        } catch { /* not a valid health response, keep waiting */ }
      }
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`API did not become ready within ${timeoutMs}ms`)
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
      `typeof setStatus === 'function' && setStatus(${JSON.stringify(msg)})`
    ).catch(() => {})
  }
}

function setLoadingError (msg) {
  log('LOADING ERROR: ' + msg)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(
      `typeof showError === 'function' && showError(${JSON.stringify(msg)}, ${JSON.stringify(LOG_FILE.replace(/\\/g, '/'))})`
    ).catch(() => {})
  }
}

// ── Main window with inline loading screen ────────────────────
function createMainWindow () {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png')

  mainWindow = new BrowserWindow({
    width:   1280,
    height:  900,
    minWidth:  900,
    minHeight: 700,
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

  const loadingHtml = path.join(__dirname, 'loading.html')
  mainWindow.loadFile(loadingHtml)
  // Inject log path hint once DOM is ready
  mainWindow.webContents.once('dom-ready', () => {
    mainWindow.webContents.executeJavaScript(
      `document.getElementById('logHint') && (document.getElementById('logHint').textContent = 'Log: ${LOG_FILE.replace(/\\/g, '/')}')`
    ).catch(() => {})
  })

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

// ── electron-updater setup ────────────────────────────────────
function setupAutoUpdater () {
  autoUpdater.autoDownload        = true   // download in background silently
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    log(`[Update] New version available: ${info.version}`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', {
        version:      info.version,
        releaseNotes: info.releaseNotes,
        releaseDate:  info.releaseDate,
      })
    }
  })

  autoUpdater.on('update-not-available', () => {
    log('[Update] Already on latest version')
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-not-available')
    }
  })

  autoUpdater.on('download-progress', (progress) => {
    log(`[Update] Download: ${Math.round(progress.percent)}%`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-progress', {
        percent:     Math.round(progress.percent),
        transferred: progress.transferred,
        total:       progress.total,
        speed:       progress.bytesPerSecond,
      })
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    log(`[Update] Downloaded: ${info.version} — ready to install`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', { version: info.version })
    }
  })

  autoUpdater.on('error', (err) => {
    log(`[Update] Error: ${err.message}`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', { message: err.message })
    }
  })

  // IPC handlers for user-initiated actions
  ipcMain.on('download-update', () => {
    log('[Update] User requested download')
    autoUpdater.downloadUpdate().catch(err => log(`[Update] Download error: ${err.message}`))
  })

  ipcMain.on('install-update', () => {
    log('[Update] User requested install — quitting and installing')
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.on('check-update', () => {
    log('[Update] Manual check requested')
    autoUpdater.checkForUpdates().catch(err => log(`[Update] Check error: ${err.message}`))
  })

  // IPC handle aliases for prompt-spec-compliant API (alongside ipcMain.on handlers above)
  ipcMain.handle('install-update-now', () => {
    log('[Update] install-update-now invoked')
    autoUpdater.quitAndInstall(false, true)
  })
  ipcMain.handle('check-for-update', () => {
    log('[Update] check-for-update invoked')
    return autoUpdater.checkForUpdates().catch(err => {
      log(`[Update] Check error: ${err.message}`)
      return null
    })
  })

  // Auto-check 30s after launch — use checkForUpdatesAndNotify for native OS notification
  setTimeout(() => {
    if (!app.isPackaged) return
    log('[Update] Checking for updates...')
    autoUpdater.checkForUpdatesAndNotify().catch(err => log(`[Update] Check failed: ${err.message}`))
  }, 30000)
}

// Keep old name as alias so existing call site still works
const scheduleUpdateCheck = setupAutoUpdater

// ── Start API server as child process ────────────────────────
function startApiServer () {
  const nodeBin = findNodeBin()
  const indexJs = path.join(DIST_DIR, 'index.js')
  log(`Checking API entry: ${indexJs} (exists: ${fs.existsSync(indexJs)})`)

  if (!fs.existsSync(indexJs)) {
    const msg = `API server not found at:\n${indexJs}\n\nThis is a build issue. Please reinstall Aiden.\n\nLog: ${LOG_FILE}`
    log('ERROR: ' + msg)
    dialog.showErrorBox('Aiden — Missing Files', msg)
    return
  }

  log(`Spawning API server: ${nodeBin} ${indexJs} serve`)

  const nodePath = IS_PACKAGED
    ? path.join(process.resourcesPath, 'node_modules')
    : path.join(__dirname, '..', 'node_modules')

  apiProcess = spawn(nodeBin, [indexJs, 'serve'], {
    cwd:   IS_PACKAGED ? path.join(process.resourcesPath, 'dist') : USER_DATA,
    env:   {
      ...process.env,
      AIDEN_USER_DATA: USER_DATA,
      NODE_ENV:        'production',
      NODE_PATH:       nodePath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const apiLog    = path.join(LOGS_DIR, 'api.log')
  const logStream = fs.createWriteStream(apiLog, { flags: 'a' })
  let   crashCount = 0

  apiProcess.stdout.on('data', (d) => {
    const text = d.toString().trim()
    logStream.write(d)
    log('API OUT: ' + text)
  })

  apiProcess.stderr.on('data', (d) => {
    const text = d.toString().trim()
    logStream.write(d)
    log('API ERR: ' + text)
  })

  apiProcess.on('error', (err) => {
    log(`API SPAWN ERROR: ${err.message}`)
    dialog.showMessageBox(mainWindow, {
      type:    'error',
      title:   'Aiden — Could not start API server',
      message: 'Failed to launch the API server process.',
      detail:  `Error: ${err.message}\n\nNode.js used: ${nodeBin}\nLog file: ${LOG_FILE}\n\nPlease send this log to hello@taracod.com`,
      buttons: ['Open Log File', 'OK'],
    }).then(({ response }) => { if (response === 0) shell.openPath(LOG_FILE) })
  })

  apiProcess.on('exit', (code, signal) => {
    log(`API EXIT: code=${code} signal=${signal}`)
    if (!isQuitting) {
      crashCount++
      if (crashCount >= 3) {
        log('API server crashed 3 times — showing error dialog')
        dialog.showMessageBox(mainWindow || null, {
          type:    'error',
          title:   'Aiden — API server keeps crashing',
          message: `API server exited with code ${code}`,
          detail:  `Crashed ${crashCount} times.\n\nLog file: ${LOG_FILE}\n\nPlease send this log to hello@taracod.com`,
          buttons: ['Open Log File', 'OK'],
        }).then(({ response }) => { if (response === 0) shell.openPath(LOG_FILE) })
        return
      }
      log(`Restarting API server in 2s (crash #${crashCount})`)
      setTimeout(startApiServer, 2000)
    }
  })
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
      PORT:      '3000',
      HOSTNAME:  '127.0.0.1',
      NODE_ENV:  'production',
      NODE_PATH: path.join(DASH_DIR, 'node_modules'),
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

// ── Poll until API is ready (async/Promise version — used by CLI branch) ──────
async function waitForApi (url, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const body = await res.json()
        if (body.status === 'ok') {
          log('API ready')
          return
        }
      }
    } catch { /* not ready yet — keep polling */ }
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error(`API did not respond within ${timeoutMs}ms`)
}

// ── Poll until API is ready (callback version — used by GUI branch) ───────────
function waitForApiCallback (onReady, onFail, retries = 40) {
  const req = http.get('http://127.0.0.1:4200/api/health', (res) => {
    if (res.statusCode === 200) {
      log('API ready')
      onReady()
    } else if (retries > 0) {
      setTimeout(() => waitForApiCallback(onReady, onFail, retries - 1), 1000)
    } else {
      onFail('API server did not respond after 40 seconds')
    }
    res.resume()
  })
  req.on('error', () => {
    if (retries > 0) setTimeout(() => waitForApiCallback(onReady, onFail, retries - 1), 1000)
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

if (isCliMode) {
  // ── CLI mode — no window, no tray, no dashboard ───────────────
  // Electron's bundled Node runs the CLI bundle via ELECTRON_RUN_AS_NODE=1,
  // so end users need zero system dependencies.
  if (process.platform === 'darwin' && app.dock) app.dock.hide()

  app.whenReady().then(async () => {
    try { fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true }) } catch { /* ignore */ }
    try { fs.mkdirSync(LOGS_DIR, { recursive: true }) } catch { /* ignore */ }
    log('=== Aiden CLI mode ===')
    bootstrapUserData()

    // Start API server as isolated child process so its stdout/stderr cannot
    // pollute the CLI terminal and a crash in the API server cannot block the CLI spawn.
    if (fs.existsSync(API_BUNDLE)) {
      const apiChild = spawn(process.execPath, [API_BUNDLE], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env:   {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          AIDEN_USER_DATA:  USER_DATA,
          AIDEN_WORKSPACE:  WORKSPACE,
          AIDEN_CONFIG_DIR: CONFIG_DIR,
        },
      })
      const apiErrLines = []
      apiChild.stdout.on('data', d => log('[API] ' + d.toString().trim()))
      apiChild.stderr.on('data', d => {
        const line = d.toString().trim()
        apiErrLines.push(line)
        log('[API-ERR] ' + line)
      })
      process.on('exit', () => { try { apiChild.kill() } catch {} })
      log(`[CLI] API server spawned (pid ${apiChild.pid})`)

      // Wait for the API to accept connections before starting the CLI
      try {
        await waitForApi('http://localhost:4200/api/health', 10000)
        log('[CLI] API ready at http://localhost:4200')
      } catch (waitErr) {
        log('[CLI] API server failed to start after 10s')
        if (apiErrLines.length) log('[CLI] Last API errors:\n  ' + apiErrLines.slice(-5).join('\n  '))
        log(`[CLI] Check logs at ${LOG_FILE}`)
        app.exit(1)
        return
      }
    } else {
      log(`[CLI] API bundle not found at ${API_BUNDLE} — tools may be unavailable`)
    }

    // Spawn CLI using Electron's own executable (ELECTRON_RUN_AS_NODE=1 = pure Node, no Chromium)
    if (!fs.existsSync(CLI_BUNDLE)) {
      console.error(`[Aiden] CLI bundle not found: ${CLI_BUNDLE}`)
      console.error('  Run: npm run build:cli')
      app.exit(1)
      return
    }
    const cliArgs = process.argv.slice(2).filter(a => a !== '--cli')
    const child   = spawn(process.execPath, [CLI_BUNDLE, ...cliArgs], {
      stdio: 'inherit',
      env:   { ...process.env, ELECTRON_RUN_AS_NODE: '1', AIDEN_CLI_MODE: '1', AIDEN_LOG_FILE: LOG_FILE },
    })
    child.on('exit', (code) => app.exit(code ?? 0))
  })

} else {
  // ── GUI mode ──────────────────────────────────────────────────
  app.whenReady().then(async () => {
    // Ensure log directory exists before first log() call
    try { fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true }) } catch { /* ignore */ }
    try { fs.mkdirSync(LOGS_DIR, { recursive: true }) } catch { /* ignore */ }
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
    waitForApiCallback(
      () => {
        setStatus('API ready — waiting for dashboard...')
        waitForDash(
          () => {
            setStatus('All systems ready!')
            loadDashboard()
            scheduleUpdateCheck()
          },
          (reason) => {
            log(`Dashboard wait FAILED: ${reason}`)
            setLoadingError(`Dashboard failed to start.\n${reason}\n\nPlease check the log file.`)
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
        setLoadingError(`API server failed to start.\n${reason}\n\nPlease check the log file.`)
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
    if (apiProcess) {
      try { apiProcess.kill('SIGTERM') } catch { /* ignore */ }
    }
    if (dashProcess) {
      try { dashProcess.kill('SIGTERM') } catch { /* ignore */ }
    }
  })
}
