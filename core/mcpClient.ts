// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/mcpClient.ts — MCP (Model Context Protocol) client.
// Supports both stdio and HTTP MCP servers using JSON-RPC 2.0.
// Protocol version: 2024-11-05 (MCP spec 1.x)
//
// JSON-RPC methods used:
//   "initialize"  — capability handshake on connect
//   "tools/list"  — discover available tools
//   "tools/call"  — invoke a tool with arguments

import fs            from 'fs'
import path          from 'path'
import { spawn }     from 'child_process'
import type { ChildProcess } from 'child_process'
import { VERSION }   from './version'

// ── Paths ──────────────────────────────────────────────────────

const LEGACY_CONFIG_PATH = path.join(process.cwd(), 'config', 'mcp-servers.json')
const MCP_CONFIG_PATH    = path.join(process.cwd(), 'workspace', 'config', 'mcp.json')

// ── Legacy types (backward compat) ────────────────────────────

export interface MCPServer {
  name:        string
  url:         string
  enabled:     boolean
  description: string
  addedAt:     number
}

export interface MCPTool {
  name:        string        // "mcp_<serverName>_<toolName>"
  description: string
  inputSchema: Record<string, any>
  serverName:  string
}

// ── New typed interfaces (Phase 1) ────────────────────────────

export interface McpServerConfig {
  name:       string
  transport:  'stdio' | 'http'
  command?:   string    // stdio: 'npx -y @some/mcp-server'
  args?:      string[]
  url?:       string    // http: 'http://localhost:3500/mcp'
  env?:       Record<string, string>
}

export interface McpTool {
  name:         string   // prefixed: 'github:list_issues'
  description:  string
  inputSchema:  any
  serverName:   string
  originalName: string
}

// ── Stdio connection state ─────────────────────────────────────

interface StdioConn {
  proc:         ChildProcess
  buffer:       string
  pending:      Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>
  nextId:       number
  config:       McpServerConfig
  retryCount:   number
  retryTimer?:  ReturnType<typeof setTimeout>
}

// ── McpManager — new native client (Phase 1) ──────────────────

class McpManager {
  private configs:    Map<string, McpServerConfig> = new Map()
  private stdioConns: Map<string, StdioConn>       = new Map()
  private toolCache:  Map<string, McpTool[]>        = new Map()

  // ── Connect ──────────────────────────────────────────────

  async connect(config: McpServerConfig): Promise<void> {
    this.configs.set(config.name, config)
    if (config.transport === 'stdio') {
      await this._connectStdio(config)
    } else {
      await this._connectHttp(config)
    }
  }

  // ── Disconnect ───────────────────────────────────────────

  async disconnect(serverName: string): Promise<void> {
    const conn = this.stdioConns.get(serverName)
    if (conn) {
      if (conn.retryTimer) clearTimeout(conn.retryTimer)
      conn.proc.kill()
      this.stdioConns.delete(serverName)
    }
    this.toolCache.delete(serverName)
    console.log(`[McpManager] Disconnected: ${serverName}`)
  }

  // ── List ─────────────────────────────────────────────────

  servers(): string[] {
    return Array.from(this.configs.keys())
  }

  tools(): McpTool[] {
    return Array.from(this.toolCache.values()).flat()
  }

  // ── Call tool ────────────────────────────────────────────

  async call(toolName: string, args: any): Promise<any> {
    // toolName format: 'serverName:originalName'
    const colonIdx   = toolName.indexOf(':')
    if (colonIdx === -1) throw new Error(`Invalid MCP tool name: "${toolName}" (expected "server:tool")`)
    const serverName = toolName.slice(0, colonIdx)
    const origName   = toolName.slice(colonIdx + 1)

    const config = this.configs.get(serverName)
    if (!config) throw new Error(`MCP server not configured: "${serverName}"`)

    if (config.transport === 'stdio') {
      return this._callStdio(serverName, origName, args)
    } else {
      return this._callHttp(config, origName, args)
    }
  }

  // ── Load workspace/config/mcp.json ───────────────────────

  async loadConfig(): Promise<void> {
    try {
      if (!fs.existsSync(MCP_CONFIG_PATH)) return
      const raw  = JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, 'utf-8'))
      const servers: McpServerConfig[] = raw.servers ?? []
      for (const srv of servers) {
        try {
          // Expand $ENV_VAR references in env values
          const env: Record<string, string> = {}
          for (const [k, v] of Object.entries(srv.env ?? {})) {
            env[k] = (v as string).startsWith('$')
              ? (process.env[(v as string).slice(1)] ?? '')
              : (v as string)
          }
          await this.connect({ ...srv, env })
          console.log(`[McpManager] Connected server from config: ${srv.name}`)
        } catch (e: any) {
          console.warn(`[McpManager] Failed to connect "${srv.name}": ${e.message}`)
        }
      }
    } catch (e: any) {
      if (!String(e.message).includes('ENOENT')) {
        console.warn(`[McpManager] Failed to load config: ${e.message}`)
      }
    }
  }

  // ── Stdio transport ──────────────────────────────────────

  private async _connectStdio(config: McpServerConfig): Promise<void> {
    const [cmd, ...rest] = (config.command ?? 'npx').split(' ')
    const args           = [...rest, ...(config.args ?? [])]
    const env            = { ...process.env, ...(config.env ?? {}) }

    const proc = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      shell: false,
    })

    const conn: StdioConn = {
      proc,
      buffer:    '',
      pending:   new Map(),
      nextId:    1,
      config,
      retryCount: 0,
    }

    this.stdioConns.set(config.name, conn)

    proc.stdout!.on('data', (chunk: Buffer) => {
      conn.buffer += chunk.toString()
      // Process newline-delimited JSON messages
      const lines = conn.buffer.split('\n')
      conn.buffer  = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const msg = JSON.parse(trimmed)
          if (msg.id != null && conn.pending.has(msg.id)) {
            const { resolve, reject } = conn.pending.get(msg.id)!
            conn.pending.delete(msg.id)
            if (msg.error) reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`))
            else resolve(msg.result)
          }
        } catch {}
      }
    })

    proc.on('exit', () => {
      this._scheduleReconnect(config, conn)
    })

    proc.stderr!.on('data', (chunk: Buffer) => {
      // Suppress stderr noise — MCP servers write startup logs here
    })

    // Handshake: send "initialize"
    try {
      await this._rpcStdio(conn, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities:    {},
        clientInfo:      { name: 'aiden', version: VERSION },
      })
      // Discover tools
      const result = await this._rpcStdio(conn, 'tools/list', {})
      const raw: any[] = result?.tools ?? []
      const tools: McpTool[] = raw.map((t: any) => ({
        name:         `${config.name}:${t.name}`,
        description:  String(t.description || t.name),
        inputSchema:  t.inputSchema ?? {},
        serverName:   config.name,
        originalName: t.name,
      }))
      this.toolCache.set(config.name, tools)
      conn.retryCount = 0
      console.log(`[McpManager] stdio/${config.name}: ${tools.length} tool(s) discovered`)
    } catch (e: any) {
      console.warn(`[McpManager] stdio/${config.name} handshake failed: ${e.message}`)
    }
  }

  private async _rpcStdio(conn: StdioConn, method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id  = conn.nextId++
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
      conn.pending.set(id, { resolve, reject })
      const timer = setTimeout(() => {
        conn.pending.delete(id)
        reject(new Error(`RPC timeout: ${method}`))
      }, 15_000)
      conn.proc.stdin!.write(msg, () => clearTimeout(timer))
    })
  }

  private async _callStdio(serverName: string, toolName: string, args: any): Promise<any> {
    const conn = this.stdioConns.get(serverName)
    if (!conn) throw new Error(`MCP server "${serverName}" not connected`)
    const result = await this._rpcStdio(conn, 'tools/call', { name: toolName, arguments: args })
    const content: any[] = result?.content ?? []
    return content.map((c: any) => (typeof c.text === 'string' ? c.text : JSON.stringify(c))).join('\n')
  }

  private _scheduleReconnect(config: McpServerConfig, conn: StdioConn): void {
    if (conn.retryCount >= 5) {
      console.warn(`[McpManager] stdio/${config.name}: giving up after 5 retries`)
      return
    }
    const delayMs = Math.min(1000 * Math.pow(2, conn.retryCount), 30_000)
    conn.retryCount++
    conn.retryTimer = setTimeout(() => {
      console.log(`[McpManager] Reconnecting ${config.name} (attempt ${conn.retryCount})…`)
      this.stdioConns.delete(config.name)
      this._connectStdio(config).catch(() => {})
    }, delayMs)
  }

  // ── HTTP transport ───────────────────────────────────────

  private async _connectHttp(config: McpServerConfig): Promise<void> {
    if (!config.url) throw new Error(`HTTP MCP server "${config.name}" has no url`)
    try {
      // send "initialize"
      await this._rpcHttp(config.url, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities:    {},
        clientInfo:      { name: 'aiden', version: VERSION },
      })
      // discover tools via "tools/list"
      const result = await this._rpcHttp(config.url, 'tools/list', {})
      const raw: any[] = result?.tools ?? []
      const tools: McpTool[] = raw.map((t: any) => ({
        name:         `${config.name}:${t.name}`,
        description:  String(t.description || t.name),
        inputSchema:  t.inputSchema ?? {},
        serverName:   config.name,
        originalName: t.name,
      }))
      this.toolCache.set(config.name, tools)
      console.log(`[McpManager] http/${config.name}: ${tools.length} tool(s) discovered`)
    } catch (e: any) {
      console.warn(`[McpManager] http/${config.name} handshake failed: ${e.message}`)
    }
  }

  private async _rpcHttp(url: string, method: string, params: any): Promise<any> {
    let rpcUrl = url.replace(/\/$/, '')
    // Some servers expect /rpc; others accept POST to root
    const r = await fetch(rpcUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal:  AbortSignal.timeout(15_000),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json() as any
    if (data?.error) throw new Error(`MCP error ${data.error.code}: ${data.error.message}`)
    return data?.result
  }

  private async _callHttp(config: McpServerConfig, toolName: string, args: any): Promise<any> {
    const result = await this._rpcHttp(config.url!, 'tools/call', { name: toolName, arguments: args })
    const content: any[] = result?.content ?? []
    return content.map((c: any) => (typeof c.text === 'string' ? c.text : JSON.stringify(c))).join('\n')
  }
}

// ── Singleton McpManager ──────────────────────────────────────

const mcpManager = new McpManager()

// Load config in background on startup (no-throw)
setImmediate(() => mcpManager.loadConfig().catch(() => {}))

// ── Named function exports (Phase 1 API) ──────────────────────

export async function connectMcpServer(config: McpServerConfig): Promise<void> {
  return mcpManager.connect(config)
}

export async function disconnectMcpServer(serverName: string): Promise<void> {
  return mcpManager.disconnect(serverName)
}

export function listMcpServers(): string[] {
  return mcpManager.servers()
}

export function listMcpTools(): McpTool[] {
  return mcpManager.tools()
}

export async function callMcpTool(toolName: string, args: any): Promise<any> {
  return mcpManager.call(toolName, args)
}

// ══════════════════════════════════════════════════════════════
// Legacy MCPClient class — kept intact for backward compat
// Used by: agentLoop.ts, api/server.ts, toolRegistry.ts
// ══════════════════════════════════════════════════════════════

export class MCPClient {
  private servers:    MCPServer[]              = []
  private toolCache:  Map<string, MCPTool[]>   = new Map()

  constructor() {
    this.load()
  }

  // ── Server management ──────────────────────────────────────

  addServer(name: string, url: string, description = ''): MCPServer {
    this.servers = this.servers.filter(s => s.name !== name)
    const server: MCPServer = {
      name,
      url:         url.replace(/\/$/, ''),
      enabled:     true,
      description,
      addedAt:     Date.now(),
    }
    this.servers.push(server)
    this.save()
    console.log(`[MCP] Server added: ${name} → ${server.url}`)
    return server
  }

  removeServer(name: string): void {
    this.servers = this.servers.filter(s => s.name !== name)
    this.toolCache.delete(name)
    this.save()
    console.log(`[MCP] Server removed: ${name}`)
  }

  toggleServer(name: string, enabled: boolean): boolean {
    const s = this.servers.find(s => s.name === name)
    if (!s) return false
    s.enabled = enabled
    if (!enabled) this.toolCache.delete(name)
    this.save()
    return true
  }

  listServers(): MCPServer[] {
    return this.servers
  }

  // ── Tool discovery ─────────────────────────────────────────

  async discoverTools(serverName: string): Promise<MCPTool[]> {
    const server = this.servers.find(s => s.name === serverName)
    if (!server || !server.enabled) return []

    try {
      const r = await fetch(`${server.url}/tools/list`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
        signal:  AbortSignal.timeout(8000),
      })

      if (!r.ok) {
        console.warn(`[MCP] discoverTools ${serverName}: HTTP ${r.status}`)
        return []
      }

      const data     = await r.json() as any
      const rawTools: any[] = data?.result?.tools ?? []

      const tools: MCPTool[] = rawTools.map((t: any) => ({
        name:        `mcp_${serverName}_${t.name}`,
        description: String(t.description || t.name),
        inputSchema: t.inputSchema ?? {},
        serverName,
      }))

      this.toolCache.set(serverName, tools)
      console.log(`[MCP] Discovered ${tools.length} tool(s) from ${serverName}`)
      return tools

    } catch (e: any) {
      console.warn(`[MCP] discoverTools ${serverName}: ${e.message}`)
      return []
    }
  }

  async discoverAllServers(): Promise<MCPTool[]> {
    const results = await Promise.allSettled(
      this.servers.filter(s => s.enabled).map(s => this.discoverTools(s.name))
    )
    return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  }

  // ── Tool execution ─────────────────────────────────────────

  async callTool(
    serverName: string,
    toolName:   string,
    input:      Record<string, any>,
  ): Promise<{ success: boolean; output: string }> {

    const server = this.servers.find(s => s.name === serverName)
    if (!server) return { success: false, output: `MCP server "${serverName}" not found` }
    if (!server.enabled) return { success: false, output: `MCP server "${serverName}" is disabled` }

    try {
      const r = await fetch(`${server.url}/tools/call`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'tools/call',
          params:  { name: toolName, arguments: input },
        }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!r.ok) return { success: false, output: `MCP call failed: HTTP ${r.status}` }

      const data    = await r.json() as any
      const content: any[] = data?.result?.content ?? []
      const output  = content
        .map((c: any) => (typeof c.text === 'string' ? c.text : JSON.stringify(c)))
        .join('\n').trim()

      if (data?.error) {
        return { success: false, output: `MCP error ${data.error.code ?? ''}: ${data.error.message ?? JSON.stringify(data.error)}` }
      }

      return { success: true, output: output || '(empty response)' }

    } catch (e: any) {
      return { success: false, output: `MCP error: ${e.message}` }
    }
  }

  // ── Cache accessors ────────────────────────────────────────

  getAllCachedTools(): MCPTool[] {
    return Array.from(this.toolCache.values()).flat()
  }

  getCachedToolsForServer(serverName: string): MCPTool[] {
    return this.toolCache.get(serverName) ?? []
  }

  // ── Persistence ────────────────────────────────────────────

  private load(): void {
    try {
      const p = fs.existsSync(MCP_CONFIG_PATH) ? MCP_CONFIG_PATH : LEGACY_CONFIG_PATH
      if (!fs.existsSync(p)) return
      const raw = fs.readFileSync(p, 'utf-8')
      // Legacy format: plain array of MCPServer
      // New format: { servers: [...] }
      const parsed = JSON.parse(raw)
      this.servers = Array.isArray(parsed) ? parsed : (parsed.servers ?? [])
      setImmediate(() => this.discoverAllServers().catch(() => {}))
    } catch (e: any) {
      console.warn(`[MCP] Failed to load config: ${e.message}`)
      this.servers = []
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(LEGACY_CONFIG_PATH), { recursive: true })
      fs.writeFileSync(LEGACY_CONFIG_PATH, JSON.stringify(this.servers, null, 2))
    } catch (e: any) {
      console.warn(`[MCP] Failed to save config: ${e.message}`)
    }
  }
}

// ── Legacy singleton (backward compat) ────────────────────────
export const mcpClient = new MCPClient()
