# Using Aiden as an MCP Server

Aiden exposes 80+ tools via the [Model Context Protocol](https://modelcontextprotocol.io).
Connect from Claude Desktop, Cursor, VS Code, or any MCP client.

## Quick start

```bash
# Test the MCP server directly
node dist-bundle/cli.js mcp

# Inspect which tools are exposed
node dist-bundle/cli.js mcp inspect
```

---

## Client setup

### Claude Desktop

Add to `claude_desktop_config.json` (Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "aiden": {
      "command": "node",
      "args": ["C:\\Users\\shiva\\DevOS\\dist-bundle\\cli.js", "mcp"],
      "env": {
        "GROQ_API_KEY": "your_key_here"
      }
    }
  }
}
```

### Cursor / VS Code / Claude Code

```json
{
  "mcpServers": {
    "aiden": {
      "command": "npx",
      "args": ["aiden-os", "mcp"]
    }
  }
}
```

See `claude-desktop.json`, `cursor.json`, and `vscode.json` in this folder for ready-to-use configs.

---

## Safe tools (exposed by default)

These tools are read-only or low-risk and are always available:

| Tool | Description |
|---|---|
| `web_search` | Search the web |
| `fetch_url` / `fetch_page` | Fetch URL content |
| `deep_research` | Multi-source research |
| `file_read` / `file_list` | Read files |
| `get_stocks` / `get_market_data` | Stock data |
| `get_briefing` | Morning briefing |
| `get_natural_events` | NASA EONET events |
| `get_calendar` | Calendar events |
| `system_info` | Hardware/OS info |
| `browser_extract` / `browser_screenshot` | Browser content |
| `browser_get_url` / `open_browser` | Browser navigation |
| `screenshot` / `screen_read` | Screen capture |
| `clipboard_read` | Read clipboard |
| `window_list` | List open windows |
| `lookup_skill` | Search Aiden skills |
| `read_email` | Read email |
| `git_status` | Git status |
| `voice_transcribe` | Transcribe audio |
| `respond` | Direct response |
| `manage_goals` | Goal tracking |

---

## Destructive tools (opt-in)

Set `MCP_ALLOW_DESTRUCTIVE=true` in the env block to also expose:

`shell_exec`, `run_powershell`, `cmd`, `ps`, `wsl`, `run_python`, `run_node`,
`code_interpreter_python`, `code_interpreter_node`, `file_write`,
`mouse_click`, `keyboard_type`, `browser_click`, `browser_type`,
`send_email`, `git_commit`, `git_push`, `clipboard_write`, `app_launch`,
`notify`, `voice_speak`, `watch_folder`, `run_agent`, `spawn`, `swarm`

---

## Plugin tools

Any tool registered via `workspace/plugins/*.js` (N+62 plugin system)
is automatically exposed — no allowlist required.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `MCP_ALLOW_DESTRUCTIVE` | `false` | Expose shell/write/click tools |
| `GROQ_API_KEY` | — | Required for LLM-based tools |
| `OPENROUTER_API_KEY` | — | Alternative LLM provider |
| `AIDEN_PORT` | `4200` | API server port (unused in MCP mode) |

---

## Smoke test

The SDK uses newline-delimited JSON (NDJSON). A full session requires the `initialize` → `notifications/initialized` → request handshake (MCP clients handle this automatically).

```bash
# Quick smoke test via Node.js (handles the init handshake)
node -e "
const {spawn}=require('child_process')
const s=spawn('node',['dist-bundle/cli.js','mcp'],{stdio:['pipe','pipe','inherit']})
const send=o=>s.stdin.write(JSON.stringify(o)+'\n')
let buf=''
s.stdout.on('data',d=>{buf+=d;const lines=buf.split('\n');buf=lines.pop();lines.forEach(l=>{try{const o=JSON.parse(l);if(o.result?.tools)console.log('tools:',o.result.tools.length)}catch{}})})
setTimeout(()=>send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'test',version:'1'}}}),300)
setTimeout(()=>send({jsonrpc:'2.0',method:'notifications/initialized',params:{}}),600)
setTimeout(()=>send({jsonrpc:'2.0',id:2,method:'tools/list',params:{}}),900)
setTimeout(()=>{s.kill();process.exit(0)},3000)
"

# With destructive tools enabled
MCP_ALLOW_DESTRUCTIVE=true node dist-bundle/cli.js mcp
```
