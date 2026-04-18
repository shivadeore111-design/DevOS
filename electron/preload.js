// ============================================================
// Aiden — Electron Preload Script
// Runs in renderer with contextIsolation: true
// Only expose what the dashboard actually needs
// ============================================================
'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('aidenElectron', {
  // Let the dashboard know it's running inside Electron
  isElectron: true,
  platform:   process.platform,
  version:    process.env.npm_package_version || '3.6.0',
})

// ── Auto-updater IPC bridge ───────────────────────────────────
contextBridge.exposeInMainWorld('aidenUpdater', {
  // Listen for events from main process
  onUpdateAvailable:    (cb) => ipcRenderer.on('update-available',    (_, data) => cb(data)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', ()       => cb()),
  onUpdateProgress:     (cb) => ipcRenderer.on('update-progress',     (_, data) => cb(data)),
  onUpdateDownloaded:   (cb) => ipcRenderer.on('update-downloaded',   (_, data) => cb(data)),
  onUpdateError:        (cb) => ipcRenderer.on('update-error',        (_, data) => cb(data)),

  // Send commands to main process
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate:  () => ipcRenderer.send('install-update'),
  checkUpdate:    () => ipcRenderer.send('check-update'),

  // Spec-compliant aliases (used by /refresh command and dashboard)
  installNow: () => ipcRenderer.invoke('install-update-now'),
  checkNow:   () => ipcRenderer.invoke('check-for-update'),
})
