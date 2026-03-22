// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// integrations/pluginBus.ts — MCP server registry + JSON-RPC stdio bridge

import * as fs           from 'fs'
import * as path         from 'path'
import * as child_process from 'child_process'

// ── Types ──────────────────────────────────────────────────────

export interface PluginTool {
  name:        string
  description: string
  inputSchema: any
}

export interface Plugin {
  name:        string
  command:     string
  args:        string[]
  env?:        Record<string, string>
  description: string
  tools:       PluginTool[]
}

interface ProcessCache {
  proc:      child_process.ChildProcess
  expiresAt: number
}

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id:      number
  method:  string
  params?: any
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id:      number
  result?: any
  error?:  { code: number; message: string; data?: any }
}

// ── Constants ──────────────────────────────────────────────────

const PLUGINS_FILE    = path.join(process.cwd(), 'config', 'plugins.json')
const TOOLS_MD        = path.join(process.cwd(), 'context', 'bootstrap', 'TOOLS.md')
const PROCESS_TTL_MS  = 60_000   // keep plugin process alive 60 s after last call
const RPC_TIMEOUT_MS  = 15_000   // max wait for a JSON-RPC response

// ── Class ──────────────────────────────────────────────────────

class PluginBus {

  private plugins:  Map<string, Plugin>         = new Map()
  private procs:    Map<string, ProcessCache>   = new Map()
  private rpcId     = 1

  constructor() {
    this._load()
    // Reap stale cached processes every 30 s
    setInterval(() => this._reapProcs(), 30_000).unref()
  }

  // ── Registry ──────────────────────────────────────────────

  register(plugin: Plugin): void {
    this.plugins.set(plugin.name, plugin)
    this._save()
    console.log(`[PluginBus] 🔌 Registered plugin: ${plugin.name} (${plugin.tools.length} tools)`)
  }

  unregister(name: string): void {
    this._killProc(name)
    this.plugins.delete(name)
    this._save()
    console.log(`[PluginBus] 🗑️  Unregistered plugin: ${name}`)
  }

  listPlugins(): Plugin[] {
    return [...this.plugins.values()]
  }

  listTools(): PluginTool[] {
    return [...this.plugins.values()].flatMap(p => p.tools)
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name)
  }

  // ── Tool discovery ────────────────────────────────────────

  /**
   * Start the plugin process, call `tools/list`, return the definitions.
   * Automatically persists the discovered tools back to config/plugins.json
   * and appends a `plugin_call` entry to context/bootstrap/TOOLS.md.
   */
  async discoverTools(name: string): Promise<PluginTool[]> {
    const plugin = this.plugins.get(name)
    if (!plugin) throw new Error(`[PluginBus] Plugin not found: ${name}`)

    console.log(`[PluginBus] 🔍 Discovering tools for: ${name}`)

    // Initialize the plugin (MCP initialize handshake)
    await this._rpc(name, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities:    {},
      clientInfo:      { name: 'DevOS', version: '2.0' },
    })

    // List tools
    const resp = await this._rpc(name, 'tools/list', {})
    const rawTools: any[] = resp?.tools ?? []

    const tools: PluginTool[] = rawTools.map((t: any) => ({
      name:        t.name,
      description: t.description ?? '',
      inputSchema: t.inputSchema ?? {},
    }))

    // Persist discovered tools into plugin config
    plugin.tools = tools
    this.plugins.set(name, plugin)
    this._save()

    // Append to TOOLS.md
    this._appendToToolsMd(name, tools)

    console.log(`[PluginBus] ✅ Discovered ${tools.length} tools for: ${name}`)
    return tools
  }

  // ── Tool call ─────────────────────────────────────────────

  /**
   * Call a tool on a plugin process via JSON-RPC over stdio.
   * The process is cached for PROCESS_TTL_MS after the last call.
   */
  async callTool(pluginName: string, toolName: string, inputs: any): Promise<any> {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) throw new Error(`[PluginBus] Plugin not found: ${pluginName}`)

    console.log(`[PluginBus] ▶  ${pluginName}/${toolName}`)

    const resp = await this._rpc(pluginName, 'tools/call', {
      name:      toolName,
      arguments: inputs ?? {},
    })

    // MCP tools/call response: { content: [ { type: 'text', text: '...' } ] }
    if (resp?.content && Array.isArray(resp.content)) {
      const text = resp.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text as string)
        .join('\n')
      return text || resp
    }

    return resp
  }

  // ── Test ─────────────────────────────────────────────────

  /**
   * Start the plugin process, run the MCP initialize handshake,
   * and return a summary of available tools. Non-fatal — returns
   * error details if the plugin fails to start.
   */
  async testPlugin(name: string): Promise<{ ok: boolean; tools: string[]; error?: string }> {
    try {
      const tools = await this.discoverTools(name)
      return { ok: true, tools: tools.map(t => t.name) }
    } catch (err: any) {
      return { ok: false, tools: [], error: err?.message ?? String(err) }
    }
  }

  // ── Internal: JSON-RPC over stdio ─────────────────────────

  private async _rpc(pluginName: string, method: string, params: any): Promise<any> {
    const proc = await this._getOrSpawnProc(pluginName)

    return new Promise((resolve, reject) => {
      const id  = this.rpcId++
      const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params }

      let buffer = ''
      let timer: ReturnType<typeof setTimeout>

      const onData = (chunk: Buffer | string): void => {
        buffer += chunk.toString()
        // Messages are newline-delimited JSON
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const msg = JSON.parse(trimmed) as JsonRpcResponse
            if (msg.id === id) {
              clearTimeout(timer)
              proc.stdout?.off('data', onData)
              if (msg.error) {
                reject(new Error(`[PluginBus] RPC error (${msg.error.code}): ${msg.error.message}`))
              } else {
                resolve(msg.result)
              }
            }
          } catch { /* malformed line — skip */ }
        }
      }

      timer = setTimeout(() => {
        proc.stdout?.off('data', onData)
        reject(new Error(`[PluginBus] RPC timeout after ${RPC_TIMEOUT_MS}ms for ${method}`))
      }, RPC_TIMEOUT_MS)

      proc.stdout?.on('data', onData)

      // Send the request
      proc.stdin?.write(JSON.stringify(req) + '\n')
    })
  }

  private async _getOrSpawnProc(name: string): Promise<child_process.ChildProcess> {
    const cached = this.procs.get(name)
    if (cached && cached.expiresAt > Date.now() && cached.proc.exitCode === null) {
      cached.expiresAt = Date.now() + PROCESS_TTL_MS   // extend lease
      return cached.proc
    }

    const plugin = this.plugins.get(name)
    if (!plugin) throw new Error(`[PluginBus] Cannot spawn unknown plugin: ${name}`)

    const env = { ...process.env, ...(plugin.env ?? {}) }

    const proc = child_process.spawn(plugin.command, plugin.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      shell: false,
    })

    proc.stderr?.on('data', (d: Buffer) => {
      console.warn(`[PluginBus:${name}] stderr: ${d.toString().trim()}`)
    })

    proc.on('exit', (code) => {
      console.log(`[PluginBus] Plugin process exited: ${name} (code ${code})`)
      this.procs.delete(name)
    })

    this.procs.set(name, { proc, expiresAt: Date.now() + PROCESS_TTL_MS })
    console.log(`[PluginBus] 🚀 Spawned plugin: ${name} (${plugin.command} ${plugin.args.join(' ')})`)

    // Give the process a moment to start
    await new Promise(r => setTimeout(r, 300))
    return proc
  }

  private _killProc(name: string): void {
    const cached = this.procs.get(name)
    if (!cached) return
    try { cached.proc.kill() } catch { /* ignore */ }
    this.procs.delete(name)
  }

  private _reapProcs(): void {
    const now = Date.now()
    for (const [name, cache] of this.procs) {
      if (cache.expiresAt < now) {
        console.log(`[PluginBus] ♻️  Reaping stale process: ${name}`)
        this._killProc(name)
      }
    }
  }

  // ── Internal: TOOLS.md auto-update ────────────────────────

  private _appendToToolsMd(pluginName: string, tools: PluginTool[]): void {
    try {
      const schemas = tools.map(t =>
        `{ "tool": "plugin_call", "plugin": "${pluginName}", "toolName": "${t.name}", "inputs": {} }  // ${t.description.slice(0, 80)}`
      ).join('\n')

      const block = `\n\n// Plugin: ${pluginName}\n${schemas}`

      const current = fs.existsSync(TOOLS_MD)
        ? fs.readFileSync(TOOLS_MD, 'utf-8')
        : ''

      // Only append if this plugin block isn't already present
      if (!current.includes(`// Plugin: ${pluginName}`)) {
        fs.appendFileSync(TOOLS_MD, block, 'utf-8')
        console.log(`[PluginBus] 📝 Appended ${tools.length} tools to TOOLS.md`)
      }
    } catch { /* non-fatal */ }
  }

  // ── Persistence ───────────────────────────────────────────

  private _load(): void {
    try {
      if (!fs.existsSync(PLUGINS_FILE)) return
      const arr = JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf-8')) as Plugin[]
      for (const p of arr) this.plugins.set(p.name, p)
      console.log(`[PluginBus] Loaded ${this.plugins.size} plugin(s)`)
    } catch { /* start fresh */ }
  }

  private _save(): void {
    try {
      fs.mkdirSync(path.dirname(PLUGINS_FILE), { recursive: true })
      fs.writeFileSync(
        PLUGINS_FILE,
        JSON.stringify([...this.plugins.values()], null, 2),
        'utf-8',
      )
    } catch (err: any) {
      console.warn(`[PluginBus] Save failed: ${err?.message}`)
    }
  }
}

export const pluginBus = new PluginBus()
