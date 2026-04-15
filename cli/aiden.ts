#!/usr/bin/env node
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
//
// cli/aiden.ts — Production Terminal UI for Aiden
// Connects to the API server at http://localhost:4200
// Same brain, same memory, same tools — just a different front-end.
//
// Usage:
//   npm run cli                        — run with ts-node
//   AIDEN_API=http://... npm run cli   — custom server URL

import readline from 'readline'
import crypto   from 'crypto'

// ── Config ─────────────────────────────────────────────────────────────────────

const API_BASE  = process.env.AIDEN_API || 'http://localhost:4200'
const SESSION_ID = crypto.randomUUID()

// ── Color palette ───────────────────────────────────────────────────────────────

const C = {
  orange : '\x1b[38;5;208m',
  green  : '\x1b[32m',
  red    : '\x1b[31m',
  cyan   : '\x1b[36m',
  yellow : '\x1b[33m',
  dim    : '\x1b[2m',
  bold   : '\x1b[1m',
  reset  : '\x1b[0m',
  bg     : '\x1b[48;5;235m',
  white  : '\x1b[97m',
  blue   : '\x1b[34m',
  magenta: '\x1b[35m',
}

// ── State ───────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  role   : 'user' | 'assistant'
  content: string
}

const state = {
  history      : [] as HistoryEntry[],
  turnCount    : 0,
  ctxPercent   : 0,
  lastProvider : 'unknown',
  lastTurnMs   : 0,
  inputHistory : [] as string[],
  histIdx      : -1,
  streaming    : false,
  abortCtrl    : null as AbortController | null,
}

// ── API helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return fallback
    return await res.json() as T
  } catch {
    return fallback
  }
}

async function apiPost(path: string): Promise<void> {
  try {
    await fetch(`${API_BASE}${path}`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({}),
    })
  } catch { /* best-effort */ }
}

// ── Banner ──────────────────────────────────────────────────────────────────────

async function printBanner(): Promise<void> {
  // Fetch live stats in parallel
  const [health, providersData, skillsData, toolsData] = await Promise.all([
    apiFetch<any>('/api/health',    {}),
    apiFetch<any>('/api/providers', { apis: [] }),
    apiFetch<any[]>('/api/skills',  []),
    apiFetch<any[]>('/api/tools',   []),
  ])

  const version    = health.version   || '—'
  const status     = health.status === 'ok' ? `${C.green}●${C.reset}` : `${C.red}●${C.reset}`
  const apis       = Array.isArray(providersData.apis) ? providersData.apis : []
  const activeApis = apis.filter((a: any) => a.enabled && a.hasKey)
  const provStr    = activeApis.length > 0
    ? activeApis.map((a: any) => a.name).slice(0, 3).join(', ')
    : `${C.dim}none${C.reset}`
  const skillCount = Array.isArray(skillsData) ? skillsData.filter((s: any) => s.enabled).length : 0
  const toolCount  = Array.isArray(toolsData)  ? toolsData.length : 0

  if (activeApis.length > 0) {
    state.lastProvider = activeApis[0].name
  }

  console.log(`
${C.orange}  ╔════════════════════════════════════════╗
  ║  ${C.bold}${C.white}A/ Aiden${C.reset}${C.orange}  —  Autonomous AI System    ║
  ╚════════════════════════════════════════╝${C.reset}

  ${status} v${version}   ${C.dim}|${C.reset}  ${C.cyan}${provStr}${C.reset}  ${C.dim}|${C.reset}  ${C.dim}${skillCount} skills  ${toolCount} tools${C.reset}

  ${C.dim}Type naturally, or /help for commands.
  Ctrl+C to interrupt  ·  Ctrl+C twice to exit${C.reset}
`)
}

// ── Streaming chat ──────────────────────────────────────────────────────────────

async function streamChat(message: string): Promise<void> {
  state.streaming  = true
  state.abortCtrl  = new AbortController()
  const startedAt  = Date.now()
  let   fullReply  = ''
  let   provider   = ''
  let   inToolCard = false

  // Build history array for this request (last 20 turns)
  const historyPayload = state.history.slice(-20).map(h => ({
    role   : h.role,
    content: h.content,
  }))

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept'      : 'text/event-stream',
      },
      body  : JSON.stringify({
        message,
        mode     : 'auto',
        history  : historyPayload,
        sessionId: SESSION_ID,
      }),
      signal: state.abortCtrl.signal,
    })

    if (!res.ok) {
      process.stdout.write(`\n${C.red}  ✗ ${res.status} ${res.statusText}${C.reset}\n`)
      return
    }

    process.stdout.write(`\n${C.orange}Aiden${C.reset} `)

    // Greeting fast-path returns application/json; real chat uses text/event-stream.
    // Handle both so a plain "hi" doesn't produce an empty reply.
    const isSSE = (res.headers.get('content-type') || '').includes('text/event-stream')

    if (!isSSE) {
      const data  = await res.json() as any
      const reply = (data.reply || data.message || data.content || data.response || '') as string
      process.stdout.write(reply || `${C.dim}(no response)${C.reset}`)
      fullReply = reply
      if (data.provider) provider = data.provider as string
    }

    if (isSSE) {
    const reader  = (res.body as any).getReader()
    const decoder = new TextDecoder()
    let   buffer  = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (raw === '[DONE]') continue

        let evt: any
        try { evt = JSON.parse(raw) } catch { continue }

        // ── Text token ──
        if (evt.token !== undefined) {
          if (inToolCard) {
            // Close open tool card before printing text
            process.stdout.write(`\n${C.dim}  └─────────────────────────────${C.reset}\n\n${C.orange}Aiden${C.reset} `)
            inToolCard = false
          }
          process.stdout.write(evt.token)
          fullReply += evt.token
          if (evt.provider) provider = evt.provider
        }

        // ── Stream complete ──
        if (evt.done === true) {
          if (evt.provider) provider = evt.provider
        }

        // ── Thinking ──
        if (evt.thinking) {
          const msg = evt.thinking.message || evt.thinking.stage || 'Thinking…'
          process.stdout.write(`\n${C.dim}  ~ ${msg}${C.reset}`)
        }

        // ── Activity / tool execution ──
        if (evt.activity) {
          const act = evt.activity
          if (!act.done) {
            // Open tool card
            if (!inToolCard) {
              process.stdout.write(`\n${C.cyan}  ┌─ > ${act.agent || ''} ${C.reset}`)
              process.stdout.write(`\n${C.cyan}  │${C.reset} ${C.dim}${act.message || ''}${C.reset}`)
              inToolCard = true
            } else {
              process.stdout.write(`\n${C.cyan}  │${C.reset} ${C.dim}${act.message || ''}${C.reset}`)
            }
          } else {
            if (inToolCard) {
              process.stdout.write(`\n${C.dim}  └─────────────────────────────${C.reset}`)
              inToolCard = false
            }
          }
        }

        // ── Callback-forwarded events ──
        if (evt.event === 'thinking_start' || evt.event === 'memory_read' || evt.event === 'planning_start') {
          const msg = evt.message || evt.data?.message || 'Thinking…'
          process.stdout.write(`\n${C.dim}  ~ ${msg}${C.reset}`)
        }

        if (evt.event === 'tool_start') {
          const tool = evt.tool || evt.data?.tool || '?'
          if (!inToolCard) {
            process.stdout.write(`\n${C.cyan}  ┌─ ▸ ${tool}${C.reset}`)
            process.stdout.write(`\n${C.cyan}  │${C.reset} ${C.dim}running…${C.reset}`)
            inToolCard = true
          }
        }

        if (evt.event === 'tool_end') {
          if (inToolCard) {
            process.stdout.write(`\n${C.dim}  └─────────────────────────────${C.reset}`)
            inToolCard = false
          }
        }

        // ── Delegation ──
        if (evt.delegation || (evt.from && evt.to)) {
          const from = evt.from || evt.delegation?.from || '?'
          const to   = evt.to   || evt.delegation?.to   || '?'
          const task = (evt.task || evt.delegation?.task || '').substring(0, 60)
          process.stdout.write(`\n${C.dim}  ${from} → ${to}: ${task}${C.reset}`)
        }
      }
    }

    // Close any unclosed tool card
    if (inToolCard) {
      process.stdout.write(`\n${C.dim}  └─────────────────────────────${C.reset}`)
    }
    } // end if (isSSE)

    // ── Finalise ──
    state.lastTurnMs = Date.now() - startedAt
    if (provider) state.lastProvider = provider
    state.turnCount++

    // Estimate context usage (rough: chars / 8000 chars per 2k tokens ~= %)
    const totalChars = state.history.reduce((n, h) => n + h.content.length, 0)
    state.ctxPercent = Math.min(99, Math.round(totalChars / 160_000 * 100))

    if (fullReply.trim()) {
      state.history.push({ role: 'user',      content: message   })
      state.history.push({ role: 'assistant', content: fullReply })
    }

    // ── Status bar ──
    const secs     = (state.lastTurnMs / 1000).toFixed(1)
    const ctxStr   = `ctx ${state.ctxPercent}%`
    const turnStr  = `turn ${state.turnCount}`
    const timeStr  = `${secs}s`
    process.stdout.write(
      `\n\n${C.dim}  ${state.lastProvider}  |  ${ctxStr}  |  ${turnStr}  |  ${timeStr}${C.reset}\n\n`
    )

  } catch (err: any) {
    if (err?.name === 'AbortError') {
      process.stdout.write(`\n${C.yellow}  [x] Interrupted${C.reset}\n\n`)
    } else {
      process.stdout.write(`\n${C.red}  ✗ ${err?.message || err}${C.reset}\n`)
      process.stdout.write(`${C.dim}  Is Aiden running? Start the desktop app first.${C.reset}\n\n`)
    }
  } finally {
    state.streaming = false
    state.abortCtrl = null
  }
}

// ── Commands ────────────────────────────────────────────────────────────────────

const COMMANDS = [
  '/help', '/new', '/reset', '/clear', '/history', '/stop', '/export',
  '/status', '/tools', '/providers', '/models', '/model', '/memory', '/goals',
  '/skills', '/recipes', '/sessions', '/budget', '/workspace',
  '/security', '/debug', '/provider', '/quit', '/exit',
]

async function handleCommand(cmd: string, rl: readline.Interface): Promise<boolean> {
  const parts   = cmd.trim().split(/\s+/)
  const command = parts[0].toLowerCase()

  // ── /help ──────────────────────────────────────────────────
  if (command === '/help') {
    console.log(`
${C.bold}Session${C.reset}
  /new          Start a new session (clears history)
  /reset        Same as /new
  /clear        Clear the screen
  /history      Show conversation history
  /stop         Interrupt current generation
  /export       Export conversation to JSON

${C.bold}Info${C.reset}
  /status       Health check + uptime
  /tools        List available tools
  /providers    Show provider status
  /models       Show active models
  /memory       Memory stats
  /goals        Active goals
  /skills       Loaded skills
  /recipes      Saved recipes
  /sessions     All sessions
  /budget       Token usage estimate
  /workspace    Workspace info

${C.bold}Config${C.reset}
  /provider <n> Switch provider by name (e.g. /provider groq-1)
  /security     AgentShield security scan
  /debug        Show debug logs

${C.bold}Other${C.reset}
  /quit  /exit  Quit
`)
    return true
  }

  // ── /new / /reset ─────────────────────────────────────────
  if (command === '/new' || command === '/reset') {
    state.history   = []
    state.turnCount = 0
    state.ctxPercent = 0
    console.log(`${C.green}  ✓ New session started${C.reset}\n`)
    return true
  }

  // ── /clear ────────────────────────────────────────────────
  if (command === '/clear') {
    console.clear()
    await printBanner()
    return true
  }

  // ── /history ──────────────────────────────────────────────
  if (command === '/history') {
    if (state.history.length === 0) {
      console.log(`${C.dim}  No history yet.${C.reset}\n`)
      return true
    }
    for (const h of state.history) {
      const label = h.role === 'user'
        ? `${C.dim}you${C.reset}`
        : `${C.orange}Aiden${C.reset}`
      const preview = h.content.substring(0, 120).replace(/\n/g, ' ')
      console.log(`  ${label}  ${C.dim}${preview}${C.reset}`)
    }
    console.log()
    return true
  }

  // ── /stop ─────────────────────────────────────────────────
  if (command === '/stop') {
    if (state.abortCtrl) {
      state.abortCtrl.abort()
      console.log(`${C.yellow}  ⊘ Stop signal sent${C.reset}\n`)
    } else {
      // Try server-side stop too
      await apiPost('/api/stop')
      console.log(`${C.dim}  No active generation${C.reset}\n`)
    }
    return true
  }

  // ── /export ───────────────────────────────────────────────
  if (command === '/export') {
    const data  = await apiFetch<any>('/api/export/conversation?format=json', null)
    const count = data?.messageCount || data?.messages?.length || state.history.length
    console.log(`${C.dim}  Exported ${count} messages${C.reset}\n`)
    return true
  }

  // ── /status ───────────────────────────────────────────────
  if (command === '/status') {
    const h = await apiFetch<any>('/api/debug/health', {})
    const upMin   = Math.floor((h.uptime  || 0) / 60)
    const ramMB   = Math.round((h.memory?.heapUsed || 0) / 1024 / 1024)
    const ollama  = h.ollama  || 'unknown'
    const sessions= h.workspace?.sessions || 0
    const mems    = h.workspace?.memories || 0
    console.log(`
${C.green}  ✓ Aiden Online${C.reset}
  Uptime   ${upMin}m
  RAM      ${ramMB} MB
  Ollama   ${ollama}
  Sessions ${sessions}
  Memories ${mems}
`)
    return true
  }

  // ── /tools ────────────────────────────────────────────────
  if (command === '/tools') {
    const tools = await apiFetch<any[]>('/api/tools', [])
    console.log(`\n${C.bold}  Tools (${tools.length}):${C.reset}`)
    for (const t of tools) {
      console.log(`  ${C.cyan}▸${C.reset} ${t.name}  ${C.dim}${(t.description || '').substring(0, 60)}${C.reset}`)
    }
    console.log()
    return true
  }

  // ── /providers ────────────────────────────────────────────
  if (command === '/providers') {
    const data = await apiFetch<any>('/api/providers', { apis: [], routing: {} })
    const apis  = Array.isArray(data.apis) ? data.apis : []
    console.log(`\n${C.bold}  Providers:${C.reset}`)
    for (const a of apis) {
      const dot  = a.enabled && a.hasKey ? C.green + '●' : C.dim + '○'
      const rl   = a.rateLimited ? ` ${C.yellow}[rate-limited]${C.reset}` : ''
      const uses = a.usageCount != null ? ` ${C.dim}(${a.usageCount} calls)${C.reset}` : ''
      console.log(`  ${dot}${C.reset} ${a.name}  ${C.dim}${a.model || ''}${C.reset}${rl}${uses}`)
    }
    if (data.routing) {
      console.log(`\n  ${C.dim}Routing: ${JSON.stringify(data.routing)}${C.reset}`)
    }
    console.log()
    return true
  }

  // ── /models ───────────────────────────────────────────────
  if (command === '/models' || command === '/model') {
    const m = await apiFetch<any>('/api/debug/models', {})
    console.log(`
${C.bold}  Models:${C.reset}
  Provider  ${m.activeProvider || m.activeModel || 'unknown'}
  Cloud     ${(m.providers || []).join(', ') || 'none'}
  Local     ${(m.ollamaModels || []).join(', ') || 'none'}
`)
    return true
  }

  // ── /memory ───────────────────────────────────────────────
  if (command === '/memory') {
    const m     = await apiFetch<any>('/api/memories', [])
    const count = Array.isArray(m) ? m.length : (m.total || 0)
    console.log(`  ${C.dim}Memories: ${count}${C.reset}\n`)
    return true
  }

  // ── /goals ────────────────────────────────────────────────
  if (command === '/goals') {
    const g     = await apiFetch<any>('/api/goals', { goals: [] })
    const goals = Array.isArray(g) ? g : (g.goals || [])
    if (goals.length === 0) {
      console.log(`  ${C.dim}No active goals${C.reset}\n`)
    } else {
      console.log(`\n${C.bold}  Goals:${C.reset}`)
      for (const goal of goals) {
        const dot = goal.status === 'active' ? `${C.green}*` : `${C.dim}-`
        console.log(`  ${dot}${C.reset} ${goal.title}`)
      }
      console.log()
    }
    return true
  }

  // ── /skills ───────────────────────────────────────────────
  if (command === '/skills') {
    const skills = await apiFetch<any[]>('/api/skills', [])
    console.log(`\n${C.bold}  Skills (${skills.length}):${C.reset}`)
    for (const s of skills) {
      const mark = s.enabled ? `${C.green}✓` : `${C.dim}✗`
      console.log(`  ${mark}${C.reset} ${s.name}  ${C.dim}${s.source || ''}${C.reset}`)
    }
    console.log()
    return true
  }

  // ── /recipes ──────────────────────────────────────────────
  if (command === '/recipes') {
    const r = await apiFetch<any>('/api/recipes', [])
    const recipes = Array.isArray(r) ? r : (r.recipes || [])
    if (recipes.length === 0) {
      console.log(`  ${C.dim}No recipes found${C.reset}\n`)
    } else {
      console.log(`\n${C.bold}  Recipes:${C.reset}`)
      for (const rec of recipes) {
        console.log(`  ${C.cyan}▸${C.reset} ${rec.name || rec.id}  ${C.dim}${(rec.description || '').substring(0, 60)}${C.reset}`)
      }
      console.log()
    }
    return true
  }

  // ── /sessions ─────────────────────────────────────────────
  if (command === '/sessions') {
    const sessions = await apiFetch<any[]>('/api/sessions', [])
    console.log(`\n${C.bold}  Sessions (${sessions.length}):${C.reset}`)
    for (const s of sessions.slice(0, 10)) {
      const ts  = s.timestamp ? new Date(s.timestamp).toLocaleString() : '—'
      const pre = (s.preview || s.title || '').substring(0, 50)
      console.log(`  ${C.dim}${ts}${C.reset}  ${pre}`)
    }
    if (sessions.length > 10) {
      console.log(`  ${C.dim}… and ${sessions.length - 10} more${C.reset}`)
    }
    console.log()
    return true
  }

  // ── /budget ───────────────────────────────────────────────
  if (command === '/budget') {
    const totalChars = state.history.reduce((n, h) => n + h.content.length, 0)
    const approxTok  = Math.round(totalChars / 4)
    const ctx        = state.ctxPercent
    console.log(`
  ${C.bold}Token Budget (estimate):${C.reset}
  Context used   ~${approxTok.toLocaleString()} tokens  (${ctx}%)
  Turn count     ${state.turnCount}
  Session ID     ${SESSION_ID.substring(0, 16)}…
`)
    return true
  }

  // ── /workspace ────────────────────────────────────────────
  if (command === '/workspace') {
    const ws = await apiFetch<any>('/api/workspaces', {})
    const list = Array.isArray(ws) ? ws : (ws.workspaces || [])
    if (list.length === 0) {
      console.log(`  ${C.dim}No workspaces${C.reset}\n`)
    } else {
      console.log(`\n${C.bold}  Workspaces:${C.reset}`)
      for (const w of list) {
        console.log(`  ${C.cyan}▸${C.reset} ${w.name || w.id}`)
      }
      console.log()
    }
    return true
  }

  // ── /security ─────────────────────────────────────────────
  if (command === '/security') {
    console.log(`${C.dim}  Running security scan…${C.reset}`)
    const scan = await apiFetch<any>('/api/security/scan', {})
    const threats = scan.threats || scan.issues || []
    if (threats.length === 0) {
      console.log(`  ${C.green}✓ No threats detected${C.reset}\n`)
    } else {
      console.log(`  ${C.red}[!] ${threats.length} issue(s) found:${C.reset}`)
      for (const t of threats) {
        console.log(`    ${C.yellow}•${C.reset} ${t.message || JSON.stringify(t)}`)
      }
      console.log()
    }
    return true
  }

  // ── /debug ────────────────────────────────────────────────
  if (command === '/debug') {
    const logs = await apiFetch<any>('/api/debug/logs', { logs: [] })
    const lines = Array.isArray(logs) ? logs : (logs.logs || [])
    console.log(`\n${C.bold}  Debug logs (last 20):${C.reset}`)
    for (const l of lines.slice(-20)) {
      console.log(`  ${C.dim}${l}${C.reset}`)
    }
    console.log()
    return true
  }

  // ── /provider <name> ──────────────────────────────────────
  if (command === '/provider') {
    const name = parts[1]
    if (!name) {
      console.log(`  ${C.dim}Usage: /provider <name>${C.reset}\n`)
      return true
    }
    try {
      const res = await fetch(`${API_BASE}/api/providers/active`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ provider: name }),
      })
      if (res.ok) {
        state.lastProvider = name
        console.log(`  ${C.green}✓ Switched to ${name}${C.reset}\n`)
      } else {
        console.log(`  ${C.red}✗ Could not switch to ${name} (${res.status})${C.reset}\n`)
      }
    } catch {
      console.log(`  ${C.red}✗ Request failed${C.reset}\n`)
    }
    return true
  }

  // ── /quit / /exit ─────────────────────────────────────────
  if (command === '/quit' || command === '/exit' || command === '/q') {
    console.log(`\n${C.dim}  Goodbye.${C.reset}\n`)
    process.exit(0)
  }

  // Unrecognised command
  console.log(`  ${C.dim}Unknown command. /help for list.${C.reset}\n`)
  return true
}

// ── Tab completer ───────────────────────────────────────────────────────────────

function completer(line: string): [string[], string] {
  if (line.startsWith('/')) {
    const hits = COMMANDS.filter(c => c.startsWith(line))
    return [hits.length ? hits : COMMANDS, line]
  }
  return [[], line]
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Check server reachability
  const health = await apiFetch<any>('/api/health', null)
  if (!health || health.status !== 'ok') {
    console.log(`\n${C.red}  ✗ Cannot connect to Aiden at ${API_BASE}${C.reset}`)
    console.log(`${C.dim}  Start the Aiden desktop app first, or set AIDEN_API env var.${C.reset}\n`)
    process.exit(1)
  }

  await printBanner()

  const rl = readline.createInterface({
    input     : process.stdin,
    output    : process.stdout,
    prompt    : `${C.dim}you${C.reset} ${C.bold}›${C.reset} `,
    completer,
    terminal  : true,
  })

  rl.prompt()

  // ── Up/down arrow history ──
  let histIdx = -1

  rl.on('keypress', (_ch: any, key: any) => {
    if (!key) return

    if (key.name === 'up') {
      if (histIdx < state.inputHistory.length - 1) {
        histIdx++
        const entry = state.inputHistory[state.inputHistory.length - 1 - histIdx] || ''
        ;(rl as any).line = entry
        ;(rl as any).cursor = entry.length
        ;(rl as any)._refreshLine?.()
      }
      return
    }

    if (key.name === 'down') {
      if (histIdx > 0) {
        histIdx--
        const entry = state.inputHistory[state.inputHistory.length - 1 - histIdx] || ''
        ;(rl as any).line = entry
        ;(rl as any).cursor = entry.length
        ;(rl as any)._refreshLine?.()
      } else {
        histIdx = -1
        ;(rl as any).line = ''
        ;(rl as any).cursor = 0
        ;(rl as any)._refreshLine?.()
      }
      return
    }
  })

  // ── Ctrl+C: interrupt / double-exit ──
  let lastCtrlC = 0

  rl.on('SIGINT', async () => {
    if (state.streaming) {
      // Interrupt generation
      state.abortCtrl?.abort()
      await apiPost('/api/stop')
      process.stdout.write(`\n${C.yellow}  [x] Interrupted${C.reset}\n\n`)
      rl.prompt()
      return
    }

    const now = Date.now()
    if (now - lastCtrlC < 1500) {
      console.log(`\n${C.dim}  Goodbye.${C.reset}\n`)
      process.exit(0)
    }
    lastCtrlC = now
    process.stdout.write(`\n${C.dim}  Press Ctrl+C again to exit.${C.reset}\n`)
    rl.prompt()
  })

  // ── Line handler ──
  rl.on('line', async (line: string) => {
    histIdx = -1
    const input = line.trim()

    if (!input) {
      rl.prompt()
      return
    }

    // Save to input history (avoid duplicates)
    if (state.inputHistory[state.inputHistory.length - 1] !== input) {
      state.inputHistory.push(input)
      if (state.inputHistory.length > 200) state.inputHistory.shift()
    }

    if (input.startsWith('/')) {
      await handleCommand(input, rl)
      rl.prompt()
      return
    }

    await streamChat(input)
    rl.prompt()
  })

  rl.on('close', () => {
    console.log(`\n${C.dim}  Goodbye.${C.reset}\n`)
    process.exit(0)
  })
}

main()
