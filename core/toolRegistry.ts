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
    try {
      const browser  = await getBrowser()
      const context  = await browser.newContext()
      const page     = await context.newPage()
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      const title = await page.title()
      return { success: true, output: `Opened: ${url} — Page title: "${title}"` }
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
      // 1. DuckDuckGo instant answers
      const res  = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
        { signal: AbortSignal.timeout(8000) }
      )
      const data = await res.json() as any
      const parts = [
        data.Answer,
        data.Abstract,
        ...(data.RelatedTopics || []).slice(0, 3).map((t: any) => t.Text),
      ].filter(Boolean)

      // 2. Weather fallback
      if (!parts.length && /weather/i.test(query)) {
        const city = query.replace(/weather|in|today|current|forecast/gi, '').trim()
        const wr   = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=4`, { signal: AbortSignal.timeout(6000) })
        const wt   = await wr.text()
        if (wt && !wt.includes('Unknown')) return { success: true, output: wt }
      }

      // 3. Wikipedia fallback
      if (!parts.length) {
        try {
          const searchTerm = query.split(' ').slice(0, 4).join(' ')
          const wr = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`,
            { signal: AbortSignal.timeout(6000) }
          )
          const wd = await wr.json() as any
          if (wd.extract) return { success: true, output: wd.extract.slice(0, 600) }
        } catch {}
      }

      // Also open browser to DuckDuckGo in background
      try {
        const browser  = await getBrowser()
        const context  = await browser.newContext()
        const page     = await context.newPage()
        await page.goto(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, { timeout: 10000 })
      } catch {}

      return { success: true, output: parts.join('\n\n') || `Searched: ${query}` }
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
