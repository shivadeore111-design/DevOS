// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/mcpClient.ts — MCP (Model Context Protocol) client.
// Connects to any HTTP MCP server, discovers its tools, and
// proxies calls back through the DevOS tool executor.

import fs   from 'fs'
import path from 'path'

const MCP_CONFIG_PATH = path.join(process.cwd(), 'config', 'mcp-servers.json')

// ── Types ──────────────────────────────────────────────────────

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

// ── MCPClient ──────────────────────────────────────────────────

export class MCPClient {
  private servers:    MCPServer[]              = []
  private toolCache:  Map<string, MCPTool[]>   = new Map()

  constructor() {
    this.load()
  }

  // ── Server management ──────────────────────────────────────

  addServer(name: string, url: string, description = ''): MCPServer {
    // Upsert — replace existing entry with same name
    this.servers = this.servers.filter(s => s.name !== name)
    const server: MCPServer = {
      name,
      url:         url.replace(/\/$/, ''),   // strip trailing slash
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
        body:    JSON.stringify({
          jsonrpc: '2.0',
          id:      1,
          method:  'tools/list',
          params:  {},
        }),
        signal: AbortSignal.timeout(8000),
      })

      if (!r.ok) {
        console.warn(`[MCP] discoverTools ${serverName}: HTTP ${r.status}`)
        return []
      }

      const data = await r.json() as any
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
    if (!server) {
      return { success: false, output: `MCP server "${serverName}" not found` }
    }
    if (!server.enabled) {
      return { success: false, output: `MCP server "${serverName}" is disabled` }
    }

    try {
      const r = await fetch(`${server.url}/tools/call`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          jsonrpc: '2.0',
          id:      1,
          method:  'tools/call',
          params:  { name: toolName, arguments: input },
        }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!r.ok) {
        return { success: false, output: `MCP call failed: HTTP ${r.status}` }
      }

      const data    = await r.json() as any
      const content: any[] = data?.result?.content ?? []
      const output  = content
        .map((c: any) => (typeof c.text === 'string' ? c.text : JSON.stringify(c)))
        .join('\n')
        .trim()

      // MCP error envelope
      if (data?.error) {
        return {
          success: false,
          output:  `MCP error ${data.error.code ?? ''}: ${data.error.message ?? JSON.stringify(data.error)}`,
        }
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
      if (!fs.existsSync(MCP_CONFIG_PATH)) return
      const raw     = fs.readFileSync(MCP_CONFIG_PATH, 'utf-8')
      this.servers  = JSON.parse(raw) as MCPServer[]
      // Kick off background tool discovery for enabled servers
      setImmediate(() => this.discoverAllServers().catch(() => {}))
    } catch (e: any) {
      console.warn(`[MCP] Failed to load config: ${e.message}`)
      this.servers = []
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(MCP_CONFIG_PATH), { recursive: true })
      fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(this.servers, null, 2))
    } catch (e: any) {
      console.warn(`[MCP] Failed to save config: ${e.message}`)
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────
export const mcpClient = new MCPClient()
