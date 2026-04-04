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
  version:    process.env.npm_package_version || '3.0.0',
})
