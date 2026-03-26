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

const execAsync = promisify(exec)

// ── Types ─────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean
  output:  string
  error?:  string
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

// ── Tool implementations ──────────────────────────────────────

export const TOOLS: Record<string, (payload: any) => Promise<ToolResult>> = {

  open_browser: async (p) => {
    const url = p.url || p.command || ''
    if (!url) return { success: false, output: '', error: 'No URL provided' }
    // Try Playwright first, fall back to PowerShell Start-Process
    try {
      const browser    = await getBrowser()
      const context    = await browser.newContext()
      const page       = await context.newPage()
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      const title      = await page.title()
      const currentUrl = page.url()
      return { success: true, output: `Opened: ${url} — Title: "${title}" — URL: ${currentUrl}` }
    } catch (playwrightErr: any) {
      // PowerShell fallback — opens in default Windows browser
      try {
        const safeUrl = url.replace(/'/g, '%27').replace(/"/g, '%22')
        await execAsync(
          `powershell.exe -WindowStyle Hidden -Command "Start-Process '${safeUrl}'"`,
          { timeout: 8000 },
        )
        return { success: true, output: `Opened in default browser: ${url}` }
      } catch (psErr: any) {
        return { success: false, output: '', error: `Playwright: ${playwrightErr.message} | PowerShell: ${psErr.message}` }
      }
    }
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
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        shell:   'powershell.exe',
        timeout: 30000,
        env:     { ...process.env, PATH: process.env.PATH },
      })
      return { success: true, output: (stdout || stderr || '').trim() || '(completed)' }
    } catch (e: any) { return { success: false, output: e.stdout || '', error: e.message } }
  },

  run_powershell: async (p) => {
    const script  = p.script || p.command || ''
    if (!script) return { success: false, output: '', error: 'No script' }
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
    const filePath = p.path || p.file || ''
    const content  = p.content || ''
    if (!filePath) return { success: false, output: '', error: 'No path' }
    try {
      const resolved = filePath.match(/^[A-Z]:/i)
        ? filePath
        : filePath.startsWith('~')
          ? filePath.replace('~', process.env.USERPROFILE || 'C:\\Users\\shiva')
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
      const resolved = filePath.match(/^[A-Z]:/i)
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
      const { stdout, stderr } = await execAsync(`python "${tmp}"`, { timeout: 30000 })
      return { success: true, output: (stdout || stderr || '').trim() }
    } catch (e: any) { return { success: false, output: e.stdout || '', error: e.message } }
    finally { try { fs.unlinkSync(tmp) } catch {} }
  },

  run_node: async (p) => {
    const script = p.script || p.code || p.command || ''
    if (!script) return { success: false, output: '', error: 'No script' }
    const tmp = path.join(process.cwd(), 'workspace', `js_${Date.now()}.js`)
    fs.mkdirSync(path.dirname(tmp), { recursive: true })
    fs.writeFileSync(tmp, script)
    try {
      const { stdout, stderr } = await execAsync(`node "${tmp}"`, { timeout: 30000 })
      return { success: true, output: (stdout || stderr || '').trim() }
    } catch (e: any) { return { success: false, output: e.stdout || '', error: e.message } }
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
      return { success: true, output: `Notification sent: ${msg}` }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  web_search: async (p) => {
    const query = p.query || p.command || ''
    if (!query) return { success: false, output: '', error: 'No query' }
    try {
      // 1. Weather via wttr.in JSON API
      if (/weather|temperature|forecast|rain|snow|sunny|cloudy|humidity|wind/i.test(query)) {
        const city = query
          .replace(/weather|temperature|forecast|rain|snow|sunny|cloudy|humidity|wind|in|today|current|for|the/gi, '')
          .trim() || 'auto'
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
            return { success: true, output: out.trim() }
          }
        } catch {}
      }

      // 2. Fetch real page content from top DuckDuckGo HTML results
      try {
        const searchRes = await fetch(
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(10000),
          },
        )
        const html       = await searchRes.text()
        const urlMatches = [...html.matchAll(/href="(https?:\/\/[^"&]+)"/g)]
        const urls       = urlMatches
          .map(m => m[1])
          .filter(u =>
            !u.includes('duckduckgo.com') &&
            !u.includes('google.com') &&
            !u.includes('youtube.com') &&
            !u.includes('twitter.com') &&
            !u.includes('facebook.com') &&
            u.startsWith('https'),
          )
          .filter((u, i, arr) => arr.indexOf(u) === i) // dedupe
          .slice(0, 4)

        const fetchPromises = urls.map(async (url) => {
          try {
            const r    = await fetch(url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
              signal: AbortSignal.timeout(8000),
            })
            if (!r.ok) return null
            const text  = await r.text()
            const clean = text
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
              .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
              .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
            if (clean.length < 200) return null
            return `Source: ${url}\n${clean.slice(0, 2000)}`
          } catch { return null }
        })

        const pageContents = (await Promise.all(fetchPromises)).filter(Boolean) as string[]

        if (pageContents.length) {
          return { success: true, output: pageContents.join('\n\n---\n\n').slice(0, 8000) }
        }
      } catch {}

      // 3. DuckDuckGo instant answers fallback
      const res   = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
        { signal: AbortSignal.timeout(6000) },
      )
      const data  = await res.json() as any
      const parts = [
        data.Answer,
        data.Abstract,
        ...(data.RelatedTopics || []).slice(0, 5).map((t: any) => t.Text),
      ].filter(Boolean)

      if (parts.length) return { success: true, output: parts.join('\n\n') }

      return { success: false, output: '', error: `No results for: ${query}` }
    } catch (e: any) { return { success: false, output: '', error: e.message } }
  },

  fetch_url: async (p) => {
    const url = p.url || p.command || ''
    if (!url) return { success: false, output: '', error: 'No URL' }
    try {
      const res  = await fetch(url, { signal: AbortSignal.timeout(10000) })
      const text = await res.text()
      return { success: true, output: text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000) }
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

  // 3-pass deep research: broad → entity extraction → per-entity deep dive
  deep_research: async (p) => {
    const topic = p.topic || p.query || p.command || ''
    if (!topic) return { success: false, output: '', error: 'No topic provided' }

    const results: string[] = []

    // PASS 1: Broad search
    const broad = await TOOLS.web_search({ query: topic })
    if (broad.success) results.push(`=== BROAD RESEARCH ===\n${broad.output}`)

    // Extract entity names using capitalization heuristic
    const entityPatterns = (broad.output || '').match(/\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\b/g) || []
    const SKIP_WORDS = new Set(['The','This','That','From','With','For','And','But','Source','Nov','Sep','Jan','Feb','Dec','You','Your','More','Also','Our'])
    const uniqueEntities = [...new Set(entityPatterns)]
      .filter(e => e.length > 3 && !SKIP_WORDS.has(e))
      .slice(0, 4)

    // PASS 2: Deep dive each entity — tie query to topic for relevance
    for (const entity of uniqueEntities) {
      try {
        const deep = await TOOLS.web_search({ query: `${entity} ${topic} features review 2025` })
        if (deep.success && deep.output.length > 200) {
          results.push(`=== ${entity.toUpperCase()} DEEP DIVE ===\n${deep.output.slice(0, 2000)}`)
        }
      } catch {}
    }

    // PASS 3: Check depth — if shallow, fetch one more broad query
    if (results.join('\n').length < 2000) {
      const fallback = await TOOLS.web_search({ query: `${topic} complete guide comparison 2025` })
      if (fallback.success) results.push(`=== ADDITIONAL RESEARCH ===\n${fallback.output}`)
    }

    return { success: true, output: results.join('\n\n') }
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
}

// ── Public executor ───────────────────────────────────────────

export async function executeTool(type: string, payload: any): Promise<ToolResult> {
  const fn = TOOLS[type]

  if (!fn) {
    // Last resort: run as raw shell command
    const cmd = payload?.command || ''
    if (cmd) return TOOLS.shell_exec({ command: cmd })
    return { success: false, output: '', error: `Unknown tool: ${type}` }
  }

  try {
    return await fn(payload)
  } catch (err: any) {
    return { success: false, output: '', error: err.message }
  }
}

export function listTools(): string[] {
  return Object.keys(TOOLS)
}
