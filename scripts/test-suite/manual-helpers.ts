import 'dotenv/config'
import * as fs   from 'fs'
import * as path from 'path'
import * as os   from 'os'
import { execSync } from 'child_process'
import * as http from 'http'

// ── Paths ─────────────────────────────────────────────────────────────────────

const DESKTOP      = path.join(os.homedir(), 'Desktop')
const WORKSPACE    = path.resolve(__dirname, '..', '..', 'workspace')
const MEMORY_FILE  = path.join(WORKSPACE, 'memory', 'records.jsonl')
const SCREENSHOTS  = path.join(WORKSPACE, 'screenshots')
const SERVER_URL   = 'http://localhost:4200/api/health'

// ── ANSI ──────────────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  grey:   '\x1b[90m',
}

// ── cleanDesktop ──────────────────────────────────────────────────────────────

function cleanDesktop() {
  console.log(`\n${C.bold}cleanDesktop${C.reset} — removing audit_* and test_* files from Desktop\n`)
  if (!fs.existsSync(DESKTOP)) {
    console.log(`  ${C.red}Desktop not found: ${DESKTOP}${C.reset}`)
    return
  }

  const entries = fs.readdirSync(DESKTOP)
  const targets = entries.filter(e => /^(audit_|test_|manual_|btc_test|audit-)/i.test(e))

  if (targets.length === 0) {
    console.log(`  ${C.green}✓ Desktop already clean — no audit/test files found${C.reset}`)
    return
  }

  for (const file of targets) {
    const full = path.join(DESKTOP, file)
    try {
      fs.rmSync(full, { recursive: true, force: true })
      console.log(`  ${C.yellow}removed${C.reset}  ${file}`)
    } catch (e: any) {
      console.log(`  ${C.red}failed${C.reset}   ${file}: ${e.message}`)
    }
  }
  console.log(`\n  ${C.green}✓ Cleaned ${targets.length} file(s)${C.reset}`)
}

// ── checkMemory ───────────────────────────────────────────────────────────────

function checkMemory() {
  console.log(`\n${C.bold}checkMemory${C.reset} — last 10 entries in records.jsonl\n`)
  console.log(`  ${C.grey}path: ${MEMORY_FILE}${C.reset}\n`)

  if (!fs.existsSync(MEMORY_FILE)) {
    console.log(`  ${C.red}records.jsonl not found${C.reset}`)
    return
  }

  const raw  = fs.readFileSync(MEMORY_FILE, 'utf-8')
  const lines = raw.split('\n').filter(l => l.trim().length > 0)
  console.log(`  ${C.cyan}Total entries: ${lines.length}${C.reset}\n`)

  const last10 = lines.slice(-10)
  for (const line of last10) {
    try {
      const obj = JSON.parse(line)
      const id  = obj.id   ?? obj.mem_id ?? '—'
      const txt = obj.text ?? obj.content ?? obj.value ?? JSON.stringify(obj).slice(0, 100)
      console.log(`  ${C.dim}${id}${C.reset}  ${txt}`)
    } catch {
      console.log(`  ${C.grey}${line.slice(0, 120)}${C.reset}`)
    }
  }
  console.log()
}

// ── checkScreenshots ──────────────────────────────────────────────────────────

function checkScreenshots() {
  console.log(`\n${C.bold}checkScreenshots${C.reset} — contents of workspace/screenshots/\n`)
  console.log(`  ${C.grey}path: ${SCREENSHOTS}${C.reset}\n`)

  if (!fs.existsSync(SCREENSHOTS)) {
    console.log(`  ${C.yellow}Directory does not exist yet${C.reset}`)
    return
  }

  const files = fs.readdirSync(SCREENSHOTS)
    .map(f => {
      const full  = path.join(SCREENSHOTS, f)
      const stats = fs.statSync(full)
      return { name: f, sizeKb: Math.round(stats.size / 1024), mtime: stats.mtime }
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

  if (files.length === 0) {
    console.log(`  ${C.dim}(empty)${C.reset}`)
    return
  }

  for (const f of files.slice(0, 15)) {
    const age = Math.round((Date.now() - f.mtime.getTime()) / 60000)
    console.log(`  ${C.green}${f.name.padEnd(50)}${C.reset} ${String(f.sizeKb).padStart(6)} KB  ${C.grey}${age}m ago${C.reset}`)
  }
  if (files.length > 15) {
    console.log(`  ${C.dim}... and ${files.length - 15} more${C.reset}`)
  }
  console.log()
}

// ── serverStatus ──────────────────────────────────────────────────────────────

function serverStatus(): Promise<void> {
  return new Promise(resolve => {
    console.log(`\n${C.bold}serverStatus${C.reset} — checking ${SERVER_URL}\n`)
    const req = http.get(SERVER_URL, { timeout: 4000 }, res => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`  ${C.green}✓ Server alive (HTTP ${res.statusCode})${C.reset}`)
          try {
            const json = JSON.parse(body)
            console.log(`  ${C.grey}${JSON.stringify(json).slice(0, 120)}${C.reset}`)
          } catch { /* non-JSON health response */ }
        } else {
          console.log(`  ${C.yellow}⚠ Server responded HTTP ${res.statusCode}${C.reset}`)
        }
        console.log()
        resolve()
      })
    })
    req.on('error', err => {
      console.log(`  ${C.red}✗ Server not reachable: ${err.message}${C.reset}`)
      console.log(`  ${C.grey}Run: npm start${C.reset}\n`)
      resolve()
    })
    req.on('timeout', () => {
      req.destroy()
      console.log(`  ${C.red}✗ Timeout — server not responding${C.reset}\n`)
      resolve()
    })
  })
}

// ── quickRestart ──────────────────────────────────────────────────────────────

function quickRestart() {
  console.log(`\n${C.bold}quickRestart${C.reset} — kill port 4200 then restart npm start\n`)
  try {
    const out = execSync('netstat -ano | findstr :4200', { encoding: 'utf-8' }).trim()
    const pids = [...new Set(
      out.split('\n')
        .map(l => l.trim().split(/\s+/).pop()!)
        .filter(p => /^\d+$/.test(p) && p !== '0')
    )]
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf-8' })
        console.log(`  ${C.yellow}killed PID ${pid}${C.reset}`)
      } catch { /* already gone */ }
    }
  } catch { /* nothing on port 4200 */ }

  console.log(`  ${C.cyan}Starting server...${C.reset}`)
  console.log(`  ${C.grey}(detached — check separately that port 4200 is up)${C.reset}`)
  const { spawn } = require('child_process')
  const child = spawn('node', ['dist-bundle/index.js', 'serve'], {
    detached: true,
    stdio:    'ignore',
    cwd:      path.resolve(__dirname, '..', '..'),
  })
  child.unref()
  console.log(`  ${C.green}✓ Server process spawned (PID ${child.pid})${C.reset}`)
  console.log(`  ${C.grey}Wait ~5s then run: npm run test:helper:status${C.reset}\n`)
}

// ── Status (combined) ─────────────────────────────────────────────────────────

async function status() {
  await serverStatus()
  checkScreenshots()
}

// ── CLI dispatch ──────────────────────────────────────────────────────────────

const cmd = process.argv[2]

;(async () => {
  switch (cmd) {
    case 'clean':
      cleanDesktop()
      break
    case 'memory':
      checkMemory()
      break
    case 'status':
      await status()
      break
    case 'restart':
      quickRestart()
      break
    default:
      console.log(`\n${C.bold}Aiden Manual Test Helpers${C.reset}`)
      console.log(`\n  ${C.cyan}clean${C.reset}    Remove audit_* / test_* files from Desktop`)
      console.log(`  ${C.cyan}status${C.reset}   Server health + screenshot directory listing`)
      console.log(`  ${C.cyan}memory${C.reset}   Last 10 entries in workspace/memory/records.jsonl`)
      console.log(`  ${C.cyan}restart${C.reset}  Kill port 4200 + spawn fresh server`)
      console.log()
      console.log(`  ${C.grey}Usage: npx ts-node scripts/test-suite/manual-helpers.ts <command>${C.reset}\n`)
  }
})()
