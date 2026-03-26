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

  web_search: async (p: any) => {
    const query = p.query || p.command || p.topic || ''
    if (!query) return { success: false, output: '', error: 'No query provided' }
    console.log(`[web_search] Searching: "${query}"`)

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

  // 3-pass deep research: broad → latest → comparison (no LLM entity extraction)
  deep_research: async (p: any) => {
    const topic = p.topic || p.query || p.command || ''
    if (!topic) return { success: false, output: '', error: 'No topic provided' }

    const results: string[] = []

    // PASS 1: Broad search on topic
    console.log(`[deep_research] Pass 1: broad — "${topic}"`)
    try {
      const broad = await (TOOLS as any).web_search({ query: topic })
      if (broad.success && broad.output.length > 100) {
        results.push(`=== PASS 1: BROAD RESEARCH ===\n${broad.output}`)
      }
    } catch (e: any) {
      console.warn(`[deep_research] Pass 1 failed: ${e.message}`)
    }

    // PASS 2: Year-specific search for latest info
    const latestQuery = `${topic} 2025 latest`
    console.log(`[deep_research] Pass 2: latest — "${latestQuery}"`)
    try {
      const latest = await (TOOLS as any).web_search({ query: latestQuery })
      if (latest.success && latest.output.length > 100) {
        results.push(`=== PASS 2: LATEST (2025) ===\n${latest.output}`)
      }
    } catch (e: any) {
      console.warn(`[deep_research] Pass 2 failed: ${e.message}`)
    }

    // PASS 3: Comparison/review angle
    const compareQuery = `best top ${topic} comparison review`
    console.log(`[deep_research] Pass 3: comparison — "${compareQuery}"`)
    try {
      const compare = await (TOOLS as any).web_search({ query: compareQuery })
      if (compare.success && compare.output.length > 100) {
        results.push(`=== PASS 3: COMPARISON & REVIEWS ===\n${compare.output}`)
      }
    } catch (e: any) {
      console.warn(`[deep_research] Pass 3 failed: ${e.message}`)
    }

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
    return { success: false, output: '', error: `Tool ${type} threw: ${err.message}` }
  }
}