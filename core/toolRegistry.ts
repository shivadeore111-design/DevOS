// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/toolRegistry.ts — Centralized tool registry mapping every
// capability name to an async executor function.
// Single source of truth for all DevOS tools.

import { exec }    from 'child_process'
import { promisify } from 'util'
import * as fs     from 'fs'
import * as path   from 'path'

const execAsync = promisify(exec)

// ── Tool payload / result types ───────────────────────────────

export interface ToolPayload {
  command?:  string
  cmd?:      string
  path?:     string
  file?:     string
  content?:  string
  script?:   string
  url?:      string
  query?:    string
  message?:  string
  branch?:   string
  remote?:   string
  [key: string]: any
}

export interface ToolResult {
  success: boolean
  output:  string
  error?:  string
}

type ToolFn = (payload: ToolPayload) => Promise<ToolResult>

// ── Individual tool implementations ───────────────────────────

const shell_exec: ToolFn = async (payload) => {
  const cmd = payload.command || payload.cmd || ''
  if (!cmd) return { success: false, output: '', error: 'No command provided' }
  const { stdout, stderr } = await execAsync(cmd, {
    shell:   'powershell.exe',
    timeout: 30000,
    cwd:     process.cwd(),
  })
  return { success: true, output: stdout || stderr }
}

const run_powershell: ToolFn = async (payload) => {
  const script  = payload.script || payload.command || ''
  if (!script) return { success: false, output: '', error: 'No script provided' }
  const tmpFile = path.join(process.cwd(), 'workspace', `tmp_${Date.now()}.ps1`)
  fs.mkdirSync(path.dirname(tmpFile), { recursive: true })
  fs.writeFileSync(tmpFile, script)
  const { stdout, stderr } = await execAsync(
    `powershell.exe -ExecutionPolicy Bypass -File "${tmpFile}"`,
    { timeout: 30000 },
  )
  fs.unlinkSync(tmpFile)
  return { success: true, output: stdout || stderr }
}

const file_write: ToolFn = async (payload) => {
  const filePath = payload.path || payload.file || ''
  const content  = payload.content || payload.command || ''
  if (!filePath) return { success: false, output: '', error: 'No path provided' }
  const resolved = filePath.startsWith('C:') ? filePath : path.join(process.cwd(), filePath)
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(resolved, content, 'utf-8')
  return { success: true, output: `File written: ${resolved}` }
}

const file_read: ToolFn = async (payload) => {
  const filePath = payload.path || payload.file || ''
  if (!filePath) return { success: false, output: '', error: 'No path provided' }
  const resolved = filePath.startsWith('C:') ? filePath : path.join(process.cwd(), filePath)
  const content  = fs.readFileSync(resolved, 'utf-8')
  return { success: true, output: content.slice(0, 2000) }
}

const run_python: ToolFn = async (payload) => {
  const script  = payload.script || payload.command || ''
  const tmpFile = path.join(process.cwd(), 'workspace', `tmp_${Date.now()}.py`)
  fs.mkdirSync(path.dirname(tmpFile), { recursive: true })
  fs.writeFileSync(tmpFile, script)
  const { stdout, stderr } = await execAsync(`python "${tmpFile}"`, { timeout: 30000 })
  fs.unlinkSync(tmpFile)
  return { success: true, output: stdout || stderr }
}

const run_node: ToolFn = async (payload) => {
  const script  = payload.script || payload.command || ''
  const tmpFile = path.join(process.cwd(), 'workspace', `tmp_${Date.now()}.js`)
  fs.mkdirSync(path.dirname(tmpFile), { recursive: true })
  fs.writeFileSync(tmpFile, script)
  const { stdout, stderr } = await execAsync(`node "${tmpFile}"`, { timeout: 30000 })
  fs.unlinkSync(tmpFile)
  return { success: true, output: stdout || stderr }
}

const open_browser: ToolFn = async (payload) => {
  const url = payload.url || payload.command || 'https://google.com'
  await execAsync(`Start-Process "${url}"`, { shell: 'powershell.exe' })
  return { success: true, output: `Opened: ${url}` }
}

const notify: ToolFn = async (payload) => {
  const msg = (payload.message || payload.command || '').replace(/'/g, '')
  await execAsync(
    `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${msg}', 'DevOS')`,
    { shell: 'powershell.exe' },
  )
  return { success: true, output: `Notification sent: ${msg}` }
}

const system_info: ToolFn = async () => {
  const { stdout } = await execAsync(
    'Get-ComputerInfo | Select-Object CsName, OsName, TotalPhysicalMemory | ConvertTo-Json',
    { shell: 'powershell.exe', timeout: 10000 },
  )
  return { success: true, output: stdout }
}

const web_search: ToolFn = async (payload) => {
  const query = payload.query || payload.command || ''
  await execAsync(
    `Start-Process "https://google.com/search?q=${encodeURIComponent(query)}"`,
    { shell: 'powershell.exe' },
  )
  return { success: true, output: `Searched: ${query}` }
}

const fetch_url: ToolFn = async (payload) => {
  const url = payload.url || payload.command || ''
  if (!url) return { success: false, output: '', error: 'No URL provided' }
  const res  = await fetch(url, { signal: AbortSignal.timeout(10000) })
  const text = await res.text()
  return { success: true, output: text.slice(0, 3000) }
}

const git_commit: ToolFn = async (payload) => {
  const msg = payload.message || payload.command || 'DevOS auto-commit'
  const { stdout, stderr } = await execAsync(
    `git add -A && git commit -m "${msg.replace(/"/g, "'")}"`,
    { shell: 'powershell.exe', timeout: 30000, cwd: process.cwd() },
  )
  return { success: true, output: stdout || stderr }
}

const git_push: ToolFn = async (payload) => {
  const remote = payload.remote || 'origin'
  const branch = payload.branch || 'master'
  const { stdout, stderr } = await execAsync(
    `git push ${remote} ${branch}`,
    { shell: 'powershell.exe', timeout: 60000, cwd: process.cwd() },
  )
  return { success: true, output: stdout || stderr }
}

// ── Registry ──────────────────────────────────────────────────

export const TOOLS: Record<string, ToolFn> = {
  shell_exec,
  run_powershell,
  file_write,
  file_read,
  run_python,
  run_node,
  open_browser,
  notify,
  system_info,
  web_search,
  fetch_url,
  git_commit,
  git_push,
}

// ── Public executor ───────────────────────────────────────────

/**
 * Execute a registered tool by name.
 * Throws if the tool is unknown, otherwise returns a ToolResult.
 */
export async function executeTool(
  type:    string,
  payload: ToolPayload,
): Promise<ToolResult> {
  const fn = TOOLS[type]

  if (!fn) {
    // Last-resort: try as raw shell command
    const cmd = payload.command || ''
    if (cmd) {
      try {
        const { stdout, stderr } = await execAsync(cmd, {
          shell:   'powershell.exe',
          timeout: 30000,
        })
        return { success: true, output: stdout || stderr }
      } catch (err: any) {
        return { success: false, output: '', error: err.message }
      }
    }
    return { success: false, output: '', error: `Unknown tool: ${type}` }
  }

  try {
    return await fn(payload)
  } catch (err: any) {
    return { success: false, output: '', error: err.message }
  }
}

/**
 * Return the list of all registered tool names.
 */
export function listTools(): string[] {
  return Object.keys(TOOLS)
}
