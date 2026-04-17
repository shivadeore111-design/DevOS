// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_14.ts — 8 zero-cost audits for Prompt 14
// (MCP native toolset + Windows shell wedges).
// Run via:  npm run test:audit
// No LLM. No network. No side effects.

import path from 'path'
import fs   from 'fs'
import { test, assert, runAll, appendAuditLog } from './harness'

// ── Test 1 — McpServerConfig and McpTool are exported from mcpClient.ts ───────
test('mcp: McpServerConfig and McpTool interfaces exported from mcpClient', () => {
  const p       = path.join(process.cwd(), 'core', 'mcpClient.ts')
  const content = fs.readFileSync(p, 'utf-8')
  assert(content.includes('export interface McpServerConfig'), 'McpServerConfig must be exported')
  assert(content.includes('export interface McpTool'),         'McpTool must be exported')
  assert(/transport[\s]*:[\s]*'stdio'[\s]*\|[\s]*'http'/.test(content), "McpServerConfig must have transport field with 'stdio' | 'http'")
})

// ── Test 2 — Named function exports present in mcpClient.ts ──────────────────
test('mcp: named function exports connectMcpServer/disconnectMcpServer/listMcpServers/listMcpTools/callMcpTool', () => {
  const p       = path.join(process.cwd(), 'core', 'mcpClient.ts')
  const content = fs.readFileSync(p, 'utf-8')
  assert(content.includes('export') && content.includes('connectMcpServer'),    'connectMcpServer must be exported')
  assert(content.includes('export') && content.includes('disconnectMcpServer'), 'disconnectMcpServer must be exported')
  assert(content.includes('export') && content.includes('listMcpServers'),      'listMcpServers must be exported')
  assert(content.includes('export') && content.includes('listMcpTools'),        'listMcpTools must be exported')
  assert(content.includes('export') && content.includes('callMcpTool'),         'callMcpTool must be exported')
})

// ── Test 3 — mcpClient.ts uses JSON-RPC 2.0 methods ─────────────────────────
test('mcp: mcpClient.ts contains JSON-RPC initialize, tools/list, tools/call', () => {
  const p       = path.join(process.cwd(), 'core', 'mcpClient.ts')
  const content = fs.readFileSync(p, 'utf-8')
  assert(content.includes('initialize'),   'must have JSON-RPC initialize call')
  assert(content.includes('tools/list'),   'must have JSON-RPC tools/list call')
  assert(content.includes('tools/call'),   'must have JSON-RPC tools/call call')
})

// ── Test 4 — workspace/config/mcp.json template exists ───────────────────────
test('mcp: workspace/config/mcp.json template exists with servers array', () => {
  const p = path.join(process.cwd(), 'workspace', 'config', 'mcp.json')
  assert(fs.existsSync(p), 'workspace/config/mcp.json must exist')
  const raw = fs.readFileSync(p, 'utf-8')
  const obj = JSON.parse(raw)
  assert(Array.isArray(obj.servers), 'mcp.json must have a "servers" array')
})

// ── Test 5 — toolRegistry.ts has cmd, ps, wsl tools ─────────────────────────
test('shell-wedges: cmd/ps/wsl registered in toolRegistry.ts TOOLS and TOOL_DESCRIPTIONS', () => {
  const p       = path.join(process.cwd(), 'core', 'toolRegistry.ts')
  const content = fs.readFileSync(p, 'utf-8')
  assert(content.includes("cmd:") && content.includes('cmd.exe'),              'cmd tool must spawn cmd.exe')
  assert(content.includes("ps:")  && content.includes('powershell.exe -NoProfile'), 'ps tool must use powershell.exe -NoProfile')
  assert(content.includes("wsl:") && content.includes('wsl'),                  'wsl tool must be present')
  assert(content.includes("cmd:") && content.includes('isCommandAllowed'),     'cmd must call isCommandAllowed')
  assert(content.includes("ps:")  && content.includes('isCommandAllowed'),     'ps must call isCommandAllowed')
  assert(content.includes("wsl:") && content.includes('isCommandAllowed'),     'wsl must call isCommandAllowed')
})

// ── Test 6 — toolRegistry.ts has colon-prefix MCP routing ───────────────────
test('mcp: toolRegistry.ts routes colon-prefix tool names to callMcpTool', () => {
  const p       = path.join(process.cwd(), 'core', 'toolRegistry.ts')
  const content = fs.readFileSync(p, 'utf-8')
  assert(content.includes("tool.includes(':')"), 'runTool must branch on colon-prefix tool names')
  assert(content.includes('callMcpTool'),        'runTool must call callMcpTool for colon-prefixed tools')
})

// ── Test 7 — aidenSdk.ts and types/aiden-sdk.d.ts extended ───────────────────
test('sdk: aidenSdk.ts has cmd/ps/wsl in shell and mcp namespace', () => {
  const sdk  = fs.readFileSync(path.join(process.cwd(), 'core', 'aidenSdk.ts'), 'utf-8')
  const dts  = fs.readFileSync(path.join(process.cwd(), 'types', 'aiden-sdk.d.ts'), 'utf-8')

  // aidenSdk.ts
  assert(sdk.includes("method: 'cmd'"),   'TOOL_SDK_MAP must include cmd')
  assert(sdk.includes("method: 'ps'"),    'TOOL_SDK_MAP must include ps')
  assert(sdk.includes("method: 'wsl'"),   'TOOL_SDK_MAP must include wsl')
  assert(sdk.includes('mcp:') && sdk.includes('listMcpServers'), 'mcp namespace must use listMcpServers')
  assert(sdk.includes('callMcpTool'),     'mcp namespace must expose callMcpTool')

  // types/aiden-sdk.d.ts
  assert(dts.includes('cmd(command'),     'AidenShell.cmd must be declared in .d.ts')
  assert(dts.includes('ps(command'),      'AidenShell.ps must be declared in .d.ts')
  assert(dts.includes('wsl(command'),     'AidenShell.wsl must be declared in .d.ts')
  assert(dts.includes('AidenMcp'),        'AidenMcp interface must be declared in .d.ts')
  assert(dts.includes('mcp:     AidenMcp'), 'AidenSDK must have mcp: AidenMcp field')
})

// ── Test 8 — cli/aiden.ts has /mcp, /cmd, /ps, /wsl commands ────────────────
test('cli: /mcp /cmd /ps /wsl registered in COMMANDS and handled in handleCommand', () => {
  const p       = path.join(process.cwd(), 'cli', 'aiden.ts')
  const content = fs.readFileSync(p, 'utf-8')
  for (const cmd of ['/mcp', '/cmd', '/ps', '/wsl']) {
    assert(content.includes(`'${cmd}'`),               `${cmd} must appear in COMMANDS array`)
    assert(content.includes(`command === '${cmd}'`),   `handleCommand must handle ${cmd}`)
  }
  // mcp handler must support subcommands
  assert(content.includes("sub === 'list'"),    '/mcp list subcommand required')
  assert(content.includes("sub === 'tools'"),   '/mcp tools subcommand required')
  assert(content.includes("sub === 'connect'"), '/mcp connect subcommand required')
  assert(content.includes("sub === 'call'"),    '/mcp call subcommand required')
})

// ── Run ───────────────────────────────────────────────────────────────────────

;(async () => {
  const results = await runAll()
  const logPath = path.join(process.cwd(), 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  process.exit(failed > 0 ? 1 : 0)
})()
