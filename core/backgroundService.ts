// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/backgroundService.ts — PID-file-based background service manager.
// Enables `devos stop` and `devos status` CLI commands.

import path from 'path'
import fs   from 'fs'

const PID_FILE = path.join(process.cwd(), 'workspace', 'aiden.pid')

// ── startBackgroundService ─────────────────────────────────────
// Call once from `devos serve` after the API server has started.
// Writes the current PID to disk and registers cleanup handlers.

export function startBackgroundService(port = 4200): void {
  // Ensure workspace dir exists
  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true })
  fs.writeFileSync(PID_FILE, String(process.pid))

  const cleanup = () => {
    try { fs.unlinkSync(PID_FILE) } catch {}
    process.exit(0)
  }

  process.on('SIGINT',  cleanup)
  process.on('SIGTERM', cleanup)
  process.on('exit', () => { try { fs.unlinkSync(PID_FILE) } catch {} })

  console.log(`[Service] Aiden running as background service (PID: ${process.pid})`)
  console.log(`[Service] API:       http://localhost:${port}`)
  console.log(`[Service] Dashboard: http://localhost:3000`)
  console.log(`[Service] Run 'devos stop' or close this window to stop Aiden`)
}

// ── isServiceRunning ───────────────────────────────────────────
// Returns true if a PID file exists and the process is alive.

export function isServiceRunning(): boolean {
  try {
    if (!fs.existsSync(PID_FILE)) return false
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10)
    if (isNaN(pid)) return false
    process.kill(pid, 0) // throws if process doesn't exist
    return true
  } catch {
    return false
  }
}

// ── stopService ────────────────────────────────────────────────
// Sends SIGTERM to the running service process via its PID file.

export function stopService(): void {
  try {
    if (!fs.existsSync(PID_FILE)) {
      console.log('[Service] No running instance found (no PID file)')
      return
    }
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10)
    if (isNaN(pid)) {
      console.log('[Service] PID file corrupt — removing')
      fs.unlinkSync(PID_FILE)
      return
    }
    process.kill(pid, 'SIGTERM')
    console.log(`[Service] Stopped Aiden (PID: ${pid})`)
    // Clean up PID file on behalf of the stopped process (best-effort)
    try { fs.unlinkSync(PID_FILE) } catch {}
  } catch (e: any) {
    if (e.code === 'ESRCH') {
      // Process no longer exists — stale PID file
      console.log('[Service] No running instance found (stale PID — cleaning up)')
      try { fs.unlinkSync(PID_FILE) } catch {}
    } else {
      console.log(`[Service] Error stopping service: ${e.message}`)
    }
  }
}

// ── getPid ─────────────────────────────────────────────────────
// Returns the PID of the running service, or null.

export function getPid(): number | null {
  try {
    if (!fs.existsSync(PID_FILE)) return null
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10)
    return isNaN(pid) ? null : pid
  } catch {
    return null
  }
}
