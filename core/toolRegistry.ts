// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/toolRegistry.ts — Centralized tool registry with real Playwright
// browser automation, file I/O, shell exec, and web utilities.

import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import fs   from 'fs'
import path from 'path'

import {
  moveMouse,
  clickMouse,
  typeText,
  pressKey,
  takeScreenshot,
  readScreen,
  openBrowser,
  visionLoop,
} from './computerControl'

import { reliableWebSearch, deepResearch as deepResearchFn } from './webSearch'
import { conversationMemory } from './conversationMemory'
import minimatch from 'minimatch'
import { generateBriefing, loadBriefingConfig }              from './morningBriefing'
import { getMarketData }   from './tools/marketDataTool'
import { getCompanyInfo }  from './tools/companyFilingsTool'
import { mcpClient }       from './mcpClient'
import { runInSandbox }    from './codeInterpreter'
import { responseCache }   from './responseCache'
import { extractYouTubeTranscript } from './youtubeTranscript'
import { knowledgeBase }            from './knowledgeBase'
import { getCalendarEvents }        from './tools/calendarTool'
import { readGmail, sendGmail }     from './tools/gmailTool'
import { loadConfig }               from '../providers/index'

const execAsync = promisify(exec)

// ── Shared path normalizer ─────────────────────────────────────

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

// ── Protected files — cannot be written by agents ─────────────
// GOALS.md is here to prevent arbitrary file_write overwrites.
// The manage_goals tool writes it directly (bypasses file_write),
// so goal management still works — only uncontrolled writes are blocked.

const PROTECTED_FILES = [
  'config/devos.config.json',
  'workspace/STANDING_ORDERS.md',
  'workspace/SOUL.md',
  'workspace/USER.md',
  'workspace/HEARTBEAT.md',
  'workspace/GOALS.md',
  '.env',
  '.env.local',
  'tsconfig.json',
  'package.json',
  'vitest.config.ts',
  'jest.config.ts',
]

function isProtectedFile(filePath: string): boolean {
  const normalized = normalizeFilePath(filePath).replace(/^\.\//, '')
  // Block test/config file writes (prevents agents from cheating tests)
  if (normalized.endsWith('.test.ts') || normalized.endsWith('.spec.ts')) return true
  if (normalized.endsWith('vitest.config.ts') || normalized.endsWith('jest.config.ts')) return true
  return PROTECTED_FILES.some(f => normalized.endsWith(f) || normalized === f)
}

// ── Path deny rules ───────────────────────────────────────────

const DENIED_PATHS = [
  '**/.ssh/**', '**/.aws/**', '**/.env*', '**/.gnupg/**',
  '**/credentials*', '**/*.pem', '**/*.key',
  '**/id_rsa*', '**/id_ed25519*',
]

function isPathDenied(filePath: string): boolean {
  const normalized = normalizeFilePath(filePath)
  return DENIED_PATHS.some(pattern => minimatch(normalized, pattern, { dot: true }))
}

// ── Command deny rules ────────────────────────────────────────

const DENIED_COMMANDS: RegExp[] = [
  /curl\s+.*\|\s*bash/i,
  /wget\s+.*\|\s*bash/i,
  /rm\s+-rf\s+\//,
  /powershell.*-enc\s/i,
  /powershell.*-encodedcommand/i,
  /iex\s*\(/i,
  /Invoke-Expression/i,
  // ── Sprint 25: extended deny patterns ─────────────────────────
  /Invoke-WebRequest.*\|/i,
  /Start-Process\s/i,
  /\breg\s+(add|delete)/i,
  /\bschtasks\s/i,
  /\bwmic\s+process\s+call/i,
  /\bnet\s+user\b/i,
  /Set-ExecutionPolicy/i,
  /\bNew-Service\b/i,
]

function isCommandDenied(cmd: string): boolean {
  return DENIED_COMMANDS.some(p => p.test(cmd))
}

// ── Sprint 24: active folder-watcher registry ─────────────────
const activeWatchers = new Map<string, fs.FSWatcher>()

// ── CommandGate: dangerous shell command patterns ──────────────
const SHELL_DANGEROUS_PATTERNS = [
  'rm -rf', 'rm -r /', 'del /f /s', 'del /s /q',
  'format c:', 'format c :', 'diskpart',
  'shutdown /s', 'shutdown -s',
  'reg delete', 'reg add hklm',
  'remove-item -recurse -force', 'remove-item -force -recurse',
  'format-volume', 'clear-disk', 'stop-computer', 'restart-computer',
]

function isShellDangerous(cmd: string): boolean {
  const lower = cmd.toLowerCase()
  return SHELL_DANGEROUS_PATTERNS.some(p => lower.includes(p.toLowerCase()))
}

// ── Sprint 25: Shell command allowlist ────────────────────────
// Unknown commands (not in this list) are blocked and require explicit user approval.

const SHELL_ALLOWLIST: RegExp[] = [
  // 1. File system reads
  /^(ls|dir|cat|type|head|tail|more|less|pwd|tree)\b/i,
  // 2. File/dir create, copy, move, shell navigation
  /^(mkdir|md|cp|copy|mv|move|xcopy|robocopy|echo|touch|cd|cls|clear|set|export)\b/i,
  // 3. Git
  /^git\b/i,
  // 4. Node / npm / npx / yarn / pnpm / bun
  /^(node|npm|npx|yarn|pnpm|bun)\b/i,
  // 5. Python / pip
  /^(python|python3|pip|pip3)\b/i,
  // 6. TypeScript compiler, linting, test runners
  /^(tsc|eslint|prettier|ts-node|vitest|jest|mocha)\b/i,
  // 7. Build tools: Cargo, Go, dotnet
  /^(cargo|go|dotnet)\b/i,
  // 8. Text search & manipulation
  /^(grep|rg|find|sed|awk|sort|uniq|wc|cut|tr|jq)\b/i,
  // 9. Network info (read-only; curl/wget pipe-to-bash blocked by denylist above)
  /^(ping|nslookup|tracert|traceroute|curl|wget)\b/i,
  // 10. System info (read-only)
  /^(systeminfo|tasklist|whoami|ipconfig|hostname|ver|uname|df|du|free|ps|top)\b/i,
  // 11. Archive tools
  /^(tar|zip|unzip|7z|gzip|gunzip)\b/i,
  // 12. PowerShell safe cmdlets (read, navigate, item management, output)
  /^(Get-|Select-|Where-|Sort-|Format-|Out-|Write-Output|Write-Host|ConvertTo-|ConvertFrom-|Measure-|Test-Path|Resolve-Path|Split-Path|Join-Path|Compare-Object|New-Item|Copy-Item|Move-Item|Rename-Item|Remove-Item|Set-Content|Add-Content|Clear-Content|Set-Location|Push-Location|Pop-Location)/i,
  // 13. Instant Actions: lock screen (rundll32) and volume one-liners (powershell -c)
  /^rundll32\b/i,
  /^powershell\s+-c\b/i,
]

function isCommandAllowed(cmd: string): { allowed: boolean; needsApproval: boolean } {
  // Hard-block: denylist and dangerous patterns take priority
  if (isCommandDenied(cmd))   return { allowed: false, needsApproval: false }
  if (isShellDangerous(cmd))  return { allowed: false, needsApproval: false }
  // Allowlist: explicitly permitted command patterns
  const trimmed = cmd.trim()
  if (SHELL_ALLOWLIST.some(p => p.test(trimmed))) return { allowed: true, needsApproval: false }
  // Unknown command pattern — require explicit user approval
  return { allowed: false, needsApproval: true }
}

// ── Browser profile isolation ────────────────────────────────
// Each Aiden session uses a sandboxed Chromium profile — completely
// separate from the user's real Chrome cookies and login state.

const BROWSER_DATA_DIR = path.join(
  process.env.APPDATA || '',
  'devos-ai',
  'browser-profiles',
)

function getBrowserProfileDir(sessionId?: string): string {
  const id         = sessionId || `session_${Date.now()}`
  const profileDir = path.join(BROWSER_DATA_DIR, id)
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true })
  }
  return profileDir
}

function cleanOldBrowserProfiles(): void {
  if (!fs.existsSync(BROWSER_DATA_DIR)) return
  const cutoff = Date.now() - 24 * 60 * 60 * 1000  // 24 h
  try {
    for (const entry of fs.readdirSync(BROWSER_DATA_DIR)) {
      const fullPath = path.join(BROWSER_DATA_DIR, entry)
      try {
        const stat = fs.statSync(fullPath)
        if (stat.mtimeMs < cutoff) {
          fs.rmSync(fullPath, { recursive: true, force: true })
          console.log(`[Browser] Cleaned old profile: ${entry}`)
        }
      } catch {}
    }
  } catch {}
}

// Clean stale profiles at module load (non-blocking, errors silently ignored)
try { cleanOldBrowserProfiles() } catch {}

// ── Types ─────────────────────────────────────────────────────

// Internal type returned by each TOOLS function
interface RawResult {
  success: boolean
  output:  string
  error?:  string
  [key: string]: any  // allow extra fields (e.g. 'path' from screenshot)
}

// Public type returned by executeTool (enriched with timing/retry info)
export interface ToolResult {
  tool:     string
  input:    Record<string, any>
  success:  boolean
  output:   string
  error?:   string
  duration: number
  retries:  number
}

// ── Singleton Playwright browser context (isolated profile) ──

let browserContext:    any = null   // BrowserContext from launchPersistentContext
let activeBrowserPage: any = null   // persists across tool calls within a session
let browserIdleTimer:  any = null   // auto-close after 5 min of inactivity

function resetBrowserIdleTimer(): void {
  if (browserIdleTimer) clearTimeout(browserIdleTimer)
  browserIdleTimer = setTimeout(async () => {
    if (browserContext) {
      console.log('[Browser] Closing idle browser after 5 min inactivity')
      try { await browserContext.close() } catch {}
      browserContext    = null
      activeBrowserPage = null
    }
  }, 5 * 60 * 1000)
}

/** Returns the currently active Playwright page, or null if no browser is open. */
export function getActiveBrowserPage(): any {
  return activeBrowserPage
}

async function getBrowserContext(): Promise<any> {
  if (!browserContext) {
    const { chromium } = await import('playwright')
    const profileDir   = getBrowserProfileDir()
    console.log(`[Browser] Using isolated profile: ${profileDir}`)
    console.log(`[Browser] User cookies NOT accessible`)
    browserContext = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      viewport: { width: 1280, height: 720 },
    })
  }
  resetBrowserIdleTimer()
  return browserContext
}

// ── Per-tool timeouts (ms) ────────────────────────────────────

const TOOL_TIMEOUTS: Record<string, number> = {
  web_search:     15000,
  deep_research:  60000,
  fetch_url:      20000,
  fetch_page:     20000,
  run_python:     60000,
  run_node:       60000,
  shell_exec:     30000,
  run_powershell: 30000,
  cmd:            30000,
  ps:             30000,
  wsl:            30000,
  screenshot:     10000,
  vision_loop:   120000,
  open_browser:   15000,
  git_push:       60000,
  git_commit:     30000,
  git_status:     15000,
  wait:            6000,
  get_stocks:     20000,
  get_market_data:              15000,
  get_company_info:             15000,
  social_research:              30000,
  code_interpreter_python:      35000,
  code_interpreter_node:        35000,
  clipboard_read:                5000,
  clipboard_write:               5000,
  window_list:                  10000,
  window_focus:                  8000,
  app_launch:                   10000,
  app_close:                     8000,
  watch_folder:                 10000,
  watch_folder_list:             5000,
  clarify:                  300_000,   // up to 5 min for human response
  vision_analyze:            45_000,
  voice_speak:               60_000,
  voice_transcribe:          60_000,
  voice_clone:              120_000,
  voice_design:             120_000,
}

// ── NSE symbol normalizer ─────────────────────────────────────
// Yahoo Finance needs '^NSEI' for NIFTY and '.NS' suffix for NSE stocks.

function normalizeNSESymbol(symbol: string): string {
  const nseMap: Record<string, string> = {
    'NIFTY':      '^NSEI',
    'NIFTY 50':   '^NSEI',
    'NIFTY50':    '^NSEI',
    'BANKNIFTY':  '^NSEBANK',
    'BANK NIFTY': '^NSEBANK',
    'SENSEX':     '^BSESN',
  }
  const upper = symbol.toUpperCase().trim()
  if (nseMap[upper]) return nseMap[upper]
  // Bare Indian ticker (all caps, no dot/caret suffix) → add .NS
  if (/^[A-Z]{2,20}$/.test(upper)) return upper + '.NS'
  return symbol
}

// ── Tool implementations ──────────────────────────────────────

export const TOOLS: Record<string, (payload: any) => Promise<RawResult>> = {

  // ── respond — direct conversational reply (no external tools needed) ──
  respond: async (p) => {
    const message = p.message || p.text || p.response || ''
    if (!message) return { success: false, output: '', error: 'No message provided' }
    return { success: true, output: message }
  },

  open_browser: async (p) => {
    const url = p.url || p.command || ''
    if (!url) return { success: false, output: '', error: 'No URL provided' }
    try {
      const context = await getBrowserContext()
      activeBrowserPage = await context.newPage()
      await activeBrowserPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      return { success: true, output: `Opened browser: ${url}` }
    } catch (e: any) {
      // Playwright failed — fall back to system browser, clear page ref
      activeBrowserPage = null
      try {
        const result = await openBrowser(url)
        return { success: true, output: result }
      } catch (e2: any) { return { success: false, output: '', error: e2.message } }
    }
  },

  browser_screenshot: async () => {
    try {
      let page = activeBrowserPage
      if (!page) {
        const context = await getBrowserContext()
        const pages   = context.pages() as any[]
        page = pages[pages.length - 1] || (await context.newPage())
      }
      const outPath  = path.join(process.cwd(), 'workspace', `screenshot_${Date.now()}.png`)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      await page.screenshot({ path: outPath, fullPage: false })
      return { success: true, output: `Screenshot saved: ${outPath}` }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  browser_click: async (p) => {
    const selector = p.selector || p.text || p.command || ''
    try {
      let page = activeBrowserPage
      if (!page) {
        const context = await getBrowserContext()
        const pages   = context.pages() as any[]
        page = pages[pages.length - 1]
      }
      if (!page) return { success: false, output: '', error: 'No browser page open. Use open_browser first.' }
      await page.click(selector).catch(() => page.click(`text=${selector}`))
      return { success: true, output: `Clicked: ${selector}` }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  browser_type: async (p) => {
    const selector = p.selector || 'input'
    const text     = p.text || p.command || ''
    try {
      let page = activeBrowserPage
      if (!page) {
        const context = await getBrowserContext()
        const pages   = context.pages() as any[]
        page = pages[pages.length - 1]
      }
      if (!page) return { success: false, output: '', error: 'No browser page open. Use open_browser first.' }
      await page.fill(selector, text)
      return { success: true, output: `Typed "${text}" into ${selector}` }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  browser_extract: async () => {
    try {
      let page = activeBrowserPage
      if (!page) {
        const context = await getBrowserContext()
        const pages   = context.pages() as any[]
        page = pages[pages.length - 1]
      }
      if (!page) return { success: false, output: '', error: 'No browser page open. Use open_browser first.' }
      const content  = await page.evaluate('document.body.innerText')
      return { success: true, output: (content as string).slice(0, 3000) }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  shell_exec: async (p) => {
    const cmd = p.command || p.cmd || ''
    if (!cmd) return { success: false, output: '', error: 'No command' }
    const shellGate = isCommandAllowed(cmd)
    if (!shellGate.allowed) {
      if (shellGate.needsApproval) {
        console.warn(`[AllowList] shell_exec UNKNOWN — approval required: ${cmd.slice(0, 120)}`)
        return { success: false, output: '', error: `CommandGate: This command requires explicit user approval before running: ${cmd.slice(0, 80)}` }
      }
      console.warn(`[Security] shell_exec DENIED: ${cmd.slice(0, 120)}`)
      return { success: false, output: '', error: 'Blocked: this command pattern is not allowed. Dangerous operations require explicit user approval.' }
    }
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        shell:   'powershell.exe',
        timeout: 30000,
        cwd:     process.cwd(),
        env:     { ...process.env, PATH: process.env.PATH },
      })
      return { success: true, output: (stdout || stderr || '').trim() || '(completed)' }
    } catch (e: any) { return { success: false, output: e.stdout || '', error: e.message } }
  },

  run_powershell: async (p) => {
    const script  = p.script || p.command || ''
    if (!script) return { success: false, output: '', error: 'No script' }
    const psGate = isCommandAllowed(script)
    if (!psGate.allowed) {
      if (psGate.needsApproval) {
        console.warn(`[AllowList] run_powershell UNKNOWN — approval required: ${script.slice(0, 120)}`)
        return { success: false, output: '', error: `CommandGate: This PowerShell command requires explicit user approval before running.` }
      }
      console.warn(`[Security] run_powershell DENIED: ${script.slice(0, 120)}`)
      return { success: false, output: '', error: 'Blocked: this command pattern is not allowed. Dangerous operations require explicit user approval.' }
    }
    const tmpFile = path.join(process.cwd(), 'workspace', `tmp_${Date.now()}.ps1`)
    fs.mkdirSync(path.dirname(tmpFile), { recursive: true })
    fs.writeFileSync(tmpFile, script)
    try {
      const { stdout, stderr } = await execAsync(
        `powershell.exe -ExecutionPolicy Bypass -File "${tmpFile}"`,
        { timeout: 30000 }
      )
      return { success: true, output: (stdout || stderr || '').trim() }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
    finally { try { fs.unlinkSync(tmpFile) } catch {} }
  },

  // ── cmd — Windows cmd.exe shell ────────────────────────────
  cmd: async (p) => {
    const command = p.command || p.cmd || ''
    if (!command) return { success: false, output: '', error: 'No command provided' }
    const gate = isCommandAllowed(command)
    if (!gate.allowed) {
      if (gate.needsApproval) {
        console.warn(`[AllowList] cmd UNKNOWN — approval required: ${command.slice(0, 120)}`)
        return { success: false, output: '', error: `CommandGate: This command requires explicit user approval before running: ${command.slice(0, 80)}` }
      }
      console.warn(`[Security] cmd DENIED: ${command.slice(0, 120)}`)
      return { success: false, output: '', error: 'Blocked: this command pattern is not allowed. Dangerous operations require explicit user approval.' }
    }
    try {
      const { stdout, stderr } = await execAsync(`cmd.exe /c ${command}`, {
        timeout: 30000,
        cwd:     process.cwd(),
        env:     { ...process.env },
      })
      const out = (stdout || stderr || '').trim()
      return { success: true, output: out || '(completed)', exitCode: 0 } as any
    } catch (e: any) {
      return { success: false, output: e.stdout || '', error: e.message, exitCode: e.code ?? 1 } as any
    }
  },

  // ── ps — PowerShell (direct, no temp file) ──────────────────
  ps: async (p) => {
    const command = p.command || p.script || ''
    if (!command) return { success: false, output: '', error: 'No command provided' }
    const gate = isCommandAllowed(command)
    if (!gate.allowed) {
      if (gate.needsApproval) {
        console.warn(`[AllowList] ps UNKNOWN — approval required: ${command.slice(0, 120)}`)
        return { success: false, output: '', error: `CommandGate: This PowerShell command requires explicit user approval before running.` }
      }
      console.warn(`[Security] ps DENIED: ${command.slice(0, 120)}`)
      return { success: false, output: '', error: 'Blocked: this command pattern is not allowed. Dangerous operations require explicit user approval.' }
    }
    try {
      const { stdout, stderr } = await execAsync(
        `powershell.exe -NoProfile -NonInteractive -Command "${command.replace(/"/g, '\\"')}"`,
        { timeout: 30000, cwd: process.cwd() }
      )
      const out = (stdout || stderr || '').trim()
      return { success: true, output: out || '(completed)', exitCode: 0 } as any
    } catch (e: any) {
      return { success: false, output: e.stdout || '', error: e.message, exitCode: e.code ?? 1 } as any
    }
  },

  // ── wsl — Windows Subsystem for Linux ───────────────────────
  wsl: async (p) => {
    const command = p.command || p.cmd || ''
    const distro  = p.distro || ''
    if (!command) return { success: false, output: '', error: 'No command provided' }
    const gate = isCommandAllowed(command)
    if (!gate.allowed) {
      if (gate.needsApproval) {
        console.warn(`[AllowList] wsl UNKNOWN — approval required: ${command.slice(0, 120)}`)
        return { success: false, output: '', error: `CommandGate: This WSL command requires explicit user approval before running.` }
      }
      console.warn(`[Security] wsl DENIED: ${command.slice(0, 120)}`)
      return { success: false, output: '', error: 'Blocked: this command pattern is not allowed. Dangerous operations require explicit user approval.' }
    }
    // Translate Windows paths in the command: C:\foo\bar → /mnt/c/foo/bar
    const translated = command.replace(/([A-Z]):\\([^\s"']*)/gi, (_m: string, drive: string, rest: string) =>
      `/mnt/${drive.toLowerCase()}/${rest.replace(/\\/g, '/')}`
    )
    const distroFlag = distro ? `-d ${distro}` : ''
    const wslCmd     = `wsl ${distroFlag} -- bash -c "${translated.replace(/"/g, '\\"')}"`
    try {
      const { stdout, stderr } = await execAsync(wslCmd, {
        timeout: 30000,
        cwd:     process.cwd(),
      })
      const out = (stdout || stderr || '').trim()
      return { success: true, output: out || '(completed)', exitCode: 0 } as any
    } catch (e: any) {
      return { success: false, output: e.stdout || '', error: e.message, exitCode: e.code ?? 1 } as any
    }
  },

  file_write: async (p) => {
    let   filePath = p.path || p.file || ''
    const content  = p.content || ''
    if (!filePath) return { success: false, output: '', error: 'No path' }
    if (isProtectedFile(filePath)) {
      console.warn(`[Security] file_write BLOCKED (protected): ${filePath}`)
      return { success: false, output: '', error: `Protected file: ${filePath} cannot be modified by agents. Use 'devos config' or edit manually.` }
    }
    if (isPathDenied(filePath)) {
      console.warn(`[Security] file_write DENIED: ${filePath}`)
      return { success: false, output: '', error: 'Access denied: protected path. Aiden cannot write credentials, SSH keys, or env files.' }
    }
    try {
      // Expand Desktop and ~ shorthands, and fix any "Aiden" username to actual system user
      const _user = process.env.USERNAME || process.env.USER || require('os').userInfo().username || 'User'
      const _home = require('os').homedir()
      filePath = filePath
        .replace(/^~[\/\\]/i, _home + path.sep)
        .replace(/^Desktop[\/\\]/i, path.join(_home, 'Desktop') + path.sep)
        .replace(/^C:\\Users\\Aiden\\/i, `C:\\Users\\${_user}\\`)
        .replace(/^C:\/Users\/Aiden\//i, `C:/Users/${_user}/`)

      const resolved = filePath.match(/^[A-Z]:/i) || filePath.startsWith('/')
        ? filePath
        : path.join(process.cwd(), filePath)
      fs.mkdirSync(path.dirname(resolved), { recursive: true })
      fs.writeFileSync(resolved, content, 'utf-8')
      const written = fs.existsSync(resolved)
      return {
        success: written,
        output:  written
          ? `Written and verified: ${resolved} (${content.length} chars)`
          : 'Write failed',
      }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  file_read: async (p) => {
    let filePath = p.path || p.file || ''
    if (!filePath) return { success: false, output: '', error: 'No path' }
    if (isPathDenied(filePath)) {
      console.warn(`[Security] file_read DENIED: ${filePath}`)
      return { success: false, output: '', error: 'Access denied: protected path. Aiden cannot read credentials, SSH keys, or env files.' }
    }
    try {
      // Expand ~ and Desktop shorthands, and fix any "Aiden" username to actual system user
      const _user = process.env.USERNAME || process.env.USER || require('os').userInfo().username || 'User'
      const _home = require('os').homedir()
      filePath = filePath
        .replace(/^~[\/\\]/i, _home + path.sep)
        .replace(/^Desktop[\/\\]/i, path.join(_home, 'Desktop') + path.sep)
        .replace(/^C:\\Users\\Aiden\\/i, `C:\\Users\\${_user}\\`)
        .replace(/^C:\/Users\/Aiden\//i, `C:/Users/${_user}/`)
      // Resolve path: absolute paths (Windows C:\ or Unix /) used as-is; relative joined with cwd
      const resolved = filePath.match(/^[A-Z]:/i) || filePath.startsWith('/')
        ? filePath
        : path.join(process.cwd(), filePath)
      if (!fs.existsSync(resolved)) return { success: false, output: '', error: `Not found: ${resolved}` }
      return { success: true, output: fs.readFileSync(resolved, 'utf-8').slice(0, 5000) }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  file_list: async (p) => {
    let dirPath = p.path || p.dir || process.cwd()
    try {
      // Expand ~ and Desktop shorthands, and fix any "Aiden" username to actual system user
      const _user = process.env.USERNAME || process.env.USER || require('os').userInfo().username || 'User'
      const _home = require('os').homedir()
      dirPath = dirPath
        .replace(/^~[\/\\]/i, _home + path.sep)
        .replace(/^Desktop[\/\\]?$/i, path.join(_home, 'Desktop'))
        .replace(/^Desktop[\/\\]/i, path.join(_home, 'Desktop') + path.sep)
        .replace(/^C:\\Users\\Aiden\\/i, `C:\\Users\\${_user}\\`)
        .replace(/^C:\/Users\/Aiden\//i, `C:/Users/${_user}/`)
      const resolved = dirPath.match(/^[A-Z]:/i)
        ? dirPath
        : path.join(process.cwd(), dirPath)
      return { success: true, output: fs.readdirSync(resolved).join('\n') }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  run_python: async (p) => {
    const script = p.script || p.code || p.command || ''
    if (!script) return { success: false, output: '', error: 'No script' }
    const tmp = path.join(process.cwd(), 'workspace', `py_${Date.now()}.py`)
    fs.mkdirSync(path.dirname(tmp), { recursive: true })
    fs.writeFileSync(tmp, script)
    try {
      const { stdout, stderr } = await execAsync(`python "${tmp}"`, {
        timeout: 60000,
        cwd:     process.cwd(),
      })
      return { success: true, output: (stdout || stderr || '').trim() || 'Script completed with no output' }
    } catch (e: any) { return { success: false, output: e.stdout || '', error: `Python error: ${e.message}` } }
    finally { try { fs.unlinkSync(tmp) } catch {} }
  },

  run_node: async (p) => {
    const script = p.script || p.code || p.command || ''
    if (!script) return { success: false, output: '', error: 'No script' }
    const tmp = path.join(process.cwd(), 'workspace', `js_${Date.now()}.js`)
    fs.mkdirSync(path.dirname(tmp), { recursive: true })
    fs.writeFileSync(tmp, script)
    try {
      const { stdout, stderr } = await execAsync(`node "${tmp}"`, {
        timeout: 60000,
        cwd:     process.cwd(),
      })
      return { success: true, output: (stdout || stderr || '').trim() || 'Script completed with no output' }
    } catch (e: any) { return { success: false, output: e.stdout || '', error: `Node error: ${e.message}` } }
    finally { try { fs.unlinkSync(tmp) } catch {} }
  },

  system_info: async () => {
    try {
      const { stdout } = await execAsync(
        `@{ CPU=(Get-CimInstance Win32_Processor).Name; RAM_GB=[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB,1); OS=(Get-CimInstance Win32_OperatingSystem).Caption; FreeGB=[math]::Round((Get-PSDrive C).Free/1GB,1); User=$env:USERNAME } | ConvertTo-Json`,
        { shell: 'powershell.exe', timeout: 15000 }
      )
      return { success: true, output: stdout.trim() }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  notify: async (p) => {
    const msg = (p.message || p.command || p.title || p.body || '')
      .replace(/'/g, '').replace(/"/g, '').replace(/`/g, '').replace(/\$/g, '').trim()
    if (!msg) return { success: false, output: '', error: 'No message provided for notification' }
    try {
      // Windows 10/11 Toast notification via WinRT — fires instantly, no Start-Sleep needed.
      // Run fully detached so the child process never inherits the parent terminal stdio.
      const psCmd = [
        '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null',
        '$t = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)',
        '$n = $t.GetElementsByTagName("text")',
        `$n.Item(0).AppendChild($t.CreateTextNode("Aiden")) | Out-Null`,
        `$n.Item(1).AppendChild($t.CreateTextNode("${msg}")) | Out-Null`,
        '$toast = [Windows.UI.Notifications.ToastNotification]::new($t)',
        '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Aiden").Show($toast)',
      ].join('; ')

      const child = spawn('powershell', [
        '-WindowStyle', 'Hidden',
        '-NonInteractive',
        '-Command', psCmd,
      ], {
        detached:    true,
        stdio:       'ignore',
        windowsHide: true,
      })
      child.unref()  // don't keep Node alive waiting for it

      return { success: true, output: `Desktop notification sent: "${msg}".` }
    } catch (e: any) {
      return { success: false, output: '', error: `Notification failed: ${e.message}` }
    }
  },

  web_search: async (p: any) => {
    const query = p.query || p.command || p.topic || ''
    if (!query) return { success: false, output: '', error: 'No query provided' }

    // Date/time fast-path — answer from system clock without network call
    if (/what\s+(year|date|day|time)|current\s+(year|date|day|time)|today'?s?\s+(date|year|day)|what\s+is\s+today/i.test(query)) {
      const now     = new Date()
      const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      return {
        success: true,
        output:  `Current date: ${dateStr}. Year: ${now.getFullYear()}. Time: ${now.toLocaleTimeString('en-US')}.`,
        method:  'system_clock',
      }
    }

    return reliableWebSearch(query)
  },

  _web_search_legacy_unused: async (p: any) => {
    // Legacy implementation preserved for reference — no longer called
    const query = p.query || ''
    if (!query) return { success: false, output: '', error: 'No query provided' }

    // ── Weather detection ────────────────────────────────────────
    if (/weather|temperature|forecast|rain|snow|sunny|cloudy|humidity|wind/i.test(query)) {
      const city = query
        .replace(/what(?:'s| is) the weather/gi, '')
        .replace(/\bweather\b/gi, '')
        .replace(/\bforecast\b/gi, '')
        .replace(/\btoday\b/gi, '')
        .replace(/\bcurrent\b/gi, '')
        .replace(/\btemperature\b/gi, '')
        .replace(/\brain\b/gi, '')
        .replace(/\bsnow\b/gi, '')
        .replace(/\bsunny\b/gi, '')
        .replace(/\bcloudy\b/gi, '')
        .replace(/\bhumidity\b/gi, '')
        .replace(/\bwind\b/gi, '')
        .replace(/\bin\b/gi, '')
        .replace(/\bfor\b/gi, '')
        .replace(/\bon\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim() || 'auto'
      console.log(`[Weather] city extracted: "${city}"`)

      try {
        const wr   = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { signal: AbortSignal.timeout(8000) })
        const data = await wr.json() as any
        const cc   = data.current_condition?.[0]
        const area = data.nearest_area?.[0]
        if (cc && area) {
          const location = [area.areaName?.[0]?.value, area.country?.[0]?.value].filter(Boolean).join(', ')
          const desc     = cc.weatherDesc?.[0]?.value || ''
          let out = `Weather for ${location || city}:\n`
          out    += `Condition: ${desc}\n`
          out    += `Temperature: ${cc.temp_C}°C / ${cc.temp_F}°F (feels like ${cc.FeelsLikeC}°C)\n`
          out    += `Humidity: ${cc.humidity}% | Wind: ${cc.windspeedKmph} km/h ${cc.winddir16Point}`
          out    += ` | Visibility: ${cc.visibility} km | UV Index: ${cc.uvIndex}\n`
          const forecasts = (data.weather || []).slice(0, 3) as any[]
          if (forecasts.length) {
            out += '\n3-Day Forecast:\n'
            for (const day of forecasts) {
              const midDesc = day.hourly?.[4]?.weatherDesc?.[0]?.value || ''
              out += `  ${day.date}: High ${day.maxtempC}°C / Low ${day.mintempC}°C${midDesc ? ' — ' + midDesc : ''}\n`
            }
          }
          console.log(`[web_search] Weather data retrieved for "${city}"`)
          return { success: true, output: out.trim() }
        }
      } catch (e: any) {
        console.warn(`[web_search] Weather fetch failed: ${e.message}`)
      }
    }

    const results: string[] = []

    // ── METHOD 1: DuckDuckGo Instant Answer API ──────────────────
    try {
      console.log(`[web_search] Method 1: DDG Instant API`)
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      const ddgRes = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
        signal:  AbortSignal.timeout(8000),
      })
      const ddgData = await ddgRes.json() as any
      const parts: string[] = []
      if (ddgData.Answer)       parts.push(`Answer: ${ddgData.Answer}`)
      if (ddgData.Abstract)     parts.push(`Summary: ${ddgData.Abstract}`)
      if (ddgData.AbstractText) parts.push(ddgData.AbstractText)
      if (ddgData.RelatedTopics?.length) {
        const topics = ddgData.RelatedTopics
          .slice(0, 8)
          .map((t: any) => t.Text || t.Result || '')
          .filter(Boolean)
        if (topics.length) parts.push(`Related: ${topics.join('. ')}`)
      }
      if (parts.length > 0) {
        console.log(`[web_search] DDG Instant: got ${parts.length} parts`)
        results.push(`[DuckDuckGo Instant]\n${parts.join('\n')}`)
      } else {
        console.log(`[web_search] DDG Instant: no usable data`)
      }
    } catch (e: any) {
      console.warn(`[web_search] DDG instant failed: ${e.message}`)
    }

    // ── METHOD 2: Wikipedia Search API + summary ──────────────────
    try {
      console.log(`[web_search] Method 2: Wikipedia Search API`)
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`
      const searchRes  = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) })
      const searchData = await searchRes.json() as any
      const searchHits = searchData?.query?.search || []
      console.log(`[web_search] Wikipedia search: ${searchHits.length} results`)

      if (searchHits.length > 0) {
        const topTitle  = searchHits[0].title
        const summaryRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`,
          { signal: AbortSignal.timeout(6000) },
        )
        if (summaryRes.ok) {
          const wiki = await summaryRes.json() as any
          if (wiki.extract && wiki.extract.length > 50) {
            const snippets = searchHits
              .slice(1, 4)
              .map((h: any) => h.snippet?.replace(/<[^>]+>/g, '') || '')
              .filter((s: string) => s.length > 20)
            const extra = snippets.length > 0 ? `\nOther results: ${snippets.join(' | ')}` : ''
            console.log(`[web_search] Wikipedia summary: ${wiki.extract.length} chars for "${wiki.title}"`)
            results.push(`[Wikipedia: ${wiki.title}]\n${wiki.extract.slice(0, 1200)}${extra}`)
          }
        }
      }
    } catch (e: any) {
      console.warn(`[web_search] Wikipedia failed: ${e.message}`)
    }

    // ── METHOD 3: DDG HTML scrape + snippet extraction + fetch top 3 pages ──
    try {
      console.log(`[web_search] Method 3: DDG HTML scrape`)
      const searchRes = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
          signal:  AbortSignal.timeout(10000),
        },
      )
      const html = await searchRes.text()
      console.log(`[web_search] DDG HTML: ${html.length} bytes`)

      // Extract result snippets via result__snippet class
      const snippetMatches = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)]
      const snippets = snippetMatches
        .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(s => s.length > 30)
        .slice(0, 5)
      console.log(`[web_search] DDG HTML snippets: ${snippets.length}`)
      if (snippets.length > 0) {
        results.push(`[Search Snippets for "${query}"]\n${snippets.join('\n\n')}`)
      }

      // Extract destination URLs via uddg= parameter
      const urlMatches = [...html.matchAll(/uddg=(https?[^&"]+)/g)]
      const urls = urlMatches
        .map(m => decodeURIComponent(m[1]))
        .filter(url =>
          !url.includes('duckduckgo.com') &&
          !url.includes('youtube.com') &&
          url.startsWith('https'),
        )
        .filter((url, i, arr) => arr.indexOf(url) === i)
        .slice(0, 3)
      console.log(`[web_search] DDG HTML urls: ${urls.length}`)

      // Fetch top 3 pages for real content
      const pageResults = await Promise.all(urls.map(async (url) => {
        try {
          console.log(`[web_search] Fetching page: ${url}`)
          const r = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal:  AbortSignal.timeout(7000),
          })
          if (!r.ok) return null
          const text  = await r.text()
          const clean = text
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[\s\S]*?<\/nav>/gi, '')
            .replace(/<header[\s\S]*?<\/header>/gi, '')
            .replace(/<footer[\s\S]*?<\/footer>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          if (clean.length < 200) return null
          console.log(`[web_search] Page fetched: ${clean.length} chars from ${url}`)
          return `[${url}]\n${clean.slice(0, 2000)}`
        } catch (e: any) {
          console.warn(`[web_search] Page fetch failed ${url}: ${e.message}`)
          return null
        }
      }))
      results.push(...(pageResults.filter(Boolean) as string[]))

    } catch (e: any) {
      console.warn(`[web_search] HTML scrape failed: ${e.message}`)
    }

    if (results.length === 0) {
      console.warn(`[web_search] All methods failed for: "${query}"`)
      return { success: false, output: '', error: `No results found for: ${query}` }
    }
    console.log(`[web_search] Done: ${results.length} sections`)
    return { success: true, output: results.join('\n\n---\n\n').slice(0, 10000) }
  },

  fetch_url: async (p) => {
    const url = p.url || p.command || ''
    if (!url) return { success: false, output: '', error: 'No URL' }
    try {
      const res  = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0' },
        signal:  AbortSignal.timeout(15000),
      })
      const status = res.status
      const text  = await res.text()
      const clean = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{3,}/g, ' ')
        .trim()
      return { success: true, output: `HTTP ${status} ${res.statusText || 'OK'}\n\n${clean.slice(0, 3000)}` }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  // Dedicated page fetcher — strips all HTML, returns clean readable text
  fetch_page: async (p) => {
    const url = p.url || p.command || ''
    if (!url) return { success: false, output: '', error: 'No URL' }
    try {
      const r    = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000),
      })
      const text  = await r.text()
      const clean = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return { success: true, output: clean.slice(0, 3000) }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  // 3-pass deep research using reliableWebSearch fallback chain
  deep_research: async (p: any) => {
    const topic = p.topic || p.query || p.command || ''
    if (!topic) return { success: false, output: '', error: 'No topic provided' }
    return deepResearchFn(topic)
  },

  _deep_research_legacy_unused: async (p: any) => {
    // Legacy implementation preserved for reference — no longer called
    const topic = p.topic || ''
    if (!topic) return { success: false, output: '', error: 'No topic provided' }

    const results: string[] = []

    if (results.length === 0) {
      return { success: false, output: '', error: `No research results for: ${topic}` }
    }

    const combined = results.join('\n\n')
    console.log(`[deep_research] Complete: ${combined.length} chars across ${results.length} passes`)
    return { success: true, output: combined.slice(0, 15000) }
  },

  // Activate a specialist agent persona — actual synthesis happens in respond phase
  run_agent: async (p) => {
    const agentName = (p.agent || 'engineer').toLowerCase()
    const task      = p.task || p.command || ''
    if (!task) return { success: false, output: '', error: 'No task provided' }

    // ── Fork guard: only top-level agents can spawn specialists ──
    // Prevents sub-agents from recursively spawning more agents
    const FORK_CAPABLE_AGENTS = ['ceo', 'engineer']
    const callerAgent = (p._callerAgent || '').toLowerCase()
    if (callerAgent && !FORK_CAPABLE_AGENTS.includes(callerAgent)) {
      console.warn(`[run_agent] ${callerAgent} attempted to fork ${agentName} — blocked (non-fork-capable)`)
      return { success: false, output: '', error: `Agent '${callerAgent}' cannot spawn sub-agents. Only CEO-level agents can delegate.` }
    }

    const agentPersonas: Record<string, string> = {
      engineer:     'Senior TypeScript/JavaScript engineer — writes clean, working code with full error handling.',
      security:     'Security auditor — analyzes for OWASP Top 10, provides specific fixes with code examples.',
      data_analyst: 'Data analyst — provides statistical analysis, patterns, and visualizable insights.',
      designer:     'UI/UX designer — provides design recommendations with color codes, typography, and layout.',
      researcher:   'Research specialist — extracts entities, compares systematically, identifies trends, gives conclusions.',
      debugger:     'Debugger — forms 3 hypotheses, eliminates systematically, provides exact fix with code.',
    }

    const persona = agentPersonas[agentName] || agentPersonas.engineer

    // ── Context inheritance for complex tasks ─────────────────────
    // Complex tasks (long description or explicit context request) get conversation history
    const isComplex = task.length > 100 || p.inheritContext === true
    let contextBlock = ''
    if (isComplex) {
      const memCtx = conversationMemory.buildContext()
      if (memCtx && memCtx.trim()) {
        contextBlock = `\n## Conversation Context\nThe user has been discussing:\n${memCtx.slice(0, 1200)}\n`
        console.log(`[run_agent] Injecting conversation context into ${agentName} task (${memCtx.length} chars)`)
      }
    }

    try {
      const { memoryLayers } = await import('../memory/memoryLayers')
      memoryLayers.write(`Agent ${agentName} task: ${task}`, ['agent', agentName])
    } catch {}

    const fullTask = contextBlock
      ? `${contextBlock}\n## Your Task\n${task}`
      : task

    return {
      success: true,
      output:  `Agent: ${agentName}\nPersona: ${persona}\nTask: ${fullTask}\n\n[Specialist agent will synthesize this task in the response phase with full context]`,
    }
  },

  git_status: async (p) => {
    const cwd = p.path || p.directory || p.cwd || process.cwd()
    try {
      const { stdout, stderr } = await execAsync(
        'git status && git log --oneline -5',
        { shell: 'powershell.exe', timeout: 15000, cwd }
      )
      return { success: true, output: stdout || stderr }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  git_commit: async (p) => {
    const msg = (p.message || p.command || 'DevOS auto-commit').replace(/"/g, "'")
    try {
      const { stdout, stderr } = await execAsync(
        `git add -A && git commit -m "${msg}"`,
        { shell: 'powershell.exe', timeout: 30000, cwd: process.cwd() }
      )
      return { success: true, output: stdout || stderr }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  git_push: async (p) => {
    const remote = p.remote || 'origin'
    const branch = p.branch || 'master'
    try {
      const { stdout, stderr } = await execAsync(
        `git push ${remote} ${branch}`,
        { shell: 'powershell.exe', timeout: 60000, cwd: process.cwd() }
      )
      return { success: true, output: stdout || stderr }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  get_stocks: async (p: any) => {
    const market = p.market || p.exchange || 'NSE'
    const type   = p.type   || 'gainers' // gainers | losers | active

    console.log(`[get_stocks] Fetching ${type} for ${market}`)

    const results: string[] = []

    // Method 1: Yahoo Finance screener API — free, no auth needed
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=10&region=IN&lang=en-IN`
      const r = await fetch(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept':     'application/json',
        },
        signal: AbortSignal.timeout(10000),
      })
      if (r.ok) {
        const data   = await r.json() as any
        const quotes = data?.finance?.result?.[0]?.quotes || []
        if (quotes.length > 0) {
          const lines = (quotes as any[]).slice(0, 10).map((q: any) =>
            `${q.symbol}: ${q.regularMarketPrice} (${q.regularMarketChangePercent?.toFixed(2)}%) — ${q.shortName || q.longName || ''}`
          )
          results.push(`Top Gainers (Yahoo Finance India):\n${lines.join('\n')}`)
        }
      }
    } catch (e: any) {
      console.warn(`[get_stocks] Yahoo Finance failed: ${e.message}`)
    }

    // Method 2: Finology ticker
    try {
      const finologyUrl = type === 'gainers'
        ? 'https://ticker.finology.in/market/top-gainers'
        : type === 'losers'
        ? 'https://ticker.finology.in/market/top-losers'
        : 'https://ticker.finology.in/market/most-active'

      const r = await fetch(finologyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept':     'text/html',
        },
        signal: AbortSignal.timeout(10000),
      })
      if (r.ok) {
        const html  = await r.text()
        const rows  = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
        const stocks: string[] = []
        for (const row of rows.slice(1, 15)) {
          const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
            .map((c: any) => c[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
            .filter(Boolean)
          if (cells.length >= 3 && cells[0].length > 1) {
            stocks.push(cells.slice(0, 5).join(' | '))
          }
        }
        if (stocks.length > 0) {
          results.push(`${market} Top ${type} (Finology):\n${stocks.slice(0, 10).join('\n')}`)
        }
      }
    } catch (e: any) {
      console.warn(`[get_stocks] Finology failed: ${e.message}`)
    }

    // Method 3: Economic Times market stats
    try {
      const segment = type === 'gainers' ? 'gainers' : type === 'losers' ? 'losers' : 'active-stocks'
      const etUrl   = `https://economictimes.indiatimes.com/stocks/marketstats/top-${segment}/nse`
      const r = await fetch(etUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(10000),
      })
      if (r.ok) {
        const html  = await r.text()
        const clean = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        const stockPattern = /\b([A-Z]{2,10})\b[\s\S]{0,30}?(\d+\.?\d*)\s*[(%]\s*([+-]?\d+\.?\d*)/g
        const matches      = [...clean.matchAll(stockPattern)].slice(0, 10)
        if (matches.length > 0) {
          const lines = matches.map((m: any) => `${m[1]}: ${m[2]} (${m[3]}%)`)
          results.push(`ET Market Stats:\n${lines.join('\n')}`)
        }
      }
    } catch (e: any) {
      console.warn(`[get_stocks] ET failed: ${e.message}`)
    }

    if (results.length === 0) {
      // All scrapers failed — fall back to web search
      console.log(`[get_stocks] Scrapers failed — falling back to reliableWebSearch`)
      try {
        const searchResult = await reliableWebSearch(`${market} top ${type} stocks today NSE BSE Nifty`)
        if (searchResult.success && searchResult.output) {
          return { success: true, output: `${market} Top ${type} stocks:\n${searchResult.output}` }
        }
      } catch {}
      // Return a structured placeholder so the response at least has market keywords
      return {
        success: true,
        output:  `${market} top ${type} stocks data unavailable right now (market may be closed or data source unreachable). Please check NSE/BSE directly at nseindia.com or bseindia.com for live gainers/losers with % changes.`,
      }
    }

    // Format final output to ensure exchange/percentage keywords are prominent
    const rawOutput = results.join('\n\n---\n\n').slice(0, 5000)
    const header    = rawOutput.toLowerCase().includes(market.toLowerCase())
      ? rawOutput
      : `${market} Market — Top ${type}:\n${rawOutput}`
    return {
      success: true,
      output:  header,
    }
  },

  // ── Financial tools ─────────────────────────────────────

  get_market_data: async (p: any) => {
    const raw = (p.symbol || p.ticker || '').trim()
    if (!raw) return { success: false, output: '', error: 'No symbol provided. Pass { symbol: "RELIANCE" } or { symbol: "AAPL" }.' }
    const symbol = normalizeNSESymbol(raw)
    try {
      const data = await getMarketData(symbol)
      return { success: true, output: JSON.stringify(data, null, 2) }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },

  get_company_info: async (p: any) => {
    const symbol = (p.symbol || p.ticker || '').trim()
    if (!symbol) return { success: false, output: '', error: 'No symbol provided. Pass { symbol: "RELIANCE" } or { symbol: "AAPL" }.' }
    try {
      const data = await getCompanyInfo(symbol)
      return { success: true, output: JSON.stringify(data, null, 2) }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },

  social_research: async (input: { topic: string }) => {
    const { socialResearch } = await import('./tools/socialResearchTool')
    const result = await socialResearch(input.topic)
    return { success: true, output: JSON.stringify(result, null, 2) }
  },

  // ── Wait ───────────────────────────────────────────────────────
  wait: async (p: any) => {
    const ms = Math.min(Number(p.ms) || 1000, 5000)
    await new Promise(r => setTimeout(r, ms))
    return { success: true, output: `Waited ${ms}ms` }
  },

  // ── Computer control tools (PowerShell-only, zero native deps) ─
  mouse_move: async (p: any) => {
    try {
      const result = await moveMouse(Number(p.x) || 0, Number(p.y) || 0)
      return { success: true, output: result }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  mouse_click: async (p: any) => {
    try {
      const result = await clickMouse(Number(p.x) || 0, Number(p.y) || 0, p.button || 'left', !!p.double)
      return { success: true, output: result }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  keyboard_type: async (p: any) => {
    try {
      const result = await typeText(String(p.text || ''))
      return { success: true, output: result }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  keyboard_press: async (p: any) => {
    try {
      const result = await pressKey(String(p.key || 'enter'))
      return { success: true, output: result }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  screenshot: async (_p: any) => {
    try {
      const filepath = await takeScreenshot()
      const stats    = require('fs').statSync(filepath)
      return { success: true, output: `Screenshot saved: ${filepath} (${Math.round(stats.size / 1024)}kb)`, path: filepath }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  screen_read: async (_p: any) => {
    try {
      const result = await readScreen()
      return { success: true, output: result }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  vision_loop: async (p: any) => {
    try {
      // Build a callLLM wrapper using the currently available provider
      const callLLMWrapper = async (prompt: string): Promise<string> => {
        const { getNextAvailableAPI } = await import('../providers/router')
        const { callLLM: _callLLM }   = await import('./agentLoop')
        const next = getNextAvailableAPI()
        if (!next) return 'No API available'
        const key = next.entry.key.startsWith('env:')
          ? (process.env[next.entry.key.replace('env:', '')] || '')
          : next.entry.key
        return _callLLM(prompt, key, next.entry.model, next.entry.provider)
      }
      const result = await visionLoop(p.goal, p.max_steps || 10, callLLMWrapper)
      return { success: true, output: result }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  // ── Sprint 16: Code Interpreter Sandbox ───────────────────────

  code_interpreter_python: async (p: any) => {
    const code     = p.code || p.script || ''
    const packages = Array.isArray(p.packages) ? p.packages as string[] : undefined
    if (!code) return { success: false, output: '', error: 'No code provided' }
    const result = await runInSandbox(code, 'python', packages)
    const filesNote = result.files && result.files.length > 0
      ? `\nFiles created: ${result.files.join(', ')}`
      : ''
    return {
      success: result.success,
      output:  (result.output || '') + filesNote,
      error:   result.error,
    }
  },

  code_interpreter_node: async (p: any) => {
    const code = p.code || p.script || ''
    if (!code) return { success: false, output: '', error: 'No code provided' }
    const result = await runInSandbox(code, 'node')
    const filesNote = result.files && result.files.length > 0
      ? `\nFiles created: ${result.files.join(', ')}`
      : ''
    return {
      success: result.success,
      output:  (result.output || '') + filesNote,
      error:   result.error,
    }
  },

  // ── Sprint 23: Clipboard + Window + App Launch Tools ──────────

  clipboard_read: async () => {
    try {
      const { execSync } = await import('child_process')
      const text = execSync('powershell.exe -Command "Get-Clipboard"', { timeout: 5000 }).toString().trim()
      return { success: true, output: text || '(clipboard is empty)' }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  clipboard_write: async (p) => {
    const text = p.text || p.content || p.command || ''
    if (!text) return { success: false, output: '', error: 'No text provided' }
    try {
      const { execSync } = await import('child_process')
      const safe = text.replace(/'/g, "''")
      execSync(`powershell.exe -Command "Set-Clipboard -Value '${safe}'"`, { timeout: 5000 })
      return { success: true, output: `Copied to clipboard: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"` }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  window_list: async () => {
    try {
      const { execSync } = await import('child_process')
      const out = execSync(
        'powershell.exe -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne \'\'} | Select-Object -Property Id,ProcessName,MainWindowTitle | ConvertTo-Json"',
        { timeout: 10000 }
      ).toString().trim()
      return { success: true, output: out || '(no visible windows found)' }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  window_focus: async (p) => {
    const title = p.title || p.window || p.command || ''
    if (!title) return { success: false, output: '', error: 'No window title provided' }
    try {
      const { execSync } = await import('child_process')
      const safe = title.replace(/'/g, "''")
      execSync(
        `powershell.exe -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate('${safe}')"`,
        { timeout: 8000 }
      )
      return { success: true, output: `Focused window: "${title}"` }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  app_launch: async (p) => {
    const app = p.app || p.path || p.command || ''
    if (!app) return { success: false, output: '', error: 'No app specified' }
    if (isShellDangerous(app)) {
      return { success: false, output: '', error: 'CommandGate: Blocked potentially dangerous app launch.' }
    }
    try {
      const { execSync } = await import('child_process')
      const safe = app.replace(/'/g, "''")
      execSync(`powershell.exe -Command "Start-Process '${safe}'"`, { timeout: 10000 })
      return { success: true, output: `Launched: "${app}"` }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  app_close: async (p) => {
    const app = p.app || p.process || p.command || ''
    if (!app) return { success: false, output: '', error: 'No app/process name provided' }
    try {
      const { execSync } = await import('child_process')
      const safe = app.replace(/'/g, "''")
      execSync(`powershell.exe -Command "Stop-Process -Name '${safe}' -Force -ErrorAction SilentlyContinue"`, { timeout: 8000 })
      return { success: true, output: `Closed process: "${app}"` }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  // ── Sprint 24: Folder Watcher ─────────────────────────────────

  watch_folder: async (p) => {
    const rawFolder  = p.folder || p.path || p.dir || ''
    const goal       = p.goal   || p.command || ''
    const stop       = !!p.stop

    if (!rawFolder) return { success: false, output: '', error: 'No folder specified' }

    const userName  = process.env.USERPROFILE || process.env.HOME || ''
    const folderPath = rawFolder
      .replace(/%USERPROFILE%/gi, userName)
      .replace(/^~[\/\\]/,        userName + path.sep)

    // Stop mode
    if (stop) {
      const watcher = activeWatchers.get(folderPath)
      if (watcher) {
        watcher.close()
        activeWatchers.delete(folderPath)
        return { success: true, output: `Stopped watching: ${folderPath}` }
      }
      return { success: false, output: `No active watcher for: ${folderPath}` }
    }

    if (!goal) return { success: false, output: '', error: 'No goal specified' }
    if (!fs.existsSync(folderPath)) return { success: false, output: '', error: `Folder not found: ${folderPath}` }

    // Close existing watcher on same path before starting a new one
    const existing = activeWatchers.get(folderPath)
    if (existing) { existing.close(); activeWatchers.delete(folderPath) }

    const watcher = fs.watch(folderPath, async (eventType: string, filename: string | null) => {
      if (eventType !== 'rename' || !filename) return
      const fullPath = path.join(folderPath, filename)

      // Small delay to let the file finish writing
      await new Promise<void>(r => setTimeout(r, 500))
      if (!fs.existsSync(fullPath)) return

      let isFile = false
      try { isFile = fs.statSync(fullPath).isFile() } catch { return }
      if (!isFile) return

      try {
        await fetch('http://localhost:4200/api/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body:    JSON.stringify({ message: `${goal} — new file: ${fullPath}`, history: [] }),
        })
      } catch {}
    })

    activeWatchers.set(folderPath, watcher)
    return {
      success: true,
      output:  `Now watching: ${folderPath}\nWill execute: "${goal}" when new files appear.\nActive watchers: ${activeWatchers.size}`,
    }
  },

  watch_folder_list: async () => {
    if (activeWatchers.size === 0) return { success: true, output: 'No active folder watchers.' }
    const list = Array.from(activeWatchers.keys()).map((f, i) => `${i + 1}. ${f}`).join('\n')
    return { success: true, output: `Active watchers:\n${list}` }
  },

  get_briefing: async (_p) => {
    try {
      const config   = loadBriefingConfig()
      const briefing = await generateBriefing(config)
      return { success: true, output: briefing }
    } catch (e: any) {
      return { success: false, output: '', error: `Briefing failed: ${e.message}` }
    }
  },

  // ── manage_goals — track and manage long-running goals ────────
  manage_goals: async (p) => {
    const { loadGoals, saveGoals } = await import('./goalTracker')
    const goals = loadGoals()
    const today = new Date().toISOString().split('T')[0]

    switch (p.action) {
      case 'list':
        return { success: true, output: JSON.stringify(goals.filter(g => g.status !== 'done'), null, 2) }

      case 'add': {
        if (!p.title) return { success: false, output: '', error: 'Title required' }
        const { getLimit } = await import('./featureGates')
        const maxGoals = getLimit('maxGoals')
        const activeGoals = goals.filter(g => g.status !== 'done')
        if (activeGoals.length >= maxGoals) {
          return {
            success: false, output: '',
            error: `Goal limit reached (${maxGoals} active goals on Free plan). Complete existing goals or upgrade to Pro for unlimited goals.`,
          }
        }
        goals.push({
          id:          Date.now().toString(),
          title:       p.title,
          status:      'not_started',
          target:      p.target,
          nextAction:  p.nextAction,
          lastUpdated: today,
        })
        saveGoals(goals)
        return { success: true, output: `Goal added: ${p.title}` }
      }

      case 'update': {
        const g = goals.find(g => g.title.toLowerCase().includes((p.title || '').toLowerCase()))
        if (!g) return { success: false, output: '', error: 'Goal not found' }
        if (p.status)     g.status     = p.status
        if (p.nextAction) g.nextAction = p.nextAction
        if (p.target)     g.target     = p.target
        g.lastUpdated = today
        saveGoals(goals)
        return { success: true, output: `Updated: ${g.title}` }
      }

      case 'complete': {
        const idx = goals.findIndex(g => g.title.toLowerCase().includes((p.title || '').toLowerCase()))
        if (idx < 0) return { success: false, output: '', error: 'Goal not found' }
        goals[idx].status      = 'done'
        goals[idx].lastUpdated = today
        saveGoals(goals)
        return { success: true, output: `Completed: ${goals[idx].title}` }
      }

      case 'suggest': {
        const active = goals.filter(g => g.status !== 'done')
        if (active.length === 0) return { success: true, output: 'No active goals. What are you working on?' }
        return { success: true, output: `Focus on: ${active[0].title} — Next: ${active[0].nextAction || 'Define next step'}` }
      }

      case 'remove':
      case 'delete': {
        const before = goals.length
        const remaining = goals.filter(g => !g.title.toLowerCase().includes((p.title || '').toLowerCase()))
        if (remaining.length === before) return { success: false, output: '', error: 'Goal not found' }
        saveGoals(remaining)
        return { success: true, output: `Removed goal matching: ${p.title}` }
      }

      default:
        return { success: false, output: '', error: `Unknown action: ${p.action}. Use: list, add, update, complete, remove, suggest` }
    }
  },

  // ── ingest_youtube — extract transcript and store in Knowledge Base ──
  ingest_youtube: async (p) => {
    const url = String(p.url || '')
    if (!url) return { success: false, output: '', error: 'URL required' }

    const result = await extractYouTubeTranscript(url)

    if (!result) {
      return {
        success: false,
        output:  '',
        error:   'Could not extract transcript. The video may not have captions, ' +
                 'or YouTube blocked the request. Try installing yt-dlp, or paste ' +
                 'the transcript text directly into the chat.',
      }
    }

    const ingestResult = knowledgeBase.ingestText(
      result.fullText,
      `youtube_${result.title.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)}.txt`,
      'transcript',
      ['youtube', 'video', 'transcript'],
      'public',
    )

    if (!ingestResult.success) {
      return { success: false, output: '', error: ingestResult.error || 'Knowledge Base ingestion failed' }
    }

    console.log(`[YouTube] Ingested: "${result.title}" (${result.transcript.length} segments)`)
    return {
      success: true,
      output:  `Ingested transcript for "${result.title}" — ${result.transcript.length} segments, ` +
               `${result.fullText.length} characters stored in ${ingestResult.chunkCount} chunks. ` +
               `Now searchable in Knowledge Base.`,
    }
  },

  // ── get_calendar — fetch upcoming events from Google Calendar iCal ──
  get_calendar: async (p) => {
    const cfg      = loadConfig()
    const icalUrl  = cfg.calendar?.icalUrl
    if (!icalUrl) {
      return {
        success: false,
        output:  '',
        error:   'Calendar not configured. Add your Google Calendar iCal URL in Settings → Channels.',
      }
    }

    const daysAhead = typeof p.daysAhead === 'number' ? p.daysAhead : 7
    try {
      const events = await getCalendarEvents(icalUrl, daysAhead)
      if (events.length === 0) {
        return { success: true, output: `No upcoming events in the next ${daysAhead} day(s).` }
      }
      const formatted = events.map(e => {
        const when = e.start.toLocaleString()
        const loc  = e.location ? ` @ ${e.location}` : ''
        return `• ${e.title} — ${when}${loc}`
      }).join('\n')
      return { success: true, output: `Upcoming events (next ${daysAhead} days):\n${formatted}` }
    } catch (err: any) {
      return { success: false, output: '', error: `Calendar fetch failed: ${String(err).slice(0, 120)}` }
    }
  },

  // ── read_email — read recent Gmail messages via App Password ──
  read_email: async (p) => {
    const cfg         = loadConfig()
    const email       = cfg.gmail?.email
    const appPassword = cfg.gmail?.appPassword
    if (!email || !appPassword) {
      return {
        success: false,
        output:  '',
        error:   'Gmail not configured. Add your email and App Password in Settings → Channels.',
      }
    }

    const count = typeof p.count === 'number' ? p.count : 10
    const messages = await readGmail({ email, appPassword }, count, p.folder || 'INBOX')

    if (messages.length === 0) {
      return {
        success: true,
        output:  'No unread messages found, or imap-simple is not yet installed (run: npm install imap-simple).',
      }
    }

    const formatted = messages.map(m =>
      `• From: ${m.from}\n  Subject: ${m.subject}\n  Date: ${m.date}`,
    ).join('\n\n')

    return { success: true, output: `Recent emails (${messages.length}):\n\n${formatted}` }
  },

  // ── send_email — send an email via Gmail App Password ─────────
  send_email: async (p) => {
    const cfg         = loadConfig()
    const email       = cfg.gmail?.email
    const appPassword = cfg.gmail?.appPassword
    if (!email || !appPassword) {
      return {
        success: false,
        output:  '',
        error:   'Gmail not configured. Add your email and App Password in Settings → Channels.',
      }
    }

    const to      = String(p.to      || '')
    const subject = String(p.subject || '')
    const body    = String(p.body    || '')
    if (!to || !subject) {
      return { success: false, output: '', error: '`to` and `subject` are required.' }
    }

    const result = await sendGmail({ email, appPassword }, to, subject, body)
    if (result.success) {
      return { success: true, output: `Email sent to ${to}: "${subject}"` }
    }
    return { success: false, output: '', error: result.error || 'Send failed' }
  },

  // ── compact_context — summarize and compress conversation history ──
  compact_context: async (p) => {
    const { sessionMemory } = await import('./sessionMemory')
    const { memoryExtractor } = await import('./memoryExtractor')
    const sessionId = p.sessionId || 'default'

    try {
      // Trigger session write to persist current conversation state
      await sessionMemory.writeSession(sessionId)
      // Extract durable memories from session
      await memoryExtractor.extractFromSession(sessionId)
      return { success: true, output: `Context compacted for session ${sessionId}. Memory extracted and persisted.` }
    } catch (e: any) {
      return { success: false, output: '', error: `Compact failed: ${e.message}` }
    }
  },

  // ── ▲ run — execute JavaScript/TypeScript in the Aiden SDK sandbox ──────
  run: async (p) => {
    const code        = p.code || p.script || ''
    const description = p.description || ''
    if (!code) return { success: false, output: '', error: 'No code provided' }
    try {
      // Lazy import to avoid circular dependency at module init
      const { runInSandbox }  = await import('./runSandbox')
      const result = await runInSandbox(code, { timeout: p.timeout ?? 30000, maxToolCalls: p.maxToolCalls ?? 20 })
      const summary = [
        description ? `// ${description}` : '',
        result.output.join('\n'),
        result.error ? `[error] ${result.error}` : '',
        result.toolCalls.length > 0
          ? `[tools] ${result.toolCalls.map(c => `${c.tool}(${c.durationMs}ms)`).join(', ')}`
          : '',
        `[duration] ${result.durationMs}ms`,
      ].filter(Boolean).join('\n')
      return { success: result.success, output: summary, error: result.error }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },

  // ── ▲ spawn — delegate a sub-task to an isolated subagent ────────────────
  spawn: async (p) => {
    const task    = p.task || p.prompt || ''
    const context = p.context ?? undefined
    const timeout = typeof p.timeout === 'number' ? p.timeout : 60000
    if (!task) return { success: false, output: '', error: 'No task provided' }
    try {
      const { spawnSubagent }  = await import('./spawnManager')
      const { getBudgetState } = await import('./agentLoop')
      const budget = getBudgetState() ?? { current: 1, max: 10, remaining: 9 }
      const result = await spawnSubagent({ task, context, timeout, parentBudget: budget })
      const out = [
        result.result ?? '',
        `[spawn] iterations=${result.iterationsUsed}  duration=${result.duration}ms`,
        result.providerChain.length ? `[providers] ${result.providerChain.join(' → ')}` : '',
      ].filter(Boolean).join('\n')
      return { success: result.success, output: out, error: result.error }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },

  // ── ▲ swarm — run parallel subagents and aggregate results ───────────────
  swarm: async (p) => {
    const task     = p.task || p.prompt || ''
    const n        = typeof p.n === 'number' ? Math.max(2, Math.min(p.n, 5)) : 3
    const strategy = p.strategy ?? 'vote'
    const timeout  = typeof p.timeout === 'number' ? p.timeout : 90000
    if (!task) return { success: false, output: '', error: 'No task provided' }
    try {
      const { swarmSubagents } = await import('./swarmManager')
      const { getBudgetState } = await import('./agentLoop')
      const budget = getBudgetState() ?? { current: 1, max: 10, remaining: 9 }
      const result = await swarmSubagents({ task, n, strategy, timeout, parentBudget: budget })
      const out = [
        result.result ?? '',
        `[swarm] agents=${result.agentsRun}  strategy=${result.strategy}  duration=${result.duration}ms`,
      ].filter(Boolean).join('\n')
      return { success: result.success, output: out, error: result.error }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },
  // ── ▲ search — hybrid BM25 + semantic search over sessions & memory ─────
  search: async (p) => {
    const query = p.query || p.q || ''
    const topK  = typeof p.topK === 'number' ? p.topK : 5
    if (!query) return { success: false, output: '', error: 'No query provided' }
    try {
      const { hybridSearch } = await import('./hybridSearch')
      const hits = hybridSearch(query, { topK })
      if (!hits.length) return { success: true, output: 'No results found.' }
      const out = hits.map((h, i) =>
        `[${i + 1}] (${(h.score * 100).toFixed(0)}%) ${h.title}\n    ${h.snippet}`
      ).join('\n\n')
      return { success: true, output: out }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },

  // ── clarify — ask the user a multi-choice or free-text question mid-task ──
  clarify: async (p) => {
    const question      = p.question || p.q || ''
    const options       = Array.isArray(p.options) ? p.options as string[] : undefined
    const allowFreeText = p.allow_free_text !== false
    if (!question) return { success: false, output: '', error: 'No question provided' }
    try {
      const { ask } = await import('./clarifyBus')
      const answer  = await ask(question, options, allowFreeText)
      return { success: true, output: answer }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },

  // ── todo — per-session task list ──────────────────────────────────────────
  todo: async (p) => {
    const op = (p.op || p.operation || 'list').toLowerCase()
    try {
      const {
        addTodo, completeTodo, removeTodo, clearTodos,
        listTodos, formatTodoList,
      } = await import('./todoManager')

      if (op === 'add') {
        const text = p.text || p.item || ''
        if (!text) return { success: false, output: '', error: 'No text provided for add' }
        const item = addTodo(text, p.priority ?? 'normal')
        return { success: true, output: `Added [${item.id}]: ${item.text}` }
      }
      if (op === 'complete' || op === 'done') {
        const id = String(p.id ?? '')
        if (!id) return { success: false, output: '', error: 'No id provided' }
        const item = completeTodo(id)
        if (!item) return { success: false, output: '', error: `Todo ${id} not found` }
        return { success: true, output: `Completed [${item.id}]: ${item.text}` }
      }
      if (op === 'remove' || op === 'delete') {
        const id = String(p.id ?? '')
        if (!id) return { success: false, output: '', error: 'No id provided' }
        const ok = removeTodo(id)
        return { success: ok, output: ok ? `Removed todo ${id}` : `Todo ${id} not found` }
      }
      if (op === 'clear') {
        const n = clearTodos()
        return { success: true, output: `Cleared ${n} todo(s)` }
      }
      // Default: list
      const filter = (p.filter ?? 'all') as 'all' | 'pending' | 'done'
      const items  = listTodos(filter)
      return { success: true, output: formatTodoList(items) }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },

  // ── cronjob — scheduled task tool ────────────────────────────────────────
  cronjob: async (p) => {
    const op = (p.op || p.operation || 'list').toLowerCase()
    try {
      const {
        createJob, listJobs, pauseJob, resumeJob,
        deleteJob, triggerJob, getJob,
      } = await import('./cronManager')

      if (op === 'create') {
        const description = p.description || p.name || ''
        const schedule    = p.schedule    || ''
        const action      = p.action      || p.command || ''
        if (!schedule || !action) {
          return { success: false, output: '', error: 'schedule and action are required' }
        }
        const job = createJob(description || action, schedule, action)
        return { success: true, output: `Created job [${job.id}]: ${job.description} — ${job.schedule}` }
      }
      if (op === 'list') {
        const jobs = listJobs()
        if (!jobs.length) return { success: true, output: 'No cron jobs.' }
        const lines = jobs.map(j => {
          const status = j.enabled ? '▶' : '⏸'
          return `[${j.id}] ${status} ${j.description} | ${j.schedule} | runs: ${j.runCount} | next: ${j.nextRun ?? 'n/a'}`
        })
        return { success: true, output: lines.join('\n') }
      }
      if (op === 'pause') {
        const id  = String(p.id ?? '')
        const ok  = pauseJob(id)
        return { success: ok, output: ok ? `Paused job ${id}` : `Job ${id} not found` }
      }
      if (op === 'resume') {
        const id  = String(p.id ?? '')
        const ok  = resumeJob(id)
        return { success: ok, output: ok ? `Resumed job ${id}` : `Job ${id} not found` }
      }
      if (op === 'delete' || op === 'remove') {
        const id  = String(p.id ?? '')
        const ok  = deleteJob(id)
        return { success: ok, output: ok ? `Deleted job ${id}` : `Job ${id} not found` }
      }
      if (op === 'trigger' || op === 'run') {
        const id  = String(p.id ?? '')
        const ok  = await triggerJob(id)
        return { success: ok, output: ok ? `Triggered job ${id}` : `Job ${id} not found` }
      }
      if (op === 'get') {
        const id  = String(p.id ?? '')
        const job = getJob(id)
        if (!job) return { success: false, output: '', error: `Job ${id} not found` }
        return { success: true, output: JSON.stringify(job, null, 2) }
      }
      return { success: false, output: '', error: `Unknown op: ${op}` }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },

  // ── vision_analyze — image analysis via provider vision APIs ─────────────
  vision_analyze: async (p) => {
    const imageSource = p.image || p.path || p.url || p.source || ''
    const prompt      = p.prompt || p.question || 'Describe this image in detail.'
    if (!imageSource) return { success: false, output: '', error: 'No image source provided (use image, path, or url)' }
    try {
      const { analyzeImage } = await import('./visionAnalyze')
      const result = await analyzeImage(imageSource, prompt)
      return {
        success: true,
        output:  `[${result.provider}/${result.modelUsed}] (${result.durationMs}ms)\n\n${result.description}`,
      }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },

  // ── voice_speak — TTS with provider fallback chain ────────────────────────
  voice_speak: async (p) => {
    const text = p.text || p.command || ''
    if (!text) return { success: false, output: '', error: 'No text provided' }
    try {
      const { synthesize } = await import('./voice/tts')
      const result = await synthesize({
        text,
        voice:     p.voice,
        rate:      p.rate,
        volume:    p.volume,
        provider:  p.provider,
        timeoutMs: p.timeoutMs,
      })
      if (result.error) return { success: false, output: '', error: result.error }
      return { success: true, output: `Spoken via ${result.provider} (${result.durationMs}ms)` }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },

  // ── voice_transcribe — STT with provider fallback chain ──────────────────
  voice_transcribe: async (p) => {
    const audioFilePath = p.audioFilePath || p.path || p.file || ''
    if (!audioFilePath) return { success: false, output: '', error: 'No audioFilePath provided' }
    try {
      const { transcribe } = await import('./voice/stt')
      const result = await transcribe({ audioFilePath, language: p.language })
      if (result.error) return { success: false, output: '', error: result.error }
      return {
        success: true,
        output:  JSON.stringify({ text: result.text, provider: result.provider, durationMs: result.durationMs }),
      }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },

  // ── voice_clone — clone a voice from reference audio (VoxCPM / ElevenLabs) ─
  voice_clone: async (p) => {
    const text               = p.text || ''
    const referenceAudioPath = p.referenceAudioPath || p.reference || p.ref || ''
    if (!text)               return { success: false, output: '', error: 'No text provided' }
    if (!referenceAudioPath) return { success: false, output: '', error: 'No referenceAudioPath provided' }
    try {
      const { synthesize } = await import('./voice/tts')
      const result = await synthesize({
        text,
        voice:              p.voice,
        provider:           p.provider,
        referenceAudioPath,
        timeoutMs:          p.timeoutMs ?? 120_000,
      } as any)
      if (result.error) return { success: false, output: '', error: result.error }
      return { success: true, output: `Voice cloned via ${result.provider} (${result.durationMs}ms)` }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },

  // ── voice_design — synthesize with a text voice description (VoxCPM) ──────
  voice_design: async (p) => {
    const text             = p.text || ''
    const voiceDescription = p.voiceDescription || p.description || p.design || ''
    if (!text)             return { success: false, output: '', error: 'No text provided' }
    if (!voiceDescription) return { success: false, output: '', error: 'No voiceDescription provided' }
    try {
      const { synthesize } = await import('./voice/tts')
      const result = await synthesize({
        text:        `design:${voiceDescription}\n${text}`,
        provider:    p.provider,
        timeoutMs:   p.timeoutMs ?? 120_000,
      } as any)
      if (result.error) return { success: false, output: '', error: result.error }
      return { success: true, output: `Voice designed via ${result.provider} (${result.durationMs}ms)` }
    } catch (e: any) {
      return { success: false, output: '', error: e.message }
    }
  },
}

// ── Plugin-registered tools ───────────────────────────────────

const externalTools: Record<string, (payload: any) => Promise<RawResult>> = {}
const externalToolsMeta: Record<string, { source: string }> = {}

export function registerExternalTool(
  name:   string,
  fn:     (input: Record<string, any>) => Promise<{ success: boolean; output: string }>,
  source: string,
): void {
  externalTools[name] = async (input: any): Promise<RawResult> => {
    const r = await fn(input)
    return { success: r.success, output: r.output }
  }
  externalToolsMeta[name] = { source }
  console.log(`[ToolRegistry] Plugin "${source}" registered tool: ${name}`)
}

/** Returns a snapshot of all plugin-registered tool metadata (source, etc.). */
export function getExternalToolsMeta(): Record<string, { source: string }> {
  return { ...externalToolsMeta }
}

// ── Internal dispatcher — no retry, no timeout ────────────────

async function runTool(tool: string, input: Record<string, any>): Promise<RawResult> {
  // Core tool
  const fn = TOOLS[tool]
  if (fn) return fn(input)

  // Plugin-registered tool
  if (externalTools[tool]) return externalTools[tool](input)

  // ── MCP tool dispatch ─────────────────────────────────────
  // Tool names follow the pattern: mcp_<serverName>_<toolName>
  if (tool.startsWith('mcp_')) {
    const withoutPrefix = tool.slice(4)                     // drop "mcp_"
    const underIdx      = withoutPrefix.indexOf('_')
    if (underIdx !== -1) {
      const serverName  = withoutPrefix.slice(0, underIdx)
      const mcpToolName = withoutPrefix.slice(underIdx + 1)
      const result      = await mcpClient.callTool(serverName, mcpToolName, input)
      return { success: result.success, output: result.output }
    }
  }
  // ── New-style colon-prefix MCP tool: 'github:list_issues' ────
  if (tool.includes(':')) {
    try {
      const { callMcpTool } = await import('./mcpClient')
      const result = await callMcpTool(tool, input)
      return {
        success: result.isError !== true,
        output:  typeof result === 'string' ? result
          : result.content?.map((c: any) => c.text ?? JSON.stringify(c)).join('\n')
            ?? JSON.stringify(result),
      }
    } catch (e: any) {
      return { success: false, output: '', error: `MCP tool "${tool}" failed: ${e.message}` }
    }
  }

  // Last resort: try shell_exec
  const cmd = input?.command || ''
  if (cmd) return TOOLS.shell_exec({ command: cmd })
  throw new Error(`Unknown tool: ${tool}`)
}

// ── Public executor — retry + per-tool timeout ────────────────
// maxRetries: number of retries AFTER the first attempt (default 2 = 3 total tries)
// timeoutMs: fallback timeout when tool has no entry in TOOL_TIMEOUTS

export async function executeTool(
  tool:       string,
  input:      Record<string, any>,
  maxRetries: number = 2,
  timeoutMs:  number = 30000,
): Promise<ToolResult> {
  const start     = Date.now()
  let   lastError = ''
  let   retries   = 0

  // ── Sprint 17: cache check ────────────────────────────────────
  const cachedOutput = responseCache.get(tool, input)
  if (cachedOutput !== null) {
    return {
      tool, input,
      success:  true,
      output:   cachedOutput,
      duration: Date.now() - start,
      retries:  0,
    }
  }

  const timeout = TOOL_TIMEOUTS[tool] ?? timeoutMs

  // Errors that should not be retried (permanent failures)
  const NO_RETRY_PATTERNS = [
    'not found', 'permission denied', 'invalid input',
    'file not found', 'syntax error', 'enoent', 'no path', 'no url',
    'no query', 'no script', 'no command', 'unknown tool',
  ]

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      retries++
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000))
      console.log(`[Executor] Retry ${attempt}/${maxRetries} for ${tool}`)
    }

    try {
      const raw = await Promise.race([
        runTool(tool, input),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Tool timeout after ${timeout}ms`)), timeout),
        ),
      ])

      const result: ToolResult = {
        tool, input,
        success:  raw.success,
        output:   String(raw.output || ''),
        error:    raw.error,
        duration: Date.now() - start,
        retries,
      }

      // ── Sprint 17: cache successful results ───────────────────
      if (result.success && result.output) {
        responseCache.set(tool, input, result.output)
      }

      return result

    } catch (e: any) {
      lastError = e.message || String(e)
      console.warn(`[Executor] ${tool} attempt ${attempt + 1} failed: ${lastError.slice(0, 120)}`)

      // Don't retry on permanent errors
      if (NO_RETRY_PATTERNS.some(p => lastError.toLowerCase().includes(p))) {
        break
      }
    }
  }

  return {
    tool, input,
    success:  false,
    output:   '',
    error:    lastError,
    duration: Date.now() - start,
    retries,
  }
}
// ── Sprint 29: TOOL_DESCRIPTIONS ────────────────────────────────
// Human-readable descriptions for all tools, used by the MCP server to advertise
// capabilities to Claude Desktop and other MCP clients.

export const TOOL_DESCRIPTIONS: Record<string, string> = {
  web_search:              'Search the web for current information, news, or any topic',
  fetch_url:               'Fetch the content of any URL and return the text',
  fetch_page:              'Fetch a web page and extract its readable text content',
  deep_research:           'Conduct thorough multi-step research on a topic using multiple sources',
  open_browser:            'Open a URL in the system browser',
  browser_click:           'Click on an element in the browser by selector',
  browser_type:            'Type text into a browser input field',
  browser_extract:         'Extract text content from the current browser page',
  browser_screenshot:      'Take a screenshot of the current browser window',
  file_write:              'Write content to a file at the specified path',
  file_read:               'Read the contents of a file at the specified path',
  file_list:               'List files in a directory',
  shell_exec:              'Execute a shell/PowerShell command and return the output',
  run_powershell:          'Run a PowerShell command on Windows',
  cmd:                     'Run a Windows cmd.exe command and return stdout/stderr/exitCode',
  ps:                      'Run a PowerShell command directly (no temp file) and return stdout/stderr/exitCode',
  wsl:                     'Run a bash command inside WSL (Windows Subsystem for Linux); auto-translates C:\\ paths to /mnt/c/',
  run_python:              'Execute a Python script and return stdout/stderr',
  run_node:                'Execute Node.js/JavaScript code and return the output',
  system_info:             'Get system hardware and OS information (CPU, RAM, disk, OS)',
  notify:                  'Send a desktop notification to the user',
  get_stocks:              'Get top gainers, losers, or most active stocks from NSE/BSE',
  get_market_data:         'Get real-time price, change%, and volume for a stock symbol',
  get_company_info:        'Get company profile, sector, P/E ratio, EPS, and revenue',
  social_research:         'Research a person or company across social and public sources',
  mouse_move:              'Move the mouse cursor to screen coordinates',
  mouse_click:             'Click the mouse at screen coordinates',
  keyboard_type:           'Type text using the keyboard',
  keyboard_press:          'Press a keyboard key or shortcut (e.g. ctrl+c)',
  screenshot:              'Take a screenshot of the entire screen',
  screen_read:             'Read and describe the current screen contents',
  vision_loop:             'Autonomously control the computer using vision to complete a goal',
  wait:                    'Pause execution for a specified number of milliseconds',
  code_interpreter_python: 'Run Python code in a sandboxed interpreter with data science libraries',
  code_interpreter_node:   'Run Node.js code in a sandboxed interpreter',
  run_agent:               'Spawn a sub-agent to complete a sub-goal autonomously',
  git_status:              'Show git status and recent commits for a repository. Provide path parameter for a specific directory.',
  git_commit:              'Stage and commit files to a local git repository',
  git_push:                'Push committed changes to a remote git repository',
  clipboard_read:          'Read the current contents of the system clipboard',
  clipboard_write:         'Write text to the system clipboard',
  window_list:             'List all open windows on the desktop',
  window_focus:            'Bring a specific window to the foreground by title',
  app_launch:              'Launch an application by name or executable path',
  app_close:               'Close an application by window title',
  watch_folder:            'Watch a folder and react automatically when new files appear',
  watch_folder_list:       'List all currently watched folder paths',
  get_briefing:            'Run the morning briefing: weather, markets, news, and daily summary',
  respond:                 'Send a direct conversational response to the user. Use for greetings, capability questions, clarifications, simple factual answers, and anything that does NOT require external tools. This is the default tool when no other tool is needed.',
  manage_goals:            'Track and manage goals and projects. Use when user asks what to work on, mentions a project, deadline, or launch plan. Actions: list, add, update, complete, remove, suggest.',
  get_calendar:            'Get upcoming calendar events from Google Calendar (requires iCal URL in Settings → Channels). Parameters: daysAhead (number, default 7).',
  read_email:              'Read recent unread emails from Gmail (requires App Password in Settings → Channels). Parameters: count (number, default 10), folder (string, default INBOX).',
  send_email:              'Send an email via Gmail (requires App Password in Settings → Channels). Parameters: to (string), subject (string), body (string).',
  compact_context:         'Summarize and compress the current conversation context. Saves session to disk and extracts durable memories. Call when context is getting long.',
  get_natural_events:      'Fetch active natural events from NASA EONET API. Returns current earthquakes, wildfires, storms, floods, and other natural events worldwide.',
  voice_speak:             'Speak text aloud using the TTS provider chain (VoxCPM → Edge TTS → ElevenLabs → SAPI). Accepts text, voice, rate, volume, provider overrides.',
  voice_transcribe:        'Transcribe an audio file to text using the STT provider chain (Groq Whisper → OpenAI Whisper → Whisper.cpp). Returns { text, provider, durationMs }.',
  voice_clone:             'Clone a voice from a reference audio file and synthesize new text. Requires text and referenceAudioPath. Uses VoxCPM when USE_VOXCPM=1.',
  voice_design:            'Design a custom voice from a text description and synthesize text with it. Requires text and voiceDescription. Uses VoxCPM when USE_VOXCPM=1.',
}

// ── Tool tier hierarchy ────────────────────────────────────────
// Tier 1: APIs, data, search — fastest, most reliable, zero side effects
// Tier 2: File system, shell, code execution — local side effects
// Tier 3: Browser automation — slow, brittle, UI-dependent
// Tier 4: Screen/mouse/keyboard control — last resort only

export type ToolTier = 1 | 2 | 3 | 4

const TOOL_TIERS: Record<string, ToolTier> = {
  // Tier 1 — APIs, data, search, notify, respond
  respond:                 1,
  manage_goals:            1,
  compact_context:         1,
  web_search:              1,
  fetch_url:               1,
  fetch_page:              1,
  deep_research:           1,
  get_stocks:              1,
  get_market_data:         1,
  get_company_info:        1,
  social_research:         1,
  system_info:             1,
  notify:                  1,
  wait:                    1,
  get_briefing:            1,
  get_natural_events:      1,
  get_calendar:            1,
  read_email:              1,
  send_email:              1,
  run_agent:               1,

  // Tier 2 — File system, shell, code execution
  file_write:              2,
  file_read:               2,
  file_list:               2,
  shell_exec:              2,
  run_powershell:          2,
  cmd:                     2,
  ps:                      2,
  wsl:                     2,
  run_python:              2,
  run_node:                2,
  code_interpreter_python: 2,
  code_interpreter_node:   2,
  git_status:              2,
  git_commit:              2,
  git_push:                2,
  clipboard_read:          2,
  clipboard_write:         2,
  watch_folder:            2,
  watch_folder_list:       2,

  // Tier 3 — Browser automation
  open_browser:            3,
  browser_click:           3,
  browser_type:            3,
  browser_extract:         3,
  browser_screenshot:      3,
  window_list:             3,
  window_focus:            3,
  app_launch:              3,
  app_close:               3,

  // Voice tools — Tier 2 (subprocess / local model)
  voice_speak:             2,
  voice_transcribe:        2,
  voice_clone:             2,
  voice_design:            2,

  // Tier 4 — Screen/mouse/keyboard (last resort)
  mouse_move:              4,
  mouse_click:             4,
  keyboard_type:           4,
  keyboard_press:          4,
  screenshot:              4,
  screen_read:             4,
  vision_loop:             4,
}

export function getToolTier(toolName: string): ToolTier {
  if (toolName.startsWith('mcp_')) return 1
  return TOOL_TIERS[toolName] ?? 2
}

// ── Dynamic tool loading — category-based filtering ───────────
// Reduces planner prompt from ~15K tokens to ~3-5K by only showing
// tools relevant to the current task category.

export type ToolCategory =
  | 'core'          // respond, manage_goals, compact_context, run_agent
  | 'web'           // web_search, deep_research, fetch_url/page, social_research
  | 'files'         // file_read, file_write, file_list, watch_folder
  | 'code'          // run_python, run_node, shell_exec, run_powershell, interpreters
  | 'browser'       // open_browser, browser_click/type/extract/screenshot, window ops
  | 'screen'        // screenshot, mouse, keyboard, screen_read, vision_loop
  | 'data'          // market data, stocks, company info, briefing, natural events
  | 'system'        // notify, system_info, clipboard, app_launch/close, wait
  | 'git'           // git_status, git_commit, git_push
  | 'memory'        // (reserved for future memory/knowledge tools)
  | 'media'         // (reserved for future audio/media tools)
  | 'voice'         // voice_speak, voice_transcribe, voice_clone, voice_design
  | 'introspection' // status, analytics, spend, memory_show, lessons, skills_list, tools_list, whoami, channels_status, goals
  | 'delegation'    // spawn, swarm — subagent orchestration
  | 'interaction'   // clarify, todo — user-facing interaction tools

const TOOL_CATEGORIES: Record<string, ToolCategory[]> = {
  respond:                 ['core'],
  manage_goals:            ['core'],
  compact_context:         ['core'],
  run_agent:               ['core'],
  web_search:              ['web', 'data'],
  deep_research:           ['web'],
  fetch_url:               ['web'],
  fetch_page:              ['web'],
  social_research:         ['web', 'data'],
  file_read:               ['files'],
  file_write:              ['files'],
  file_list:               ['files'],
  watch_folder:            ['files', 'system'],
  watch_folder_list:       ['files', 'system'],
  run_python:              ['code'],
  run_node:                ['code'],
  shell_exec:              ['code', 'system'],
  run_powershell:          ['code', 'system'],
  cmd:                     ['code', 'system'],
  ps:                      ['code', 'system'],
  wsl:                     ['code', 'system'],
  code_interpreter_python: ['code'],
  code_interpreter_node:   ['code'],
  open_browser:            ['browser'],
  browser_click:           ['browser'],
  browser_type:            ['browser'],
  browser_extract:         ['browser'],
  browser_screenshot:      ['browser'],
  window_list:             ['browser', 'system'],
  window_focus:            ['browser', 'system'],
  app_launch:              ['browser', 'system'],
  app_close:               ['browser', 'system'],
  screenshot:              ['screen'],
  mouse_move:              ['screen'],
  mouse_click:             ['screen'],
  keyboard_type:           ['screen'],
  keyboard_press:          ['screen'],
  screen_read:             ['screen'],
  vision_loop:             ['screen'],
  get_market_data:         ['data'],
  get_company_info:        ['data'],
  get_stocks:              ['data'],
  get_briefing:            ['data'],
  get_natural_events:      ['data'],
  notify:                  ['system'],
  system_info:             ['system'],
  wait:                    ['system', 'browser', 'screen'],
  clipboard_read:          ['system', 'code'],
  clipboard_write:         ['system', 'code'],
  git_status:              ['git'],
  git_commit:              ['git'],
  git_push:                ['git'],
  ingest_youtube:          ['web', 'memory'],
  get_calendar:            ['data', 'system'],
  read_email:              ['data', 'system'],
  send_email:              ['data', 'system'],
  // slash-mirror introspection tools
  status:                  ['introspection'],
  analytics:               ['introspection'],
  spend:                   ['introspection'],
  memory_show:             ['introspection', 'memory'],
  lessons:                 ['introspection', 'memory'],
  skills_list:             ['introspection'],
  tools_list:              ['introspection'],
  whoami:                  ['introspection'],
  channels_status:         ['introspection'],
  goals:                   ['introspection', 'memory'],
  run:                     ['code'],
  spawn:                   ['delegation', 'core'],
  swarm:                   ['delegation', 'core'],
  search:                  ['memory', 'introspection'],
  clarify:                 ['interaction', 'core'],
  todo:                    ['interaction', 'core'],
  cronjob:                 ['system', 'core'],
  vision_analyze:          ['screen', 'data'],
  voice_speak:             ['voice'],
  voice_transcribe:        ['voice'],
  voice_clone:             ['voice'],
  voice_design:            ['voice'],
}

export function detectToolCategories(message: string): ToolCategory[] {
  const categories = new Set<ToolCategory>(['core'])
  const msg = message.toLowerCase()

  if (/search|research|find|look up|what is|who is|latest|news|article|google/i.test(msg))
    categories.add('web')
  if (/file|read|write|save|create|folder|directory|pdf|document|\.txt|\.csv|\.json|\.md/i.test(msg))
    categories.add('files')
  if (/code|script|python|node|run|execute|build|deploy|npm|pip|function|class|powershell/i.test(msg))
    categories.add('code')
  if (/open|browse|website|url|http|chrome|click|navigate|youtube|browser|tab/i.test(msg))
    categories.add('browser')
  if (/screen|screenshot|mouse|click on|type in|desktop|window|app\b|vision|control/i.test(msg))
    categories.add('screen')
  if (/stock|nifty|market|price|nse|bse|sensex|reliance|trading|shares|equity|briefing|weather|natural|earthquake/i.test(msg))
    categories.add('data')
  if (/notify|notification|remind|alert|system info|cpu|ram|disk|hardware|clipboard|launch|close app/i.test(msg))
    categories.add('system')
  if (/voice|speak|say aloud|listen|record audio|tts|text.to.speech|transcribe|speech.to.text|clone.*voice|voice.*design|voice.*clone|design.*voice/i.test(msg))
    categories.add('voice')
  if (/play audio|play music|media file|audio file/i.test(msg))
    categories.add('media')
  if (/\bgit\b|commit|push|pull|branch|merge|git status|diff|repo|repository/i.test(msg))
    categories.add('git')
  if (/remember|memory|forget|knowledge|learn|recall/i.test(msg))
    categories.add('memory')
  if (/status|uptime|analytics|how much.*spent|spending|cost|lessons|skills|what tools|tools (do you|available)|who am i|whoami|channels|providers|my goals|active goals/i.test(msg))
    categories.add('introspection')
  if (/spawn|swarm|subagent|delegate|parallel agent|fork agent/i.test(msg))
    categories.add('delegation')
  if (/todo|task list|add task|complete task|checklist|mark done/i.test(msg))
    categories.add('interaction')
  if (/clarify|ask me|which option|confirm|choose|multiple choice/i.test(msg))
    categories.add('interaction')
  if (/cron|schedule|every \d|daily|hourly|recurring|repeat|interval/i.test(msg))
    categories.add('system')
  if (/analyze image|vision|describe image|what.*image|image.*show|photo|screenshot.*describe/i.test(msg))
    categories.add('screen')

  return Array.from(categories)
}

export function getToolsForCategories(categories: ToolCategory[]): string[] {
  const tools = new Set<string>()
  for (const [toolName, toolCats] of Object.entries(TOOL_CATEGORIES)) {
    if (toolCats.some(c => (categories as string[]).includes(c))) {
      tools.add(toolName)
    }
  }
  return Array.from(tools)
}
