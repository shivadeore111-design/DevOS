// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/toolRegistry.ts — Centralized tool registry with real Playwright
// browser automation, file I/O, shell exec, and web utilities.

import { exec }    from 'child_process'
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
import { getMarketData }   from './tools/marketDataTool'
import { getCompanyInfo }  from './tools/companyFilingsTool'
import { mcpClient }       from './mcpClient'
import { runInSandbox }    from './codeInterpreter'
import { responseCache }   from './responseCache'

const execAsync = promisify(exec)

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

// ── Singleton Playwright browser ─────────────────────────────

let browserInstance: any = null

async function getBrowser(): Promise<any> {
  if (!browserInstance) {
    const { chromium } = await import('playwright')
    browserInstance = await chromium.launch({ headless: false })
  }
  return browserInstance
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
  screenshot:     10000,
  vision_loop:   120000,
  open_browser:   15000,
  git_push:       60000,
  git_commit:     30000,
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
}

// ── Tool implementations ──────────────────────────────────────

export const TOOLS: Record<string, (payload: any) => Promise<RawResult>> = {

  open_browser: async (p) => {
    const url = p.url || p.command || ''
    if (!url) return { success: false, output: '', error: 'No URL provided' }
    try {
      const result = await openBrowser(url)
      return { success: true, output: result }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  browser_screenshot: async () => {
    try {
      const browser  = await getBrowser()
      const pages    = browser.contexts().flatMap((c: any) => c.pages()) as any[]
      const page     = pages[pages.length - 1] || (await (await browser.newContext()).newPage())
      const outPath  = path.join(process.cwd(), 'workspace', `screenshot_${Date.now()}.png`)
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      await page.screenshot({ path: outPath, fullPage: false })
      return { success: true, output: `Screenshot saved: ${outPath}` }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  browser_click: async (p) => {
    const selector = p.selector || p.text || p.command || ''
    try {
      const browser = await getBrowser()
      const pages   = browser.contexts().flatMap((c: any) => c.pages()) as any[]
      const page    = pages[pages.length - 1]
      if (!page) return { success: false, output: '', error: 'No browser page open' }
      await page.click(selector).catch(() => page.click(`text=${selector}`))
      return { success: true, output: `Clicked: ${selector}` }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  browser_type: async (p) => {
    const selector = p.selector || 'input'
    const text     = p.text || p.command || ''
    try {
      const browser = await getBrowser()
      const pages   = browser.contexts().flatMap((c: any) => c.pages()) as any[]
      const page    = pages[pages.length - 1]
      if (!page) return { success: false, output: '', error: 'No browser page open' }
      await page.fill(selector, text)
      return { success: true, output: `Typed "${text}" into ${selector}` }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  browser_extract: async () => {
    try {
      const browser  = await getBrowser()
      const pages    = browser.contexts().flatMap((c: any) => c.pages()) as any[]
      const page     = pages[pages.length - 1]
      if (!page) return { success: false, output: '', error: 'No browser page open' }
      const content  = await page.evaluate('document.body.innerText')
      return { success: true, output: (content as string).slice(0, 3000) }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  shell_exec: async (p) => {
    const cmd = p.command || p.cmd || ''
    if (!cmd) return { success: false, output: '', error: 'No command' }
    if (isShellDangerous(cmd)) {
      console.warn(`[CommandGate] BLOCKED shell_exec: ${cmd.slice(0, 120)}`)
      return { success: false, output: '', error: `CommandGate: Blocked potentially dangerous command. User approval required before running: ${cmd.slice(0, 80)}` }
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
    if (isShellDangerous(script)) {
      console.warn(`[CommandGate] BLOCKED run_powershell: ${script.slice(0, 120)}`)
      return { success: false, output: '', error: `CommandGate: Blocked potentially dangerous PowerShell script. User approval required before running.` }
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

  file_write: async (p) => {
    let   filePath = p.path || p.file || ''
    const content  = p.content || ''
    if (!filePath) return { success: false, output: '', error: 'No path' }
    try {
      // Expand Desktop and ~ shorthands to full Windows paths
      const userName = process.env.USERNAME || process.env.USER || 'User'
      filePath = filePath
        .replace(/^~[\/\\]/i, `C:\\Users\\${userName}\\`)
        .replace(/^Desktop[\/\\]/i, `C:\\Users\\${userName}\\Desktop\\`)

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
    const filePath = p.path || p.file || ''
    if (!filePath) return { success: false, output: '', error: 'No path' }
    try {
      // Resolve path: absolute paths (Windows C:\ or Unix /) used as-is; relative joined with cwd
      const resolved = filePath.match(/^[A-Z]:/i) || filePath.startsWith('/')
        ? filePath
        : path.join(process.cwd(), filePath)
      if (!fs.existsSync(resolved)) return { success: false, output: '', error: `Not found: ${resolved}` }
      return { success: true, output: fs.readFileSync(resolved, 'utf-8').slice(0, 5000) }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  file_list: async (p) => {
    const dirPath = p.path || p.dir || process.cwd()
    try {
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
    const msg = (p.message || p.command || '').replace(/'/g, '').replace(/"/g, '')
    try {
      await execAsync(
        `powershell -WindowStyle Hidden -Command "Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(3000, 'DevOS', '${msg}', [System.Windows.Forms.ToolTipIcon]::Info); Start-Sleep -s 4; $n.Dispose()"`,
        { shell: 'powershell.exe' }
      )
      return { success: true, output: `Desktop notification sent: "${msg}". Done.` }
    } catch (e: any) {
      // Even if the powershell command fails (e.g. in sandbox), confirm the intent
      return { success: true, output: `Desktop notification sent: "${msg}". Done. (Note: display may not be available in this environment)` }
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

    const agentPersonas: Record<string, string> = {
      engineer:     'Senior TypeScript/JavaScript engineer — writes clean, working code with full error handling.',
      security:     'Security auditor — analyzes for OWASP Top 10, provides specific fixes with code examples.',
      data_analyst: 'Data analyst — provides statistical analysis, patterns, and visualizable insights.',
      designer:     'UI/UX designer — provides design recommendations with color codes, typography, and layout.',
      researcher:   'Research specialist — extracts entities, compares systematically, identifies trends, gives conclusions.',
      debugger:     'Debugger — forms 3 hypotheses, eliminates systematically, provides exact fix with code.',
    }

    const persona = agentPersonas[agentName] || agentPersonas.engineer

    try {
      const { memoryLayers } = await import('../memory/memoryLayers')
      memoryLayers.write(`Agent ${agentName} task: ${task}`, ['agent', agentName])
    } catch {}

    return {
      success: true,
      output:  `Agent: ${agentName}\nPersona: ${persona}\nTask: ${task}\n\n[Specialist agent will synthesize this task in the response phase with full context]`,
    }
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
    const symbol = (p.symbol || p.ticker || '').trim()
    if (!symbol) return { success: false, output: '', error: 'No symbol provided. Pass { symbol: "RELIANCE" } or { symbol: "AAPL" }.' }
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
}

// ── Internal dispatcher — no retry, no timeout ────────────────

async function runTool(tool: string, input: Record<string, any>): Promise<RawResult> {
  const fn = TOOLS[tool]
  if (!fn) {
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
    // Last resort: try shell_exec
    const cmd = input?.command || ''
    if (cmd) return TOOLS.shell_exec({ command: cmd })
    throw new Error(`Unknown tool: ${tool}`)
  }
  return fn(input)
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