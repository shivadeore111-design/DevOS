// ============================================================
// integrations/mcp/mcpClient.ts — MCP (Model Context Protocol) client
// Connects DevOS to external MCP servers: Notion, GitHub, Linear,
// Slack, filesystem, databases, and 100+ community integrations.
// ============================================================

import * as fs   from 'fs'
import * as path from 'path'

// Use require() for CJS compat — SDK ships dist/cjs.
// Direct CJS paths bypass moduleResolution subpath-exports restriction.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client }               = require('@modelcontextprotocol/sdk/dist/cjs/client/index.js') as any
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/dist/cjs/client/stdio.js') as any

export interface MCPServerConfig {
  name:    string
  command: string
  args:    string[]
  env?:    Record<string, string>
  enabled: boolean
}

export interface MCPTool {
  name:        string
  description: string
  server:      string
  inputSchema: any
}

const CONFIG_PATH = path.join(process.cwd(), 'config', 'mcp-servers.json')

class MCPClient {
  private clients: Map<string, any> = new Map()
  private tools:   Map<string, MCPTool>                    = new Map()
  private configs: MCPServerConfig[]                       = []

  loadConfig(): void {
    if (!fs.existsSync(CONFIG_PATH)) {
      const defaults: MCPServerConfig[] = [
        {
          name:    'filesystem',
          command: 'npx',
          args:    ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
          enabled: false,
        },
        {
          name:    'github',
          command: 'npx',
          args:    ['-y', '@modelcontextprotocol/server-github'],
          env:     { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
          enabled: false,
        },
      ]
      fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2))
      this.configs = defaults
    } else {
      this.configs = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    }
  }

  async connectAll(): Promise<void> {
    this.loadConfig()
    const enabled = this.configs.filter(c => c.enabled)
    console.log(`[MCP] Connecting to ${enabled.length} server(s)...`)

    for (const config of enabled) {
      try {
        await this.connect(config)
      } catch (err: any) {
        console.warn(`[MCP] Failed to connect to ${config.name}: ${err?.message}`)
      }
    }
  }

  async connect(config: MCPServerConfig): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args:    config.args,
      env:     config.env,
    })

    const client = new Client(
      { name: 'devos', version: '0.4.0' },
      { capabilities: {} }
    )
    await client.connect(transport)

    const { tools } = await client.listTools()
    for (const tool of tools) {
      this.tools.set(`${config.name}__${tool.name}`, {
        name:        tool.name,
        description: tool.description || '',
        server:      config.name,
        inputSchema: tool.inputSchema,
      })
    }

    this.clients.set(config.name, client)
    console.log(`[MCP] Connected: ${config.name} (${tools.length} tools)`)
  }

  async callTool(
    serverName: string,
    toolName:   string,
    args:       Record<string, any>,
  ): Promise<string> {
    const client = this.clients.get(serverName)
    if (!client) throw new Error(`MCP server not connected: ${serverName}`)

    const result  = await client.callTool({ name: toolName, arguments: args })
    const content = result.content as any[]
    return content.map((c: any) => c.text || JSON.stringify(c)).join('\n')
  }

  getTools(): MCPTool[] {
    return Array.from(this.tools.values())
  }

  /** Build <mcp_tools> XML block for LLM prompt injection */
  buildPromptBlock(): string {
    const tools = this.getTools()
    if (!tools.length) return ''
    const lines = ['<mcp_tools>']
    for (const t of tools) {
      lines.push(`<tool server="${t.server}" name="${t.name}">${t.description}</tool>`)
    }
    lines.push('</mcp_tools>')
    return lines.join('\n')
  }

  listServers(): void {
    this.loadConfig()
    console.log('\nMCP Servers:')
    for (const c of this.configs) {
      const status = this.clients.has(c.name)
        ? '✅ connected'
        : c.enabled
        ? '⚠️  enabled but not connected'
        : '○  disabled'
      console.log(`  ${c.name.padEnd(15)} ${status}`)
    }
    console.log(`\n${this.clients.size} connected, ${this.getTools().length} tools available\n`)
  }
}

export const mcpClient = new MCPClient()
