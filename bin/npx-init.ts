#!/usr/bin/env ts-node
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
// bin/npx-init.ts — npx devos-ai entry point
//
// Runs when someone executes: npx devos-ai
// 1. Print ASCII banner
// 2. Check prerequisites (doctor)
// 3. Create workspace if needed
// 4. Start the API server
// 5. Open the dashboard in the browser

import * as fs   from 'fs'
import * as path from 'path'
import { execSync, spawn } from 'child_process'

// ── Banner ──────────────────────────────────────────────────

const BANNER = `
 ██████╗ ███████╗██╗   ██╗ ██████╗ ███████╗
 ██╔══██╗██╔════╝██║   ██║██╔═══██╗██╔════╝
 ██║  ██║█████╗  ██║   ██║██║   ██║███████╗
 ██║  ██║██╔══╝  ╚██╗ ██╔╝██║   ██║╚════██║
 ██████╔╝███████╗ ╚████╔╝ ╚██████╔╝███████║
 ╚═════╝ ╚══════╝  ╚═══╝   ╚═════╝ ╚══════╝

 Autonomous AI Operating System  v1.0.0
 Local · Private · Free  —  runs on your machine
 ─────────────────────────────────────────────────
`

// ── Helpers ─────────────────────────────────────────────────

const API_PORT  = parseInt(process.env.DEVOS_PORT  ?? '4200')
const DASH_PORT = parseInt(process.env.DEVOS_DASH  ?? '3000')
const WORKSPACE = path.join(process.cwd(), 'workspace')

function log(msg: string)   { process.stdout.write(msg + '\n') }
function warn(msg: string)  { process.stdout.write(`⚠️  ${msg}\n`) }
function err(msg: string)   { process.stdout.write(`❌ ${msg}\n`) }
function ok(msg: string)    { process.stdout.write(`✅ ${msg}\n`) }
function info(msg: string)  { process.stdout.write(`   ${msg}\n`) }

// ── Quick prerequisite checks (fast-path before full doctor) ─

function checkNodeVersion(): boolean {
  const major = parseInt(process.version.slice(1))
  if (major < 18) {
    err(`Node.js ${process.version} detected — DevOS requires Node 18+`)
    info('Install from: https://nodejs.org')
    return false
  }
  ok(`Node.js ${process.version}`)
  return true
}

function checkOllamaSync(): boolean {
  try {
    const result = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:11434/api/tags', {
      stdio: 'pipe', timeout: 3000
    }).toString().trim()
    if (result === '200') {
      ok('Ollama running')
      return true
    }
    throw new Error('non-200')
  } catch {
    warn('Ollama not detected — AI features will be limited')
    info('Install from: https://ollama.ai  then run: ollama serve')
    return true  // non-fatal — server still starts
  }
}

// ── Workspace bootstrap ──────────────────────────────────────

function ensureWorkspace(): void {
  const dirs = [
    WORKSPACE,
    path.join(WORKSPACE, 'reports'),
    path.join(WORKSPACE, 'skills'),
    path.join(WORKSPACE, 'agents'),
  ]
  let created = false
  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true })
      created = true
    }
  }

  // Write default .env if missing
  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) {
    const defaultEnv = [
      '# DevOS Configuration',
      `DEVOS_PORT=${API_PORT}`,
      `DEVOS_DASH=${DASH_PORT}`,
      'DEVOS_MODE=builder',
      `OLLAMA_MODEL=mistral-nemo:12b`,
      `CODER_MODEL=qwen2.5-coder:7b`,
      '',
    ].join('\n')
    fs.writeFileSync(envPath, defaultEnv)
    ok('.env created with defaults')
  }

  if (created) ok('Workspace initialized')
  else info('Workspace already exists')
}

// ── CoreBoot warm ────────────────────────────────────────────

function warmCoreBoot(): void {
  try {
    // Dynamically require so tree-shaking/bundling doesn't affect it
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { coreBoot } = require('../core/coreBoot')
    const prompt = coreBoot.getSystemPrompt()
    ok(`CoreBoot loaded — ${prompt.length} chars, KV-cache primed`)
  } catch {
    warn('CoreBoot warm failed — context/bootstrap may be missing')
  }
}

// ── Start API server ─────────────────────────────────────────

function startServer(): void {
  const serverEntry = path.join(process.cwd(), 'api', 'server.ts')
  const serverDist  = path.join(process.cwd(), 'dist', 'api', 'server.js')

  const cmd  = fs.existsSync(serverDist)  ? 'node'    : 'ts-node'
  const file = fs.existsSync(serverDist)  ? serverDist : serverEntry

  log(`\n🚀 Starting DevOS API on port ${API_PORT}…`)

  const server = spawn(cmd, [file], {
    detached: false,
    stdio:    'inherit',
    env:      { ...process.env, DEVOS_PORT: String(API_PORT) },
  })

  server.on('error', (e) => {
    err(`Failed to start server: ${e.message}`)
    process.exit(1)
  })

  // Give server 2s to start then open browser
  setTimeout(() => openBrowser(), 2000)

  // Propagate signals
  process.on('SIGINT',  () => { server.kill('SIGINT');  process.exit(0) })
  process.on('SIGTERM', () => { server.kill('SIGTERM'); process.exit(0) })
  server.on('exit', (code) => process.exit(code ?? 0))
}

// ── Open dashboard ───────────────────────────────────────────

function openBrowser(): void {
  // Detect if dashboard (Next.js) is running
  const dashUrl = `http://localhost:${DASH_PORT}`
  const apiUrl  = `http://localhost:${API_PORT}`

  // Try to open the dashboard; fall back to API url
  const url = dashUrl
  log(`\n🌐 Opening dashboard: ${url}`)

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const open = require('open')
    if (typeof open === 'function') {
      open(url).catch(() => {})
    } else if (open?.default) {
      open.default(url).catch(() => {})
    }
  } catch {
    // open package not available — print URL
    log(`\n   Open your browser and navigate to: ${url}`)
    log(`   API available at:                  ${apiUrl}`)
  }
}

// ── Full doctor check (async, non-blocking) ──────────────────

async function runDoctorCheck(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { runDoctor } = require('../core/doctor')
    const { results } = await runDoctor()
    const fails  = results.filter((r: any) => r.status === 'fail')
    const warns  = results.filter((r: any) => r.status === 'warn')
    if (fails.length === 0 && warns.length === 0) {
      ok('System health: all checks passed')
    } else {
      if (warns.length) warn(`${warns.length} health warning(s) — run: devos doctor`)
      if (fails.length)  err(`${fails.length} health failure(s) — run: devos doctor`)
    }
  } catch {
    // doctor unavailable — skip silently
  }
}

// ── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.clear()
  log(BANNER)

  // Fast synchronous checks
  if (!checkNodeVersion()) process.exit(1)
  checkOllamaSync()

  // Setup
  ensureWorkspace()
  warmCoreBoot()

  // Async doctor in background (non-blocking)
  runDoctorCheck().catch(() => {})

  log('\n' + '─'.repeat(49))
  log(' DevOS is starting — press Ctrl+C to stop')
  log('─'.repeat(49) + '\n')

  // Start server (blocks via child process)
  startServer()
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
