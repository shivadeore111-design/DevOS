#!/usr/bin/env node
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
//
// cli/aiden.ts — Production Terminal UI for Aiden
// Connects to the API server at http://localhost:4200

import readline from 'readline'
import fs       from 'fs'
import path     from 'path'
import { paint, fg, RST, COLORS, MARKS, BOLD as THM_BOLD } from '../core/theme'
import { renderStatusBar }                                   from '../core/statusBar'
import { table, panel }                                      from '../core/panel'
import type { ColDef }                                       from '../core/panel'
import { SPINNER_FRAMES_RAW }                               from '../core/spinner'
import { checkForUpdate, formatUpdateLine }                  from '../core/updateCheck'

// ── Constants ────────────────────────────────────────────────────────────────────

const API_BASE      = process.env.AIDEN_API || 'http://localhost:4200'
let   SESSION_ID    = `session_${Date.now()}`
const SESSION_START = Date.now()
let   RESUMED_FROM: string | null = null
const CONFIG_PATH   = path.join(__dirname, '..', 'config', 'devos.config.json')
const MAX_TURNS     = 15

// ── Theme ─────────────────────────────────────────────────────────────────────────

type ThemeName = 'default' | 'mono' | 'slate' | 'ember'

interface Theme {
  primary: string; accent: string; dim: string
  success: string; error: string;  warning: string
  bold: string;    reset: string;  white: string
}

const THEMES: Record<ThemeName, Theme> = {
  default: {
    primary: '\x1b[38;5;208m', accent : '\x1b[36m',         dim    : '\x1b[2m',
    success: '\x1b[32m',       error  : '\x1b[31m',         warning: '\x1b[33m',
    bold   : '\x1b[1m',        reset  : '\x1b[0m',          white  : '\x1b[97m',
  },
  mono: {
    primary: '\x1b[97m',       accent : '\x1b[90m',         dim    : '\x1b[2m',
    success: '\x1b[97m',       error  : '\x1b[31m',         warning: '\x1b[97m',
    bold   : '\x1b[1m',        reset  : '\x1b[0m',          white  : '\x1b[97m',
  },
  slate: {
    primary: '\x1b[38;5;111m', accent : '\x1b[38;5;147m',  dim    : '\x1b[2m',
    success: '\x1b[32m',       error  : '\x1b[31m',         warning: '\x1b[33m',
    bold   : '\x1b[1m',        reset  : '\x1b[0m',          white  : '\x1b[97m',
  },
  ember: {
    primary: '\x1b[38;5;160m', accent : '\x1b[38;5;214m',  dim    : '\x1b[2m',
    success: '\x1b[32m',       error  : '\x1b[31m',         warning: '\x1b[33m',
    bold   : '\x1b[1m',        reset  : '\x1b[0m',          white  : '\x1b[97m',
  },
}

let T: Theme = THEMES.default

function applyTheme(name: ThemeName): void {
  T = THEMES[name] ?? THEMES.default
}

// ── Config helpers ────────────────────────────────────────────────────────────────

function loadCfg(): any {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) } catch { return {} }
}

function saveCfg(cfg: any): void {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n') } catch {}
}

// Load saved theme on startup
;(() => {
  const cfg  = loadCfg()
  const name = (cfg?.cli?.theme || 'default') as ThemeName
  if (THEMES[name]) applyTheme(name)
})()

// ── State ─────────────────────────────────────────────────────────────────────────

interface HistoryEntry { role: 'user' | 'assistant'; content: string }

const state = {
  history     : [] as HistoryEntry[],
  turnCount   : 0,
  ctxPercent  : 0,
  lastProvider: 'aiden',
  lastModel   : '',
  lastTurnMs  : 0,
  inputHistory: [] as string[],
  streaming   : false,
  abortCtrl   : null as AbortController | null,
  detailLevel : 'tools'  as 'off' | 'tools' | 'verbose',
  depthLevel  : 'medium' as 'low' | 'medium' | 'high',
  persona     : 'default',
  themeName   : 'default' as ThemeName,
  privateMode : false,
}

// ── Terminal helpers ──────────────────────────────────────────────────────────────

const cols = (): number => Math.min(process.stdout.columns || 80, 100)
const hr   = (): string => '─'.repeat(cols() - 2)

function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function num(n: number): string { return n.toLocaleString() }

/** Colored source badge for skill tables.
 *  Spec: aiden=orange  community=cyan  local/other=dim gray
 */
function sourceBadgeStr(source: string): string {
  const s = (source || '').toLowerCase()
  if (s === 'aiden' || s === 'builtin' || s === 'built-in')
    return `${fg(COLORS.orange)}${source || 'aiden'}${RST}`
  if (s === 'community')
    return `${fg(COLORS.cyan)}community${RST}`
  // local, npm, unknown → dim gray
  return `${T.dim}${source || 'local'}${T.reset}`
}

/** Trust stars: ★★★☆☆ (score clamped to 0-5). */
function trustStars(score: number): string {
  const n = Math.max(0, Math.min(5, Math.round(score)))
  return `${fg(COLORS.orange)}${'★'.repeat(n)}${RST}${T.dim}${'☆'.repeat(5 - n)}${T.reset}`
}

function ctxColor(pct: number): string {
  if (pct < 50) return T.success
  if (pct < 80) return T.warning
  if (pct < 95) return T.primary
  return T.error
}

function ctxBar(pct: number): string {
  const filled = Math.round(pct / 10)
  const bar    = '▰'.repeat(filled) + '▱'.repeat(10 - filled)
  return `[${bar}] ${pct}%`
}

// ── Spinner frames ────────────────────────────────────────────────────────────────

const SPINNER_FRAMES = SPINNER_FRAMES_RAW

// ── API helpers ───────────────────────────────────────────────────────────────────

async function apiFetch<R>(p: string, fallback: R): Promise<R> {
  try {
    const res = await fetch(`${API_BASE}${p}`, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return fallback
    return await res.json() as R
  } catch { return fallback }
}

async function apiPost(p: string, body: any = {}): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}${p}`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(body),
    })
    return res.ok ? (await res.json().catch(() => null)) : null
  } catch { return null }
}

// ── ASCII banner ──────────────────────────────────────────────────────────────────

const ASCII_BANNER = [
  '█████╗ ██╗██████╗ ███████╗███╗   ██╗',
  '██╔══██╗██║██╔══██╗██╔════╝████╗  ██║',
  '███████║██║██║  ██║█████╗  ██╔██╗ ██║',
  '██╔══██║██║██║  ██║██╔══╝  ██║╚██╗██║',
  '██║  ██║██║██████╔╝███████╗██║ ╚████║',
  '╚═╝  ╚═╝╚═╝╚═════╝ ╚══════╝╚═╝  ╚═══╝',
]

const TAGLINES = [
  'Your personal AI OS.',
  'Runs on your machine.',
  'Zero telemetry.',
  'The brain in your terminal.',
  'Built in India. Runs anywhere.',
]

async function printBanner(): Promise<void> {
  const [health, memData, provData, skillsData, toolsData] = await Promise.all([
    apiFetch<any>('/api/health',    {}),
    apiFetch<any>('/api/memories',  {}),
    apiFetch<any>('/api/providers', { apis: [] }),
    apiFetch<any[]>('/api/skills',  []),
    apiFetch<any[]>('/api/tools',   []),
  ])

  const version   = health.version || '3.4.0'
  const cfg       = loadCfg()
  const apis      = Array.isArray(provData.apis) ? provData.apis : []
  const active    = apis.filter((a: any) => a.enabled && a.hasKey)
  const provName  = cfg?.model?.active       || active[0]?.name  || 'local'
  const modelName = cfg?.model?.activeModel  || active[0]?.model || 'unknown'
  const skillArr  = Array.isArray(skillsData) ? skillsData : []
  const enabled   = skillArr.filter((s: any) => s.enabled)
  const recipes   = skillArr.filter((s: any) => s.type === 'recipe' || s.isRecipe).length
  const toolCount = Array.isArray(toolsData) ? toolsData.length : 0
  const memSem    = memData?.semantic ?? (Array.isArray(memData) ? memData.length : memData?.total ?? 0)
  const memEnt    = memData?.entities ?? 0

  if (active.length > 0) {
    state.lastProvider = provName
    state.lastModel    = modelName
  }

  // Kick off update check in background (non-blocking)
  const updatePromise = checkForUpdate(version)

  // ── Wordmark ──
  console.log()
  for (const line of ASCII_BANNER) {
    console.log(`  ${fg(COLORS.orange)}${line}${RST}`)
  }
  console.log()

  // ── Capability flex ──
  const sep = `${T.dim} · ${T.reset}`
  const provDot  = active.length > 0 ? `${T.success}●${T.reset}` : `${T.error}●${T.reset}`
  const memDot   = (memSem + memEnt) > 0 ? `${T.success}●${T.reset}` : `${T.dim}○${T.reset}`
  const skillDot = enabled.length > 0 ? `${T.success}●${T.reset}` : `${T.dim}○${T.reset}`

  console.log(
    `  ${provDot} ${fg(COLORS.orange)}${provName}${RST} ${T.dim}${modelName}${T.reset}` +
    sep +
    `${skillDot} ${T.dim}${enabled.length} skills${T.reset}` +
    sep +
    `${T.dim}${toolCount} tools${T.reset}` +
    sep +
    `${memDot} ${T.dim}${num(memSem)} mem${T.reset}`
  )

  // ── Session ──
  console.log(`  ${T.dim}${hr()}${T.reset}`)
  console.log(`  ${T.dim}session  ${T.reset}${T.dim}${SESSION_ID}${T.reset}`)
  console.log(`  ${T.dim}v${version}${T.reset}`)

  // ── Update-available line (await with 0-ms fallback so banner isn't blocked) ──
  const updateInfo = await Promise.race([
    updatePromise,
    new Promise<null>(r => setTimeout(() => r(null), 0)),
  ])
  const updateLine = formatUpdateLine(updateInfo)
  if (updateLine) console.log(updateLine)

  // ── Ready prompt ──
  console.log(`  ${T.dim}${hr()}${T.reset}`)
  console.log(`  ${fg(COLORS.orange)}ready ${MARKS.ARROW}${RST}  ${T.dim}/help for commands${T.reset}`)
  console.log()
}

// ── Goal complete card ────────────────────────────────────────────────────────────

function showGoalComplete(name: string): void {
  const orange  = '\x1b[38;5;208m'
  const w       = cols() - 6
  const side    = Math.floor((w - name.length - 16) / 2)
  const dashes  = '─'.repeat(Math.max(4, side))
  console.log()
  console.log(`  ${orange}◆ ${dashes} ◆${T.reset}`)
  console.log(`  ${orange}Goal complete: ${name}${T.reset}`)
  console.log(`  ${orange}◆ ${dashes} ◆${T.reset}`)
  console.log()
}

// ── Session summary ───────────────────────────────────────────────────────────────

function printSessionSummary(): void {
  const ms        = Date.now() - SESSION_START
  const userMsgs  = state.history.filter(h => h.role === 'user').length
  const totChars  = state.history.reduce((n, h) => n + h.content.length, 0)
  const approxTok = Math.round(totChars / 4)
  const cost      = (approxTok / 1_000_000 * 0.10).toFixed(4)
  const div       = `  ${T.dim}${'─'.repeat(cols() - 4)}${T.reset}`
  console.log()
  console.log(`  Session ended`)
  console.log(div)
  console.log(`  ${'Duration'.padEnd(14)}${fmtDuration(ms)}`)
  console.log(`  ${'Messages'.padEnd(14)}${state.history.length} (${userMsgs} user, ${state.turnCount} turns)`)
  console.log(`  ${'Tokens'.padEnd(14)}~${num(approxTok)}`)
  console.log(`  ${'Cost'.padEnd(14)}~$${cost}`)
  console.log(`  ${'Session'.padEnd(14)}${T.dim}${SESSION_ID}${T.reset}`)
  console.log(div)
  console.log(`  ${T.dim}Resume: npm run cli -- --resume ${SESSION_ID}${T.reset}`)
  console.log()
}

// ── Stream chat ───────────────────────────────────────────────────────────────────

async function streamChat(message: string): Promise<void> {
  state.streaming    = true
  state.abortCtrl    = new AbortController()
  const startedAt    = Date.now()
  const prevProvider = state.lastProvider
  let fullReply      = ''
  let provider       = ''
  let boxOpen        = false
  let linePos        = 0
  let streamDone     = false

  // ── Render area (ephemeral spinner + animated tool cards) ─────────────────────

  let globalFrame     = 0
  let lastRenderLines = 0
  let spinMsg         = 'understanding'
  let renderTimer: ReturnType<typeof setInterval> | null = null
  const pendingTools  = new Map<string, { startTime: number; frame: number }>()

  function clearRenderArea(): void {
    if (lastRenderLines <= 0) return
    if (lastRenderLines > 1) process.stdout.write(`\x1b[${lastRenderLines - 1}A\r`)
    else process.stdout.write('\r')
    for (let i = 0; i < lastRenderLines; i++) {
      process.stdout.write('\x1b[2K')
      if (i < lastRenderLines - 1) process.stdout.write('\n')
    }
    if (lastRenderLines > 1) process.stdout.write(`\x1b[${lastRenderLines - 1}A\r`)
    else process.stdout.write('\r')
    lastRenderLines = 0
  }

  function renderActivity(): void {
    clearRenderArea()
    const lines: string[] = []
    for (const [name, tool] of pendingTools) {
      const frame = SPINNER_FRAMES[tool.frame % SPINNER_FRAMES.length]
      tool.frame++
      lines.push(`  ${T.accent}▸${T.reset} ${name}  ${T.dim}${frame}${T.reset}\x1b[K`)
    }
    const gFrame = SPINNER_FRAMES[globalFrame % SPINNER_FRAMES.length]
    globalFrame++
    lines.push(`  ${T.dim}${gFrame} ${spinMsg}...\x1b[K${T.reset}`)
    for (let i = 0; i < lines.length; i++) {
      process.stdout.write(lines[i])
      if (i < lines.length - 1) process.stdout.write('\n')
    }
    lastRenderLines = lines.length
  }

  function startActivityRender(): void {
    if (renderTimer) return
    renderActivity()
    renderTimer = setInterval(renderActivity, 100)
  }

  function stopActivityRender(): void {
    if (renderTimer) { clearInterval(renderTimer); renderTimer = null }
    clearRenderArea()
    pendingTools.clear()
    lastRenderLines = 0
  }

  function onToolStart(name: string): void {
    pendingTools.set(name, { startTime: Date.now(), frame: 0 })
    // Next renderActivity tick will pick up the new entry automatically
  }

  function onToolEnd(name: string, success: boolean): void {
    const tool = pendingTools.get(name)
    if (!tool) return
    const elapsed = fmtMs(Date.now() - tool.startTime)
    if (renderTimer) { clearInterval(renderTimer); renderTimer = null }
    clearRenderArea()
    const mark = success ? `${T.success}✓` : `${T.error}✗`
    process.stdout.write(`  ${T.accent}▸${T.reset} ${name}  ${mark} ${T.dim}${elapsed}${T.reset}\n`)
    pendingTools.delete(name)
    lastRenderLines = 0
    if (!boxOpen) {
      renderActivity()
      renderTimer = setInterval(renderActivity, 100)
    }
  }

  // ── Flat response panel ───────────────────────────────────────────────────────

  const AVAIL = (): number => cols() - 5

  function openResponseBox(): void {
    process.stdout.write(`\n  ${T.primary}${T.bold}Aiden${T.reset}\n`)
    process.stdout.write(`  ${T.dim}${'─'.repeat(cols() - 4)}${T.reset}\n`)
    process.stdout.write('  ')
    boxOpen = true
    linePos = 0
  }

  function closeResponseBox(): void {
    if (!boxOpen) return
    process.stdout.write(`\n  ${T.dim}${'─'.repeat(cols() - 4)}${T.reset}\n`)
    boxOpen = false
  }

  function writeToken(token: string): void {
    if (!boxOpen) openResponseBox()
    for (const ch of token) {
      if (ch === '\n') {
        process.stdout.write('\n  ')
        linePos = 0
      } else {
        if (linePos >= AVAIL()) {
          process.stdout.write('\n  ')
          linePos = 0
        }
        process.stdout.write(ch)
        linePos++
      }
    }
  }

  const histPayload = state.history.slice(-20).map(h => ({ role: h.role, content: h.content }))

  try {
    startActivityRender()

    const res = await fetch(`${API_BASE}/api/chat`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body   : JSON.stringify({ message, mode: 'auto', history: histPayload, sessionId: SESSION_ID }),
      signal : state.abortCtrl.signal,
    })

    if (!res.ok) {
      stopActivityRender()
      let errText = res.statusText
      try {
        const errBody = await res.json() as any
        if (errBody?.error) errText = errBody.error
      } catch {}
      process.stdout.write(`\n  ${T.error}✗ ${res.status} ${errText}${T.reset}\n\n`)
      return
    }

    const isSSE = (res.headers.get('content-type') || '').includes('text/event-stream')

    // ── JSON fast-path (non-SSE response) ──────────────────────────────────────
    if (!isSSE) {
      stopActivityRender()
      const data  = await res.json() as any
      const reply = (data.reply || data.message || data.content || data.response || '') as string
      openResponseBox()
      for (const ch of reply) {
        if (ch === '\n') {
          process.stdout.write('\n  ')
          linePos = 0
        } else {
          if (linePos >= AVAIL()) {
            process.stdout.write('\n  ')
            linePos = 0
          }
          process.stdout.write(ch)
          linePos++
        }
      }
      fullReply = reply
      if (data.provider) provider = data.provider as string
      closeResponseBox()
    }

    // ── SSE streaming ───────────────────────────────────────────────────────────
    if (isSSE) {
      const reader  = (res.body as any).getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (!streamDone) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') { streamDone = true; break }

          let evt: any
          try { evt = JSON.parse(raw) } catch { continue }

          // ── Thinking phase — update spinner message ──
          if (!boxOpen && (evt.thinking || evt.event === 'thinking_start' || evt.event === 'planning_start' || evt.event === 'memory_read')) {
            const msg = evt.thinking?.message || evt.message || evt.data?.message
            if (msg) spinMsg = (msg as string).replace(/\.+$/, '').trim().toLowerCase()
          }

          // ── Tool start ──
          if (evt.event === 'tool_start' && !boxOpen && state.detailLevel !== 'off') {
            const tool = evt.tool || evt.data?.tool || '?'
            onToolStart(tool)
          }

          // ── Tool end ──
          if (evt.event === 'tool_end' && !boxOpen && state.detailLevel !== 'off') {
            const tool    = evt.tool || evt.data?.tool || '?'
            const success = evt.success !== false
            onToolEnd(tool, success)
          }

          // ── Activity events (verbose) ──
          if (evt.activity && !boxOpen && state.detailLevel === 'verbose') {
            const act = evt.activity
            if (!act.done) {
              if (renderTimer) { clearInterval(renderTimer); renderTimer = null }
              clearRenderArea()
              process.stdout.write(`  ${T.accent}▸${T.reset} ${act.agent || ''}  ${T.dim}${act.message || 'running...'}${T.reset}\n`)
              lastRenderLines = 0
              renderActivity()
              renderTimer = setInterval(renderActivity, 100)
            }
          }

          // ── Delegation (verbose) ──
          if ((evt.delegation || (evt.from && evt.to)) && !boxOpen && state.detailLevel === 'verbose') {
            const from = evt.from || evt.delegation?.from || '?'
            const to   = evt.to   || evt.delegation?.to   || '?'
            const task = (evt.task || evt.delegation?.task || '').substring(0, 60)
            if (renderTimer) { clearInterval(renderTimer); renderTimer = null }
            clearRenderArea()
            process.stdout.write(`  ${T.dim}${from} → ${to}: ${task}${T.reset}\n`)
            lastRenderLines = 0
            renderActivity()
            renderTimer = setInterval(renderActivity, 100)
          }

          // ── Goal complete ──
          if (evt.event === 'goal_complete' || evt.goalComplete) {
            const name = evt.goal || evt.goalComplete?.name || evt.name || 'goal'
            if (!boxOpen) stopActivityRender()
            showGoalComplete(name)
          }

          // ── Async task complete ──
          if (evt.event === 'async_complete' || evt.asyncComplete) {
            const taskId  = evt.taskId || evt.asyncComplete?.taskId || '?'
            const elapsed = evt.elapsed ? fmtDuration(evt.elapsed) : ''
            const suffix  = elapsed ? ` (${elapsed})` : ''
            if (!boxOpen) {
              if (renderTimer) { clearInterval(renderTimer); renderTimer = null }
              clearRenderArea()
              process.stdout.write(`\n  ${T.accent}◆${T.reset} async #${taskId} complete${suffix} ${T.dim}· /async view ${taskId}${T.reset}\n\n`)
              lastRenderLines = 0
              renderActivity()
              renderTimer = setInterval(renderActivity, 100)
            }
          }

          // ── Text token — stop spinner, open response panel ──
          if (evt.token !== undefined) {
            if (!boxOpen) stopActivityRender()
            writeToken(evt.token)
            fullReply += evt.token
            if (evt.provider) provider = evt.provider
          }

          // ── Done ──
          if (evt.done === true) {
            if (evt.provider) provider = evt.provider
            streamDone = true
            break
          }
        }
      }

      if (!boxOpen) stopActivityRender()
      closeResponseBox()
    }

    // ── Finalise state ──
    state.lastTurnMs = Date.now() - startedAt
    if (provider) state.lastProvider = provider
    state.turnCount++

    const totChars   = state.history.reduce((n, h) => n + h.content.length, 0) + message.length + fullReply.length
    state.ctxPercent = Math.min(99, Math.round(totChars / 160_000 * 100))

    if (fullReply.trim()) {
      state.history.push({ role: 'user',      content: message   })
      state.history.push({ role: 'assistant', content: fullReply })
    }

    // ── Provider switch indicator ──
    if (provider && provider !== prevProvider && prevProvider !== 'aiden') {
      process.stdout.write(`  ${T.dim}${prevProvider} ──→ ${provider}${T.reset}\n`)
    }

    // ── Status bar ──
    process.stdout.write(renderStatusBar({
      provider   : state.lastProvider,
      model      : state.lastModel || 'unknown',
      ctxUsed    : totChars,
      ctxMax     : 160_000,
      ctxPercent : state.ctxPercent,
      elapsedMs  : Date.now() - SESSION_START,
      asyncCount : 0,
      privateMode: state.privateMode,
    }) + '\n\n')

  } catch (err: any) {
    stopActivityRender()
    if (err?.name === 'AbortError') {
      process.stdout.write(`\n  ${T.warning}Interrupted.${T.reset}\n\n`)
    } else {
      process.stdout.write(`\n  ${T.error}✗ ${err?.message || err}${T.reset}\n`)
      process.stdout.write(`  ${T.dim}Is Aiden running? Start the desktop app first.${T.reset}\n\n`)
    }
  } finally {
    stopActivityRender()
    state.streaming = false
    state.abortCtrl = null
  }
}

// ── Commands ──────────────────────────────────────────────────────────────────────

const COMMANDS = [
  '/new', '/reset', '/clear', '/history', '/stop',
  '/export', '/fork', '/checkpoint', '/help',
  '/status', '/tools', '/kit', '/providers', '/models', '/model', '/primary',
  '/memory', '/goals', '/skills', '/recipes', '/sessions',
  '/analytics', '/budget', '/workspace',
  '/quick', '/compact', '/async', '/security', '/debug', '/config',
  '/theme', '/persona', '/detail', '/depth', '/provider',
  '/private',
  '/quit', '/exit', '/q',
]

function getPrompt(): string {
  const privTag = state.privateMode ? ` ${T.warning}[private]${T.reset}` : ''
  return `  ${fg(COLORS.orange)}${MARKS.TRI}${RST}${privTag} `
}

async function handleCommand(cmd: string, rl: readline.Interface): Promise<boolean> {
  const parts   = cmd.trim().split(/\s+/)
  const command = parts[0].toLowerCase()

  // ── /help ─────────────────────────────────────────────────────────────────────
  if (command === '/help') {
    const O  = fg(COLORS.orange)
    const D  = T.dim
    const R  = T.reset
    const B  = T.bold

    function helpRow(cmd: string, desc: string): string {
      return `  ${O}${cmd.padEnd(26)}${RST}${D}${desc}${R}`
    }
    function helpSection(title: string): string {
      return `\n  ${B}${MARKS.TRI} ${title}${R}\n  ${D}${hr()}${R}`
    }

    const lines: string[] = [
      helpSection('Session'),
      helpRow('/new  /reset',       'Start fresh session'),
      helpRow('/clear',             'Clear screen'),
      helpRow('/history',           'Conversation history'),
      helpRow('/stop',              'Interrupt execution'),
      helpRow('/export md|json',    'Export conversation'),
      helpRow('/fork <name>',       'Fork current session'),
      helpRow('/checkpoint',        'Save state snapshot'),
      helpSection('Info'),
      helpRow('/status',            'Health + uptime'),
      helpRow('/tools',             'All registered tools  (grouped by category)'),
      helpRow('/kit',               'Toolkit categories — enable / disable'),
      helpRow('/providers',         'Provider chain + rate limits'),
      helpRow('/models',            'Model assignments'),
      helpRow('/memory',            'Memory stats'),
      helpRow('/goals',             'Active goals'),
      helpRow('/skills',            'Loaded skills  (browse / inspect <n>)'),
      helpRow('/recipes',           'YAML recipes'),
      helpRow('/sessions',          'Recent sessions'),
      helpRow('/analytics',         'Usage over time'),
      helpRow('/budget',            'Token cost estimate'),
      helpRow('/workspace',         'Current workspace'),
      helpSection('Config'),
      helpRow('/model <name>',      'Switch model'),
      helpRow('/provider <name>',   'Switch provider  (add / remove / test)'),
      helpRow('/primary <name>',    'Pin provider to front of chain  (reset to clear)'),
      helpRow('/theme <name>',      'Change theme  (default mono slate ember)'),
      helpRow('/persona <name>',    'Change persona  (default concise technical)'),
      helpRow('/detail',            'Cycle detail level  (off → tools → verbose)'),
      helpRow('/depth',             'Cycle reasoning depth  (low → med → high)'),
      helpRow('/config',            'Show current configuration'),
      helpSection('Power'),
      helpRow('/quick <q>',         'Quick side question  (no history, no tools)'),
      helpRow('/compact',           'Manual context compression'),
      helpRow('/async <task>',      'Run task in background'),
      helpRow('/security',          'AgentShield scan'),
      helpRow('/debug',             'Recent logs'),
      helpRow('/private',           'Toggle private mode  (suppresses memory writes)'),
      helpSection('Exit'),
      helpRow('/quit  /exit  /q',   ''),
      '',
    ]

    console.log()
    console.log(panel({
      title: `${MARKS.TRI} ▲IDEN Commands`,
      lines,
      accent: COLORS.orange,
    }))
    console.log()
    return true
  }

  // ── /new / /reset ──────────────────────────────────────────────────────────────
  if (command === '/new' || command === '/reset') {
    state.history    = []
    state.turnCount  = 0
    state.ctxPercent = 0
    console.log(`  ${T.success}✓ New session started.${T.reset}\n`)
    return true
  }

  // ── /clear ─────────────────────────────────────────────────────────────────────
  if (command === '/clear') {
    console.clear()
    await printBanner()
    return true
  }

  // ── /history ───────────────────────────────────────────────────────────────────
  if (command === '/history') {
    if (state.history.length === 0) { console.log(`  ${T.dim}No history.${T.reset}\n`); return true }
    console.log()
    for (const h of state.history) {
      const label   = h.role === 'user' ? `${T.dim}you${T.reset}` : `${T.primary}Aiden${T.reset}`
      const preview = h.content.substring(0, 120).replace(/\n/g, ' ')
      console.log(`  ${label}  ${T.dim}${preview}${T.reset}`)
    }
    console.log()
    return true
  }

  // ── /stop ──────────────────────────────────────────────────────────────────────
  if (command === '/stop') {
    if (state.abortCtrl) {
      state.abortCtrl.abort()
      console.log(`  ${T.warning}Interrupted.${T.reset}\n`)
    } else {
      await apiPost('/api/stop')
      console.log(`  ${T.dim}No active generation.${T.reset}\n`)
    }
    return true
  }

  // ── /export md|json ────────────────────────────────────────────────────────────
  if (command === '/export') {
    const fmt = (parts[1] || 'json').toLowerCase()
    const ts  = Date.now()
    if (fmt === 'md' || fmt === 'markdown') {
      let md = `# Aiden Session\n\nSession: ${SESSION_ID}\nExported: ${new Date().toISOString()}\n\n---\n\n`
      for (const h of state.history) {
        md += h.role === 'user' ? `**You**\n\n${h.content}\n\n` : `**Aiden**\n\n${h.content}\n\n---\n\n`
      }
      const fname = `aiden-${ts}.md`
      fs.writeFileSync(fname, md)
      console.log(`  ${T.success}✓ Exported to ${fname}${T.reset}\n`)
    } else {
      const fname = `aiden-${ts}.json`
      fs.writeFileSync(fname, JSON.stringify({ session: SESSION_ID, exported: new Date().toISOString(), history: state.history }, null, 2))
      console.log(`  ${T.success}✓ Exported to ${fname}${T.reset}\n`)
    }
    return true
  }

  // ── /fork <name> ───────────────────────────────────────────────────────────────
  if (command === '/fork') {
    const name = parts.slice(1).join(' ') || `fork-${Date.now()}`
    const res  = await apiPost('/api/sessions/fork', { name, sessionId: SESSION_ID })
    if (res) {
      console.log(`  ${T.success}✓ Forked as "${name}"${T.reset}\n`)
    } else {
      const fname = `aiden-fork-${name.replace(/\s+/g, '-')}-${Date.now()}.json`
      fs.writeFileSync(fname, JSON.stringify({ name, parent: SESSION_ID, history: state.history, created: new Date().toISOString() }, null, 2))
      console.log(`  ${T.success}✓ Fork saved: ${fname}${T.reset}\n`)
    }
    return true
  }

  // ── /checkpoint ────────────────────────────────────────────────────────────────
  if (command === '/checkpoint') {
    const fname = `aiden-checkpoint-${Date.now()}.json`
    fs.writeFileSync(fname, JSON.stringify({ sessionId: SESSION_ID, history: state.history, turnCount: state.turnCount, timestamp: new Date().toISOString() }, null, 2))
    console.log(`  ${T.success}✓ Checkpoint saved: ${fname}${T.reset}\n`)
    return true
  }

  // ── /status ────────────────────────────────────────────────────────────────────
  if (command === '/status') {
    const h     = await apiFetch<any>('/api/debug/health', {})
    const ok    = h.status === 'ok'
    const upMin = Math.floor((h.uptime || 0) / 60)
    const ramMB = Math.round((h.memory?.heapUsed || 0) / 1024 / 1024)
    const ctxC  = ctxColor(state.ctxPercent)
    console.log()
    console.log(`  ${ok ? T.success + '✓' : T.error + '✗'}${T.reset} Aiden ${ok ? 'Online' : 'Offline'}`)
    console.log(`  ${T.dim}${hr()}${T.reset}`)
    console.log(`  ${'Uptime'.padEnd(14)}${upMin}m`)
    console.log(`  ${'RAM'.padEnd(14)}${ramMB} MB`)
    console.log(`  ${'Ollama'.padEnd(14)}${h.ollama || 'unknown'}`)
    console.log(`  ${'Sessions'.padEnd(14)}${h.workspace?.sessions || 0}`)
    console.log(`  ${'Memories'.padEnd(14)}${h.workspace?.memories || 0}`)
    console.log(`  ${'Context'.padEnd(14)}${ctxC}${ctxBar(state.ctxPercent)}${T.reset}`)
    console.log(`  ${'Turns'.padEnd(14)}${state.turnCount}/${MAX_TURNS}`)
    console.log()
    return true
  }

  // ── /tools ─────────────────────────────────────────────────────────────────────
  if (command === '/tools') {
    const tools = await apiFetch<any[]>('/api/tools', [])

    // Category → icon map (spec-defined)
    const CAT_ICONS: Record<string, string> = {
      browser:      '◈',
      file:         '▤',
      terminal:     '▣',
      web:          '◉',
      memory:       '⬢',
      delegation:   '◆',
      code:         '⬡',
      windows:      '▲',
      mcp:          '◎',
      voice:        '◐',
      schedule:     '⬟',
      vision:       '◪',
      'slash-mirror': '△',
      core:         '▸',
    }

    // Group by category (falling back to source, then 'other')
    const groups = new Map<string, any[]>()
    for (const t of tools) {
      const cat = (t.category || t.source || 'other').toLowerCase()
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(t)
    }

    // Build panel body lines
    const bodyLines: string[] = ['']
    for (const [cat, catTools] of groups) {
      const icon   = CAT_ICONS[cat] || MARKS.DOT
      const header =
        `  ${fg(COLORS.orange)}${icon}${RST} ${T.bold}${cat}${T.reset}` +
        `  ${T.dim}${catTools.length} tool${catTools.length !== 1 ? 's' : ''}${T.reset}`
      bodyLines.push(header)
      for (const t of catTools) {
        const name = (t.name || '').padEnd(22)
        const desc = (t.description || '').substring(0, 46)
        bodyLines.push(`    ${T.dim}${MARKS.ARROW}${T.reset} ${name}${T.dim}${desc}${T.reset}`)
      }
      bodyLines.push('')
    }

    const catCount = groups.size
    bodyLines.push(
      `  ${T.dim}${tools.length} tools · ${catCount} categor${catCount !== 1 ? 'ies' : 'y'}${T.reset}`,
    )
    bodyLines.push(
      `  ${T.dim}/tools enable <cat>  │  /tools disable <cat>${T.reset}`,
    )

    console.log()
    console.log(panel({ title: `${MARKS.TRI} Tools`, lines: bodyLines }))
    console.log()
    return true
  }

  // ── /kit ───────────────────────────────────────────────────────────────────────
  if (command === '/kit') {
    // Fetch tools and toolsets; fall back gracefully if toolsets endpoint absent
    const [tools, kitData] = await Promise.all([
      apiFetch<any[]>('/api/tools',    []),
      apiFetch<any>  ('/api/toolsets', null),
    ])

    // Build category summary from live tool list
    const catMap = new Map<string, { count: number; active: boolean }>()
    for (const t of tools) {
      const cat = (t.category || t.source || 'other').toLowerCase()
      const cur = catMap.get(cat)
      if (cur) { cur.count++ } else { catMap.set(cat, { count: 1, active: true }) }
    }

    // Merge with declared toolsets if available
    const declared: any[] = Array.isArray(kitData)
      ? kitData
      : Array.isArray(kitData?.toolsets)
        ? kitData.toolsets
        : []

    const CAT_ICONS: Record<string, string> = {
      browser: '◈', file: '▤', terminal: '▣', web: '◉',
      memory: '⬢', delegation: '◆', code: '⬡', windows: '▲',
      mcp: '◎', voice: '◐', schedule: '⬟', vision: '◪',
      'slash-mirror': '△', core: '▸',
    }

    const colDefs: ColDef[] = [
      { header: 'Kit',    width: 18, align: 'left' },
      { header: 'Tools',  width: 6,  align: 'right', color: COLORS.dim },
      { header: 'Status', width: 8,  align: 'left' },
      { header: 'Description' }, // flex
    ]

    // Merge declared + inferred
    const allCats = new Set<string>([
      ...catMap.keys(),
      ...declared.map((d: any) => (d.id || d.name || '').toLowerCase()),
    ])

    const rows: string[][] = []
    for (const cat of allCats) {
      const dec     = declared.find((d: any) => (d.id || d.name || '').toLowerCase() === cat)
      const inferred = catMap.get(cat)
      const count   = dec?.toolCount ?? inferred?.count ?? 0
      const active  = dec?.enabled   ?? inferred?.active ?? true
      const icon    = CAT_ICONS[cat] || MARKS.DOT
      const status  = active
        ? `${fg(COLORS.success)}[active]${RST}`
        : `${T.dim}[off]${T.reset}`
      const desc    = (dec?.description || '').substring(0, 40)
      const label   = `${fg(COLORS.orange)}${icon}${RST} ${cat}`
      rows.push([label, String(count), status, desc])
    }

    console.log()
    console.log(panel({
      title: `${MARKS.TRI} Kit`,
      lines: ['', ...['Kit categories — toggle with /kit enable <name>'].map(l => `  ${T.dim}${l}${T.reset}`), ''],
    }))
    console.log(table(colDefs, rows))
    console.log(`\n  ${T.dim}${tools.length} tools · ${allCats.size} categories${T.reset}\n`)
    return true
  }

  // ── /providers ─────────────────────────────────────────────────────────────────
  if (command === '/providers') {
    const [data, customData] = await Promise.all([
      apiFetch<any>('/api/providers', { apis: [], routing: {} }),
      apiFetch<any>('/api/providers/custom', { customProviders: [] }),
    ])
    const apis    = Array.isArray(data.apis) ? data.apis : []
    const customs = Array.isArray(customData.customProviders) ? customData.customProviders : []
    console.log(`\n  ${T.bold}Providers${T.reset}`)
    console.log(`  ${T.dim}${hr()}${T.reset}`)
    for (const a of apis) {
      const dot = a.enabled && a.hasKey ? `${T.success}●` : `${T.dim}○`
      const rl  = a.rateLimited ? ` ${T.warning}[rate-limited]${T.reset}` : ''
      console.log(`  ${dot}${T.reset} ${(a.name || '').padEnd(18)}${T.dim}${a.model || ''}${T.reset}${rl}`)
    }
    if (customs.length > 0) {
      console.log(`\n  ${T.dim}Custom (OpenAI-compat)${T.reset}`)
      for (const cp of customs) {
        const dot = cp.enabled ? `${T.success}●` : `${T.dim}○`
        console.log(`  ${dot}${T.reset} ${(cp.id || '').padEnd(18)}${T.dim}${cp.displayName} · ${cp.model || ''}${T.reset}`)
      }
    }
    if (data.routing?.mode) console.log(`\n  ${T.dim}Routing: ${data.routing.mode}${T.reset}`)
    console.log()
    return true
  }

  // ── /models  (or /model with no args) ─────────────────────────────────────────
  if (command === '/models' || (command === '/model' && parts.length === 1)) {
    const m   = await apiFetch<any>('/api/debug/models', {})
    const cfg = loadCfg()
    console.log()
    console.log(`  ${T.bold}Models${T.reset}`)
    console.log(`  ${T.dim}${hr()}${T.reset}`)
    console.log(`  ${'Active'.padEnd(14)}${T.accent}${cfg?.model?.activeModel || m.activeModel || 'unknown'}${T.reset}`)
    console.log(`  ${'Provider'.padEnd(14)}${cfg?.model?.active || m.activeProvider || 'unknown'}`)
    console.log(`  ${'Cloud'.padEnd(14)}${T.dim}${(m.providers    || []).join(', ') || 'none'}${T.reset}`)
    console.log(`  ${'Local'.padEnd(14)}${T.dim}${(m.ollamaModels || []).join(', ') || 'none'}${T.reset}`)
    console.log()
    return true
  }

  // ── /model <name> — switch ─────────────────────────────────────────────────────
  if (command === '/model' && parts.length > 1) {
    const modelName = parts.slice(1).join(' ')
    const res = await apiPost('/api/models/active', { model: modelName })
    if (res) {
      state.lastModel = modelName
      console.log(`  ${T.success}✓ Model: ${modelName}${T.reset}\n`)
    } else {
      const cfg = loadCfg()
      if (!cfg.model) cfg.model = {}
      cfg.model.activeModel = modelName
      saveCfg(cfg)
      state.lastModel = modelName
      console.log(`  ${T.success}✓ Model: ${modelName} ${T.dim}(saved to config)${T.reset}\n`)
    }
    return true
  }

  // ── /memory ────────────────────────────────────────────────────────────────────
  if (command === '/memory') {
    const m     = await apiFetch<any>('/api/memories', {})
    const total = Array.isArray(m) ? m.length : (m.total || m.count || 0)
    const sem   = m.semantic ?? 0
    const ent   = m.entities ?? 0
    console.log()
    console.log(`  ${T.bold}Memory${T.reset}`)
    console.log(`  ${T.dim}${hr()}${T.reset}`)
    console.log(`  ${'Total'.padEnd(16)}${num(total)}`)
    if (sem || ent) {
      console.log(`  ${'Semantic'.padEnd(16)}${num(sem)}`)
      console.log(`  ${'Entities'.padEnd(16)}${num(ent)}`)
    }
    console.log()
    return true
  }

  // ── /goals ─────────────────────────────────────────────────────────────────────
  if (command === '/goals') {
    const g     = await apiFetch<any>('/api/goals', { goals: [] })
    const goals = Array.isArray(g) ? g : (g.goals || [])
    if (goals.length === 0) {
      console.log(`  ${T.dim}No active goals.${T.reset}\n`)
    } else {
      console.log(`\n  ${T.bold}Goals${T.reset}`)
      console.log(`  ${T.dim}${hr()}${T.reset}`)
      for (const goal of goals) {
        const dot = goal.status === 'active' ? `${T.success}●` : `${T.dim}○`
        console.log(`  ${dot}${T.reset} ${goal.title || goal.id}`)
      }
      console.log()
    }
    return true
  }

  // ── /skills ────────────────────────────────────────────────────────────────────
  if (command === '/skills' || command === '/skills' && parts[1]) {
    const sub    = parts[1]?.toLowerCase()
    const skills = await apiFetch<any[]>('/api/skills', [])

    // ── /skills inspect <name|n> ────────────────────────────────────────────────
    if (sub === 'inspect') {
      const key = parts[2] ?? ''
      // Try by name first, then by 1-based index
      const s = skills.find((x: any) => x.name === key)
          ?? skills[parseInt(key, 10) - 1]
      if (!s) {
        console.log(`  ${T.error}No skill matching "${key}".${T.reset}\n`)
        return true
      }
      const skillName   = s.name || '(unnamed)'
      const sourceBadge = sourceBadgeStr(s.source || s.type || '')
      const trust       = trustStars(s.trust ?? 3)

      // Build detail rows — only render fields that actually exist in manifest
      const detailLines: string[] = ['']
      if (s.description) {
        // Word-wrap description at ~60 chars
        const words = (s.description as string).split(' ')
        let line = '  '
        for (const w of words) {
          if (line.length + w.length > 64) { detailLines.push(line.trimEnd()); line = '  ' }
          line += w + ' '
        }
        if (line.trim()) detailLines.push(line.trimEnd())
        detailLines.push('')
      }
      const field = (k: string, v: string) =>
        `  ${T.dim}${k.padEnd(14)}${T.reset}${v}`
      detailLines.push(field('Source',  sourceBadge))
      detailLines.push(field('Trust',   trust))
      if (s.version)      detailLines.push(field('Version',  `${T.dim}${s.version}${T.reset}`))
      if (s.tier)         detailLines.push(field('Tier',     `${T.dim}${s.tier}${T.reset}`))
      if (s.size)         detailLines.push(field('Size',     `${T.dim}${s.size}${T.reset}`))
      if (s.author)       detailLines.push(field('Author',   `${T.dim}${s.author}${T.reset}`))
      if (s.dependencies?.length) {
        detailLines.push(field('Dependencies', `${T.dim}${s.dependencies.join(', ')}${T.reset}`))
      } else if (s.dependencies === 'none' || s.dependencies === null) {
        detailLines.push(field('Dependencies', `${T.dim}none${T.reset}`))
      }
      if (s.enabled !== undefined) {
        detailLines.push(field('Enabled',
          s.enabled ? `${fg(COLORS.success)}●${RST}` : `${T.dim}○${T.reset}`))
      }
      detailLines.push('')
      if (!s.installed) {
        detailLines.push(`  ${fg(COLORS.orange)}${MARKS.TRI}${RST} /skills install ${skillName}`)
        detailLines.push('')
      }

      console.log()
      console.log(panel({ title: `${MARKS.TRI} ${skillName}`, lines: detailLines }))
      console.log()
      return true
    }

    // ── /skills list / /skills browse / /skills (default) ─────────────────────
    const PAGE_SIZE = 10
    const page  = sub === 'browse' ? (parseInt(parts[2] ?? '1', 10) - 1) : 0
    const start = page * PAGE_SIZE
    const slice = skills.slice(start, start + PAGE_SIZE)
    const total = skills.length
    const pages = Math.ceil(Math.max(total, 1) / PAGE_SIZE)

    const installed  = skills.filter((s: any) => s.installed || s.enabled).length
    const pro        = skills.filter((s: any) => s.tier === 'pro').length

    const colDefs: ColDef[] = [
      { header: '#',           width: 4,  align: 'right', color: COLORS.dim },
      { header: 'Skill',       width: 20, align: 'left'  },
      { header: 'Description'                             }, // flex
      { header: 'Source',      width: 10, align: 'left'  },
      { header: 'Trust',       width: 7,  align: 'left'  },
    ]
    const rows = slice.map((s: any, i: number) => [
      String(start + i + 1),
      (s.name || '').substring(0, 20),
      (s.description || '').substring(0, 55),
      sourceBadgeStr(s.source || s.type || ''),
      trustStars(s.trust ?? 3),
    ])

    const footerStats = `${total} skills · ${installed} installed${pro > 0 ? ` · ${pro} pro` : ''} · page ${page + 1}/${pages}`
    const footerNav   = pages > 1
      ? `${MARKS.TRI} /skills install <name>   n → next   p → prev   q → quit`
      : `${MARKS.TRI} /skills install <name>   /skills inspect <n|name>`

    console.log()
    console.log(panel({
      title: `${MARKS.TRI} Skill Store`,
      lines: [
        '',
        ...rows.length === 0 ? [`  ${T.dim}No skills loaded.${T.reset}`] : [],
      ],
    }))
    console.log(table(colDefs, rows))
    console.log()
    console.log(`  ${T.dim}${footerStats}${T.reset}`)
    console.log(`  ${T.dim}${footerNav}${T.reset}`)
    console.log()
    return true
  }

  // ── /recipes ───────────────────────────────────────────────────────────────────
  if (command === '/recipes') {
    const r       = await apiFetch<any>('/api/recipes', [])
    const recipes = Array.isArray(r) ? r : (r.recipes || [])
    if (recipes.length === 0) {
      console.log(`  ${T.dim}No recipes.${T.reset}\n`)
    } else {
      console.log(`\n  ${T.bold}Recipes${T.reset}`)
      console.log(`  ${T.dim}${hr()}${T.reset}`)
      for (const rec of recipes) {
        console.log(`  ${T.accent}▸${T.reset} ${rec.name || rec.id}  ${T.dim}${(rec.description || '').substring(0, 60)}${T.reset}`)
      }
      console.log()
    }
    return true
  }

  // ── /sessions ──────────────────────────────────────────────────────────────────
  if (command === '/sessions') {
    const sessions = await apiFetch<any[]>('/api/sessions', [])
    console.log(`\n  ${T.bold}Sessions (${sessions.length})${T.reset}`)
    console.log(`  ${T.dim}${hr()}${T.reset}`)
    for (const s of sessions.slice(0, 10)) {
      const ts  = s.timestamp ? new Date(s.timestamp).toLocaleString() : '—'
      const pre = (s.preview || s.title || s.id || '').substring(0, 50)
      console.log(`  ${T.dim}${ts}${T.reset}  ${pre}`)
    }
    if (sessions.length > 10) console.log(`  ${T.dim}…and ${sessions.length - 10} more${T.reset}`)
    console.log()
    return true
  }

  // ── /analytics ─────────────────────────────────────────────────────────────────
  if (command === '/analytics') {
    const [usage, sessions, mem] = await Promise.all([
      apiFetch<any>('/api/usage',     {}),
      apiFetch<any[]>('/api/sessions', []),
      apiFetch<any>('/api/memories',  {}),
    ])

    const totalSessions = sessions.length       || usage.sessions      || 0
    const totalMessages = usage.messages        || usage.totalMessages  || 0
    const toolCalls     = usage.toolCalls       || 0
    const userMsgs      = usage.userMessages    || Math.round(totalMessages / 2) || 0
    const inTok         = usage.inputTokens     || 0
    const outTok        = usage.outputTokens    || 0
    const totTok        = inTok + outTok        || usage.totalTokens   || 0
    const cost          = usage.cost            || usage.totalCost     || (totTok / 1_000_000 * 0.10)
    const activeTime    = usage.activeTimeMs    ? fmtDuration(usage.activeTimeMs)  : '—'
    const avgSession    = usage.avgSessionMs    ? fmtDuration(usage.avgSessionMs)  : '—'
    const models: any[] = usage.models          || usage.modelBreakdown || []
    const tools: any[]  = usage.tools           || usage.topTools       || []
    const activity: any = usage.activity        || usage.daily          || {}
    const ctxC          = ctxColor(state.ctxPercent)

    const LINE = `  ${T.dim}${hr()}${T.reset}`

    console.log()
    console.log(`  ${T.bold}Aiden Analytics · Last 30 days${T.reset}`)
    console.log(LINE)
    console.log()
    console.log(`  ${T.bold}Overview${T.reset}`)
    console.log(LINE)

    const row = (a: string, av: string, b: string, bv: string): void => {
      console.log(`  ${a.padEnd(18)}${av.padEnd(16)}${b.padEnd(18)}${bv}`)
    }
    row('Sessions',      String(totalSessions), 'Messages',      String(totalMessages))
    row('Tool calls',    String(toolCalls),      'User msgs',     String(userMsgs))
    row('Input tokens',  num(inTok),             'Output tokens', num(outTok))
    row('Total tokens',  num(totTok),            'Est. cost',     `$${typeof cost === 'number' ? cost.toFixed(2) : cost}`)
    row('Active time',   activeTime,             'Avg session',   avgSession)

    console.log()
    console.log(`  ${T.bold}This Session${T.reset}`)
    console.log(LINE)
    console.log(`  ${'Context'.padEnd(18)}${ctxC}${ctxBar(state.ctxPercent)}${T.reset}`)
    console.log(`  ${'Turns'.padEnd(18)}${state.turnCount}/${MAX_TURNS}`)

    if (models.length > 0) {
      console.log()
      console.log(`  ${T.bold}Models Used${T.reset}`)
      console.log(LINE)
      console.log(`  ${'Model'.padEnd(28)}${'Sessions'.padEnd(12)}${'Tokens'.padEnd(14)}Cost`)
      for (const m of models) {
        const mname = (m.model || m.name || '').padEnd(28)
        const msess = String(m.sessions || 0).padEnd(12)
        const mtok  = num(m.tokens || 0).padEnd(14)
        const mcost = `$${(m.cost || 0).toFixed(2)}`
        console.log(`  ${T.dim}${mname}${msess}${mtok}${mcost}${T.reset}`)
      }
    }

    if (tools.length > 0) {
      console.log()
      console.log(`  ${T.bold}Top Tools${T.reset}`)
      console.log(LINE)
      console.log(`  ${'Tool'.padEnd(24)}${'Calls'.padEnd(10)}%`)
      for (const t of tools.slice(0, 10)) {
        const pct    = toolCalls > 0 ? Math.round((t.calls || 0) / toolCalls * 100) : (t.pct || 0)
        const tname  = (t.name || t.tool || '').padEnd(24)
        const tcalls = String(t.calls || 0).padEnd(10)
        console.log(`  ${T.dim}${tname}${tcalls}${pct}%${T.reset}`)
      }
    }

    // Activity bar chart
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const dayData: Record<string, number> = {}
    if (typeof activity === 'object' && !Array.isArray(activity)) {
      for (const [k, v] of Object.entries(activity)) {
        dayData[k] = Number(v) || 0
      }
    }

    if (Object.keys(dayData).length > 0) {
      console.log()
      console.log(`  ${T.bold}Activity${T.reset}`)
      console.log(LINE)
      const maxVal = Math.max(...days.map(d => dayData[d.toLowerCase()] || dayData[d] || 0), 1)
      for (const day of days) {
        const val  = dayData[day.toLowerCase()] || dayData[day] || 0
        const bars = Math.round((val / maxVal) * 10)
        const bar  = '▮'.repeat(bars)
        console.log(`  ${T.dim}${day}  ${T.reset}${T.accent}${bar.padEnd(10)}${T.reset}  ${T.dim}${val}${T.reset}`)
      }
    }

    if (mem && typeof mem === 'object') {
      const total = Array.isArray(mem) ? mem.length : (mem.total || 0)
      if (total > 0) console.log(`\n  ${T.dim}Memory: ${num(total)} total · ${num(mem.semantic || 0)} semantic · ${num(mem.entities || 0)} entities${T.reset}`)
    }

    console.log()
    return true
  }

  // ── /budget ────────────────────────────────────────────────────────────────────
  if (command === '/budget') {
    const totChars  = state.history.reduce((n, h) => n + h.content.length, 0)
    const approxTok = Math.round(totChars / 4)
    const ctxC      = ctxColor(state.ctxPercent)
    console.log()
    console.log(`  ${T.bold}Token Budget (session estimate)${T.reset}`)
    console.log(`  ${T.dim}${hr()}${T.reset}`)
    console.log(`  ${'Context used'.padEnd(18)}~${num(approxTok)} tokens`)
    console.log(`  ${'Context bar'.padEnd(18)}${ctxC}${ctxBar(state.ctxPercent)}${T.reset}`)
    console.log(`  ${'Turns'.padEnd(18)}${state.turnCount}/${MAX_TURNS}`)
    console.log(`  ${'Session'.padEnd(18)}${T.dim}${SESSION_ID}${T.reset}`)
    console.log()
    return true
  }

  // ── /workspace ─────────────────────────────────────────────────────────────────
  if (command === '/workspace') {
    const ws   = await apiFetch<any>('/api/workspaces', {})
    const list = Array.isArray(ws) ? ws : (ws.workspaces || [])
    if (list.length === 0) {
      console.log(`  ${T.dim}No workspaces.${T.reset}\n`)
    } else {
      console.log(`\n  ${T.bold}Workspaces${T.reset}`)
      console.log(`  ${T.dim}${hr()}${T.reset}`)
      for (const w2 of list) {
        const active = w2.active ? ` ${T.primary}[active]${T.reset}` : ''
        console.log(`  ${T.accent}▸${T.reset} ${w2.name || w2.id}${active}  ${T.dim}${w2.path || ''}${T.reset}`)
      }
      console.log()
    }
    return true
  }

  // ── /quick <question> ─────────────────────────────────────────────────────────
  if (command === '/quick') {
    const question = parts.slice(1).join(' ')
    if (!question) { console.log(`  ${T.dim}Usage: /quick <question>${T.reset}\n`); return true }
    process.stdout.write(`  ${T.dim}◆${T.reset}  `)
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body   : JSON.stringify({ message: question, mode: 'auto', history: [] }),
        signal : AbortSignal.timeout(30000),
      })
      if (!res.ok) { console.log(`\n  ${T.error}✗ ${res.status}${T.reset}\n`); return true }
      const isSSE = (res.headers.get('content-type') || '').includes('text/event-stream')
      if (!isSSE) {
        const data = await res.json() as any
        process.stdout.write((data.reply || data.message || data.content || '') + '\n\n')
      } else {
        const reader  = (res.body as any).getReader()
        const decoder = new TextDecoder()
        let   buf     = ''
        let   done2   = false
        while (!done2) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n'); buf = lines.pop() || ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') { done2 = true; break }
            let evt: any; try { evt = JSON.parse(raw) } catch { continue }
            if (evt.token) process.stdout.write(evt.token)
            if (evt.done)  { done2 = true; break }
          }
        }
        process.stdout.write('\n\n')
      }
    } catch (err: any) {
      console.log(`\n  ${T.error}✗ ${err?.message}${T.reset}\n`)
    }
    return true
  }

  // ── /compact ───────────────────────────────────────────────────────────────────
  if (command === '/compact') {
    console.log(`  ${T.dim}Compressing context…${T.reset}`)
    const res = await apiPost('/api/context/compact', { sessionId: SESSION_ID })
    if (res) {
      console.log(`  ${T.success}✓ Context compressed${T.reset}\n`)
    } else if (state.history.length > 10) {
      state.history = state.history.slice(-10)
      console.log(`  ${T.success}✓ Trimmed to last 5 turns${T.reset}\n`)
    } else {
      console.log(`  ${T.dim}Nothing to compact.${T.reset}\n`)
    }
    return true
  }

  // ── /async [list | view <id> | <task prompt>] ─────────────────────────────────
  if (command === '/async') {
    const sub  = parts[1]
    const divW = cols() - 4

    // /async list — show all background tasks
    if (sub === 'list') {
      const tasks = await apiFetch<any[]>('/api/async', [])
      if (!tasks || tasks.length === 0) {
        console.log(`  ${T.dim}No async tasks yet.${T.reset}\n`)
      } else {
        console.log()
        for (const t of tasks) {
          const dot = t.status === 'complete' ? `${T.success}●${T.reset}` :
                      t.status === 'failed'   ? `${T.error}●${T.reset}`   :
                                                `${T.accent}◌${T.reset}`
          const elapsed = t.elapsed ? ` ${T.dim}(${fmtDuration(t.elapsed)})${T.reset}` : ''
          console.log(`  ${dot} ${t.id}${elapsed}  ${T.dim}${(t.prompt || '').slice(0, 50)}${T.reset}`)
        }
        console.log()
      }
      return true
    }

    // /async view <id> — fetch and display full result
    if (sub === 'view') {
      const taskId = parts[2]
      if (!taskId) { console.log(`  ${T.dim}Usage: /async view <id>${T.reset}\n`); return true }
      const t = await apiFetch<any>(`/api/async/${taskId}`, {})
      if (!t || t.error === 'Task not found') {
        console.log(`  ${T.error}✗ Task not found: ${taskId}${T.reset}\n`); return true
      }
      const elapsed  = t.elapsed ? ` (${fmtDuration(t.elapsed)})` : ''
      const statusDot = t.status === 'complete' ? `${T.success}●${T.reset}` :
                        t.status === 'failed'   ? `${T.error}●${T.reset}`   :
                                                  `${T.accent}◌${T.reset}`
      console.log()
      console.log(`  ${T.dim}${'─'.repeat(divW)}${T.reset}`)
      console.log(`  ${statusDot} async ${taskId}${T.dim}${elapsed}${T.reset}`)
      console.log(`  ${T.dim}${'─'.repeat(divW)}${T.reset}`)
      if (t.status === 'running') {
        console.log(`  ${T.dim}Still running…${T.reset}`)
      } else if (t.status === 'failed') {
        console.log(`  ${T.error}✗ ${t.error || 'Unknown error'}${T.reset}`)
      } else {
        const reply = (t.result || '').trim()
        process.stdout.write('  ')
        let linePos = 0
        const avail = cols() - 5
        for (const ch of reply) {
          if (ch === '\n') { process.stdout.write('\n  '); linePos = 0 }
          else {
            if (linePos >= avail) { process.stdout.write('\n  '); linePos = 0 }
            process.stdout.write(ch); linePos++
          }
        }
        process.stdout.write('\n')
      }
      console.log(`  ${T.dim}${'─'.repeat(divW)}${T.reset}`)
      console.log()
      return true
    }

    // /async <task prompt> — spawn a new background task
    const task = parts.slice(1).join(' ')
    if (!task) {
      console.log(`  ${T.dim}Usage: /async <task>  |  /async list  |  /async view <id>${T.reset}\n`)
      return true
    }
    const res    = await apiPost('/api/async', { prompt: task })
    const taskId = res?.taskId || res?.id || String(Date.now()).slice(-4)
    console.log()
    console.log(`  ${T.dim}${'─'.repeat(divW)}${T.reset}`)
    console.log(`  ${T.accent}◆${T.reset} async #${taskId}  ${T.dim}${task.substring(0, divW - String(taskId).length - 16)}${T.reset}`)
    console.log(`  ${T.dim}${'─'.repeat(divW)}${T.reset}`)
    console.log(`  ${T.dim}Running in background · /async view ${taskId}${T.reset}`)
    console.log()
    return true
  }

  // ── /security ──────────────────────────────────────────────────────────────────
  if (command === '/security') {
    console.log(`  ${T.dim}Running security scan…${T.reset}`)
    const scan    = await apiFetch<any>('/api/security/scan', {})
    const threats = scan.threats || scan.issues || []
    if (threats.length === 0) {
      console.log(`  ${T.success}✓ No threats detected${T.reset}\n`)
    } else {
      console.log(`  ${T.error}✗ ${threats.length} issue(s) found:${T.reset}`)
      for (const t of threats) console.log(`    ${T.warning}◆${T.reset} ${t.message || JSON.stringify(t)}`)
      console.log()
    }
    return true
  }

  // ── /debug ─────────────────────────────────────────────────────────────────────
  if (command === '/debug') {
    const logs  = await apiFetch<any>('/api/debug/logs', { logs: [] })
    const lines = Array.isArray(logs) ? logs : (logs.logs || [])
    console.log(`\n  ${T.bold}Debug logs (last 20)${T.reset}`)
    console.log(`  ${T.dim}${hr()}${T.reset}`)
    for (const l of lines.slice(-20)) console.log(`  ${T.dim}${l}${T.reset}`)
    console.log()
    return true
  }

  // ── /private ───────────────────────────────────────────────────────────────────
  if (command === '/private') {
    try {
      const result = await apiPost('/api/private', { sessionId: SESSION_ID })
      state.privateMode = result.private === true
      if (state.privateMode) {
        console.log(`\n  ${T.warning}🔒 Private mode ON${T.reset} — memory writes suppressed for this session.\n`)
      } else {
        console.log(`\n  ${T.success}🔓 Private mode OFF${T.reset} — memory writes resumed.\n`)
      }
      rl.setPrompt(getPrompt())
    } catch {
      console.log(`  ${T.error}Could not toggle private mode — server unavailable.${T.reset}\n`)
    }
    return true
  }

  // ── /config ────────────────────────────────────────────────────────────────────
  if (command === '/config') {
    const cfg = loadCfg()
    const h   = await apiFetch<any>('/api/health', {})
    console.log()
    console.log(`  ${T.bold}Aiden Configuration${T.reset}`)
    console.log(`  ${T.dim}${hr()}${T.reset}`)
    console.log(`  ${'Model'.padEnd(16)}${T.accent}${cfg?.model?.activeModel || 'unknown'}${T.reset}`)
    console.log(`  ${'Provider'.padEnd(16)}${cfg?.model?.active || 'unknown'}`)
    console.log(`  ${'Workspace'.padEnd(16)}${T.dim}${cfg?.workspace?.path || process.cwd()}${T.reset}`)
    console.log(`  ${'Theme'.padEnd(16)}${state.themeName}`)
    console.log(`  ${'Persona'.padEnd(16)}${state.persona}`)
    console.log(`  ${'Detail'.padEnd(16)}${state.detailLevel}`)
    console.log(`  ${'Depth'.padEnd(16)}${state.depthLevel}`)
    console.log(`  ${'Session'.padEnd(16)}${T.dim}${SESSION_ID}${T.reset}`)
    console.log(`  ${'Started'.padEnd(16)}${T.dim}${new Date(SESSION_START).toLocaleString()}${T.reset}`)
    console.log(`  ${'Config file'.padEnd(16)}${T.dim}${CONFIG_PATH}${T.reset}`)
    if (h.version) console.log(`  ${'Version'.padEnd(16)}${h.version}`)
    console.log()
    return true
  }

  // ── /theme <name> ──────────────────────────────────────────────────────────────
  if (command === '/theme') {
    const name = (parts[1] || '') as ThemeName
    if (!name || !THEMES[name]) {
      console.log(`  ${T.dim}Usage: /theme <default|mono|slate|ember>${T.reset}\n`)
      return true
    }
    applyTheme(name)
    state.themeName = name
    rl.setPrompt(getPrompt())
    const cfg = loadCfg()
    if (!cfg.cli) cfg.cli = {}
    cfg.cli.theme = name
    saveCfg(cfg)
    console.log(`  ${T.success}✓ Theme: ${name}${T.reset}\n`)
    return true
  }

  // ── /persona <name> ────────────────────────────────────────────────────────────
  if (command === '/persona') {
    const name = parts[1] || 'default'
    state.persona = name
    console.log(`  ${T.success}✓ Persona: ${name}${T.reset}\n`)
    return true
  }

  // ── /detail ────────────────────────────────────────────────────────────────────
  if (command === '/detail') {
    const levels: Array<'off' | 'tools' | 'verbose'> = ['off', 'tools', 'verbose']
    state.detailLevel = levels[(levels.indexOf(state.detailLevel) + 1) % levels.length]
    console.log(`  ${T.success}✓ Detail: ${state.detailLevel}${T.reset}\n`)
    return true
  }

  // ── /depth ─────────────────────────────────────────────────────────────────────
  if (command === '/depth') {
    const levels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high']
    state.depthLevel = levels[(levels.indexOf(state.depthLevel) + 1) % levels.length]
    console.log(`  ${T.success}✓ Depth: ${state.depthLevel}${T.reset}\n`)
    return true
  }

  // ── /provider [sub] ────────────────────────────────────────────────────────────
  if (command === '/provider') {
    const sub = parts[1]

    // /provider add — interactive wizard for adding a custom provider
    if (sub === 'add') {
      const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout })
      const ask = (q: string) => new Promise<string>(res => rl2.question(`  ${T.dim}${q}${T.reset} `, res))
      try {
        console.log(`\n  ${T.bold}Add Custom Provider${T.reset}`)
        console.log(`  ${T.dim}Any OpenAI-compatible chat/completions endpoint.${T.reset}\n`)
        const displayName = await ask('Display name:')
        const baseUrl     = await ask('Base URL (full endpoint):')
        const apiKey      = await ask('API key (enter to skip):')
        const model       = await ask('Model name:')
        rl2.close()
        if (!displayName.trim() || !baseUrl.trim() || !model.trim()) {
          console.log(`  ${T.error}✗ display name, URL and model are required.${T.reset}\n`)
          return true
        }
        const r = await fetch('http://localhost:4200/api/providers/custom', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName, baseUrl, apiKey, model }),
        })
        if (r.ok) {
          const d = await r.json() as any
          console.log(`  ${T.success}✓ Added: ${d.entry?.id || displayName}${T.reset}\n`)
        } else {
          console.log(`  ${T.error}✗ Failed to add provider.${T.reset}\n`)
        }
      } catch {
        rl2.close()
        console.log(`  ${T.error}✗ Aborted.${T.reset}\n`)
      }
      return true
    }

    // /provider remove <id>
    if (sub === 'remove') {
      const id = parts[2]
      if (!id) { console.log(`  ${T.dim}Usage: /provider remove <id>${T.reset}\n`); return true }
      const r = await fetch(`http://localhost:4200/api/providers/custom/${id}`, { method: 'DELETE' })
      if (r.ok) console.log(`  ${T.success}✓ Removed: ${id}${T.reset}\n`)
      else      console.log(`  ${T.error}✗ Could not remove ${id}${T.reset}\n`)
      return true
    }

    // /provider test <id>
    if (sub === 'test') {
      const id = parts[2]
      if (!id) { console.log(`  ${T.dim}Usage: /provider test <id>${T.reset}\n`); return true }
      process.stdout.write(`  ${T.dim}Testing ${id}...${T.reset}`)
      try {
        const r    = await fetch(`http://localhost:4200/api/providers/custom/${id}/test`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
        })
        const data = await r.json() as any
        process.stdout.write('\r\x1b[K')
        if (data.valid) console.log(`  ${T.success}✓ ${id}: ${data.reply || 'ok'}${T.reset}\n`)
        else            console.log(`  ${T.error}✗ ${id}: ${data.error || 'failed'}${T.reset}\n`)
      } catch (e: any) {
        process.stdout.write('\r\x1b[K')
        console.log(`  ${T.error}✗ ${id}: ${e.message}${T.reset}\n`)
      }
      return true
    }

    // /provider <name> — switch active provider (legacy behaviour)
    const name = sub
    if (!name) {
      console.log(`  ${T.dim}Usage: /provider <name>  |  /provider add  |  /provider remove <id>  |  /provider test <id>${T.reset}\n`)
      return true
    }
    const res = await apiPost('/api/providers/active', { provider: name })
    if (res) {
      state.lastProvider = name
      console.log(`  ${T.success}✓ Provider: ${name}${T.reset}\n`)
    } else {
      console.log(`  ${T.error}✗ Could not switch to ${name}${T.reset}\n`)
    }
    return true
  }

  // ── /quit / /exit / /q ─────────────────────────────────────────────────────────
  if (command === '/quit' || command === '/exit' || command === '/q') {
    printSessionSummary()
    process.exit(0)
  }

  // ── /primary [name|reset] ─────────────────────────────────────────────────────
  if (command === '/primary') {
    const arg = parts[1]
    try {
      if (!arg) {
        // Show current primary
        const data = await apiFetch<any>('/api/config/primary', {})
        const pin = data?.primaryProvider
        if (pin) console.log(`\n  ${T.success}Primary provider: ${pin}${T.reset}\n`)
        else     console.log(`\n  ${T.dim}No primary provider set (default ordering)${T.reset}\n`)
      } else if (arg === 'reset') {
        const r = await fetch('http://localhost:4200/api/config/primary', { method: 'DELETE' })
        if (r.ok) console.log(`\n  ${T.success}✓ Primary provider cleared — default ordering restored${T.reset}\n`)
        else      console.log(`\n  ${T.error}✗ Failed to clear primary provider${T.reset}\n`)
      } else {
        const r = await fetch('http://localhost:4200/api/config/primary', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: arg }),
        })
        if (r.ok) console.log(`\n  ${T.success}✓ Primary provider pinned: ${arg}${T.reset}\n`)
        else      console.log(`\n  ${T.error}✗ Failed to set primary provider${T.reset}\n`)
      }
    } catch {
      console.log(`\n  ${T.error}✗ Could not reach server.${T.reset}\n`)
    }
    return true
  }

  console.log(`  ${T.dim}Unknown command. /help for list.${T.reset}\n`)
  return true
}

// ── Tab completer ─────────────────────────────────────────────────────────────────

function completer(line: string): [string[], string] {
  if (!line.startsWith('/')) return [[], line]
  const hits = COMMANDS.filter(c => c.startsWith(line))
  return [hits.length ? hits : COMMANDS, line]
}

// ── Session resume helpers ─────────────────────────────────────────────────────────

async function loadSession(id: string): Promise<void> {
  const session = await apiFetch<any>(`/api/sessions/${id}`, null)
  if (!session || !Array.isArray(session.exchanges)) {
    console.log(`\n  ${T.error}✗ Session "${id}" not found.${T.reset}`)
    console.log(`  ${T.dim}Use --list to see available sessions.${T.reset}\n`)
    process.exit(1)
  }

  // Reuse the old session ID so the server loads the right memory context
  SESSION_ID   = session.id || id
  RESUMED_FROM = SESSION_ID

  // Populate local history so streamChat includes prior context in histPayload
  for (const ex of session.exchanges as any[]) {
    if (ex.userMessage?.trim()) state.history.push({ role: 'user',      content: ex.userMessage })
    if (ex.aiReply?.trim())     state.history.push({ role: 'assistant', content: ex.aiReply     })
  }
  // Cap at 20 to avoid context bloat
  if (state.history.length > 20) state.history = state.history.slice(-20)

  // Print recap
  const ago      = session.updatedAt ? fmtDuration(Date.now() - session.updatedAt) : 'unknown'
  const msgCount = session.messageCount ?? (session.exchanges as any[]).length
  const lastUser = (session.exchanges as any[]).filter((e: any) => e.userMessage?.trim()).slice(-1)[0]
  const lastMsg  = lastUser?.userMessage || ''
  const preview  = lastMsg
    ? `"${lastMsg.slice(0, 55).replace(/\n/g, ' ')}${lastMsg.length > 55 ? '...' : ''}"`
    : ''
  const div = `  ${T.dim}${'─'.repeat(cols() - 4)}${T.reset}`

  console.log()
  console.log(`  ${T.accent}◆${T.reset} Resumed session`)
  console.log(div)
  console.log(`  ${'ID'.padEnd(12)}${T.dim}${SESSION_ID}${T.reset}`)
  console.log(`  ${'Last active'.padEnd(12)}${T.dim}${ago} ago${T.reset}`)
  console.log(`  ${'Messages'.padEnd(12)}${T.dim}${msgCount}${T.reset}`)
  if (preview) console.log(`  ${'Last msg'.padEnd(12)}${T.dim}${preview}${T.reset}`)
  console.log(div)
  console.log()
}

async function resolveSessionArgs(): Promise<void> {
  const args = process.argv.slice(2)

  // ── --list / -l ──────────────────────────────────────────────────────────────
  if (args.includes('--list') || args.includes('-l')) {
    const sessions = await apiFetch<any[]>('/api/sessions', [])
    if (!sessions || sessions.length === 0) {
      console.log(`\n  ${T.dim}No sessions found.${T.reset}\n`)
    } else {
      console.log()
      console.log(`  Recent Sessions`)
      console.log(`  ${T.dim}${'─'.repeat(cols() - 4)}${T.reset}`)
      for (const s of sessions.slice(0, 15)) {
        const ago   = fmtDuration(Date.now() - s.timestamp)
        const msgs  = `${s.messageCount} msg${s.messageCount !== 1 ? 's' : ''}`
        const idStr = s.id.length > 22 ? `...${s.id.slice(-18)}` : s.id
        const prev  = (s.preview || '').slice(0, 40)
        console.log(`  ${T.accent}${idStr}${T.reset}  ${T.dim}${ago.padEnd(10)} · ${msgs.padEnd(8)}${T.reset}  ${prev}`)
      }
      console.log()
      console.log(`  ${T.dim}Resume: npm run cli -- --resume <id>${T.reset}`)
      console.log()
    }
    process.exit(0)
  }

  // ── --continue / -c ──────────────────────────────────────────────────────────
  if (args.includes('--continue') || args.includes('-c')) {
    const sessions = await apiFetch<any[]>('/api/sessions', [])
    const last     = sessions?.[0]
    if (!last) {
      console.log(`\n  ${T.dim}No previous session found.${T.reset}\n`)
      return
    }
    await loadSession(last.id)
    return
  }

  // ── --resume <id> / -r <id> ───────────────────────────────────────────────────
  const rIdx = Math.max(args.indexOf('--resume'), args.indexOf('-r'))
  if (rIdx >= 0) {
    const id = args[rIdx + 1]
    if (!id || id.startsWith('-')) {
      console.log(`\n  ${T.error}✗ --resume requires a session ID.${T.reset}`)
      console.log(`  ${T.dim}Example: npm run cli -- --resume session_1744899123456${T.reset}`)
      console.log(`  ${T.dim}List sessions: npm run cli -- --list${T.reset}\n`)
      process.exit(1)
    }
    await loadSession(id)
    return
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const health = await apiFetch<any>('/api/health', null)
  if (!health || health.status !== 'ok') {
    console.log(`\n  ${T.error}✗ Cannot connect to Aiden at ${API_BASE}${T.reset}`)
    console.log(`  ${T.dim}Start the Aiden desktop app first, or set AIDEN_API env var.${T.reset}\n`)
    process.exit(1)
  }

  await resolveSessionArgs()

  await printBanner()

  const rl = readline.createInterface({
    input    : process.stdin,
    output   : process.stdout,
    prompt   : getPrompt(),
    completer,
    terminal : true,
  })

  rl.prompt()

  let histIdx   = -1
  let lastCtrlC = 0

  rl.on('keypress', (_ch: any, key: any) => {
    if (!key) return
    if (key.name === 'up') {
      if (histIdx < state.inputHistory.length - 1) {
        histIdx++
        const entry = state.inputHistory[state.inputHistory.length - 1 - histIdx] || ''
        ;(rl as any).line   = entry
        ;(rl as any).cursor = entry.length
        ;(rl as any)._refreshLine?.()
      }
    } else if (key.name === 'down') {
      if (histIdx > 0) {
        histIdx--
        const entry = state.inputHistory[state.inputHistory.length - 1 - histIdx] || ''
        ;(rl as any).line   = entry
        ;(rl as any).cursor = entry.length
        ;(rl as any)._refreshLine?.()
      } else {
        histIdx             = -1
        ;(rl as any).line   = ''
        ;(rl as any).cursor = 0
        ;(rl as any)._refreshLine?.()
      }
    }
  })

  rl.on('SIGINT', async () => {
    if (state.streaming) {
      state.abortCtrl?.abort()
      await apiPost('/api/stop')
      process.stdout.write(`\n  ${T.warning}Interrupted.${T.reset}\n\n`)
      rl.prompt()
      return
    }
    const now = Date.now()
    if (now - lastCtrlC < 2000) {
      printSessionSummary()
      process.exit(0)
    }
    lastCtrlC = now
    process.stdout.write(`\n  ${T.dim}Press Ctrl+C again to exit.${T.reset}\n`)
    rl.prompt()
  })

  rl.on('line', async (line: string) => {
    histIdx = -1
    const input = line.trim()
    if (!input) { rl.prompt(); return }

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
    printSessionSummary()
    process.exit(0)
  })
}

main()
