// ============================================================
// Aiden Behavioral Audit — Server Lifecycle Control
// scripts/test-suite/server-control.ts
// ============================================================

import { spawn, ChildProcess, execSync } from 'child_process'
import * as path from 'path'
import * as http from 'http'

const PORT    = parseInt(process.env.AIDEN_PORT || '4200', 10)
const ROOT    = path.resolve(__dirname, '..', '..')

let serverProc: ChildProcess | null = null

// ── Kill whatever's on port 4200 ─────────────────────────────────────────────

export function killPort(port = PORT): void {
  try {
    // Windows: netstat → find pid → taskkill
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' }).trim()
    const pids = new Set<string>()
    for (const line of out.split('\n')) {
      const m = line.trim().match(/\s+(\d+)$/)
      if (m) pids.add(m[1])
    }
    for (const pid of pids) {
      try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' }) } catch {}
    }
  } catch {
    // port not in use — fine
  }
}

// ── Wait for /api/health to return 200 ───────────────────────────────────────

export function waitForHealth(timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start    = Date.now()
    const interval = 500

    const check = () => {
      const req = http.request(
        { hostname: 'localhost', port: PORT, path: '/api/health', method: 'GET', timeout: 2000 },
        (res) => {
          if (res.statusCode === 200) {
            resolve()
          } else if (Date.now() - start > timeoutMs) {
            reject(new Error(`Health check returned ${res.statusCode} after ${timeoutMs}ms`))
          } else {
            setTimeout(check, interval)
          }
          res.resume()
        }
      )
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server did not start within ${timeoutMs}ms`))
        } else {
          setTimeout(check, interval)
        }
      })
      req.on('timeout', () => { req.destroy(); setTimeout(check, interval) })
      req.end()
    }

    check()
  })
}

// ── Start server ──────────────────────────────────────────────────────────────

export async function startServer(): Promise<void> {
  console.log(`  [server] Killing any existing process on :${PORT}...`)
  killPort(PORT)
  await new Promise(r => setTimeout(r, 800))

  console.log(`  [server] Spawning: node dist-bundle/index.js serve`)
  serverProc = spawn('node', ['dist-bundle/index.js', 'serve'], {
    cwd:      ROOT,
    detached: false,
    stdio:    ['ignore', 'pipe', 'pipe'],
    env:      { ...process.env },
  })

  serverProc.stdout?.on('data', (d: Buffer) => {
    const line = d.toString().trim()
    if (line) process.stdout.write(`  [aiden] ${line}\n`)
  })
  serverProc.stderr?.on('data', (d: Buffer) => {
    const line = d.toString().trim()
    if (line) process.stderr.write(`  [aiden:err] ${line}\n`)
  })
  serverProc.on('error', (e) => {
    console.error(`  [server] Spawn error:`, e.message)
  })
  serverProc.on('exit', (code, sig) => {
    if (code !== null && code !== 0) {
      console.error(`  [server] Process exited with code ${code} signal ${sig}`)
    }
    serverProc = null
  })

  console.log(`  [server] Waiting for /api/health...`)
  await waitForHealth(30_000)
  console.log(`  [server] ✅ Aiden is up on :${PORT}`)
}

// ── Stop server ───────────────────────────────────────────────────────────────

export async function stopServer(): Promise<void> {
  if (serverProc && !serverProc.killed) {
    console.log(`  [server] Sending SIGTERM to pid ${serverProc.pid}...`)
    serverProc.kill('SIGTERM')
    await new Promise(r => setTimeout(r, 1500))
  }
  killPort(PORT)
  await new Promise(r => setTimeout(r, 500))
  console.log(`  [server] ✅ Server stopped`)
}

// ── callAiden: single HTTP round-trip ─────────────────────────────────────────

export interface AidenMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function callAiden(
  message:  string,
  history:  AidenMessage[] = [],
  timeoutMs = 90_000,
): Promise<string> {
  const res = await fetch(`http://localhost:${PORT}/api/chat`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body:    JSON.stringify({ message, history, mode: 'auto' }),
    signal:  AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`)
  }
  const data = await res.json() as any
  return String(data.message ?? data.response ?? '')
}
