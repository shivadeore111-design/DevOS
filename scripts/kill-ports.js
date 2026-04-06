// scripts/kill-ports.js — Kill stale processes on DevOS ports before startup.
// Ports: 4200 (Aiden API), 3000 (Dashboard), 3001 (MCP)
// Usage: node scripts/kill-ports.js

'use strict'

const { execSync } = require('child_process')

const PORTS = [4200, 3000, 3001]

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    const lines = out.split('\n').filter(l => l.trim())
    const pids = new Set()
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      // netstat output: Proto  Local  Foreign  State  PID
      // Local address must end with :PORT (not foreign address)
      if (parts.length >= 5) {
        const local = parts[1] || ''
        const pid   = parts[4] || ''
        if (local.endsWith(':' + port) && pid && /^\d+$/.test(pid) && pid !== '0') {
          pids.add(pid)
        }
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' })
        console.log(`[kill-ports] Killed PID ${pid} on port ${port}`)
      } catch {
        // process may have already exited
      }
    }
    if (pids.size === 0) {
      console.log(`[kill-ports] Port ${port} is free`)
    }
  } catch {
    // findstr returns exit code 1 when no matches — port is free
    console.log(`[kill-ports] Port ${port} is free`)
  }
}

for (const port of PORTS) {
  killPort(port)
}
