"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpClient = exports.MCPClient = void 0;
// core/mcpClient.ts — MCP (Model Context Protocol) client.
// Connects to any HTTP MCP server, discovers its tools, and
// proxies calls back through the DevOS tool executor.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const MCP_CONFIG_PATH = path_1.default.join(process.cwd(), 'config', 'mcp-servers.json');
// ── MCPClient ──────────────────────────────────────────────────
class MCPClient {
    constructor() {
        this.servers = [];
        this.toolCache = new Map();
        this.load();
    }
    // ── Server management ──────────────────────────────────────
    addServer(name, url, description = '') {
        // Upsert — replace existing entry with same name
        this.servers = this.servers.filter(s => s.name !== name);
        const server = {
            name,
            url: url.replace(/\/$/, ''), // strip trailing slash
            enabled: true,
            description,
            addedAt: Date.now(),
        };
        this.servers.push(server);
        this.save();
        console.log(`[MCP] Server added: ${name} → ${server.url}`);
        return server;
    }
    removeServer(name) {
        this.servers = this.servers.filter(s => s.name !== name);
        this.toolCache.delete(name);
        this.save();
        console.log(`[MCP] Server removed: ${name}`);
    }
    toggleServer(name, enabled) {
        const s = this.servers.find(s => s.name === name);
        if (!s)
            return false;
        s.enabled = enabled;
        if (!enabled)
            this.toolCache.delete(name);
        this.save();
        return true;
    }
    listServers() {
        return this.servers;
    }
    // ── Tool discovery ─────────────────────────────────────────
    async discoverTools(serverName) {
        const server = this.servers.find(s => s.name === serverName);
        if (!server || !server.enabled)
            return [];
        try {
            const r = await fetch(`${server.url}/tools/list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'tools/list',
                    params: {},
                }),
                signal: AbortSignal.timeout(8000),
            });
            if (!r.ok) {
                console.warn(`[MCP] discoverTools ${serverName}: HTTP ${r.status}`);
                return [];
            }
            const data = await r.json();
            const rawTools = data?.result?.tools ?? [];
            const tools = rawTools.map((t) => ({
                name: `mcp_${serverName}_${t.name}`,
                description: String(t.description || t.name),
                inputSchema: t.inputSchema ?? {},
                serverName,
            }));
            this.toolCache.set(serverName, tools);
            console.log(`[MCP] Discovered ${tools.length} tool(s) from ${serverName}`);
            return tools;
        }
        catch (e) {
            console.warn(`[MCP] discoverTools ${serverName}: ${e.message}`);
            return [];
        }
    }
    async discoverAllServers() {
        const results = await Promise.allSettled(this.servers.filter(s => s.enabled).map(s => this.discoverTools(s.name)));
        return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    }
    // ── Tool execution ─────────────────────────────────────────
    async callTool(serverName, toolName, input) {
        const server = this.servers.find(s => s.name === serverName);
        if (!server) {
            return { success: false, output: `MCP server "${serverName}" not found` };
        }
        if (!server.enabled) {
            return { success: false, output: `MCP server "${serverName}" is disabled` };
        }
        try {
            const r = await fetch(`${server.url}/tools/call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'tools/call',
                    params: { name: toolName, arguments: input },
                }),
                signal: AbortSignal.timeout(30000),
            });
            if (!r.ok) {
                return { success: false, output: `MCP call failed: HTTP ${r.status}` };
            }
            const data = await r.json();
            const content = data?.result?.content ?? [];
            const output = content
                .map((c) => (typeof c.text === 'string' ? c.text : JSON.stringify(c)))
                .join('\n')
                .trim();
            // MCP error envelope
            if (data?.error) {
                return {
                    success: false,
                    output: `MCP error ${data.error.code ?? ''}: ${data.error.message ?? JSON.stringify(data.error)}`,
                };
            }
            return { success: true, output: output || '(empty response)' };
        }
        catch (e) {
            return { success: false, output: `MCP error: ${e.message}` };
        }
    }
    // ── Cache accessors ────────────────────────────────────────
    getAllCachedTools() {
        return Array.from(this.toolCache.values()).flat();
    }
    getCachedToolsForServer(serverName) {
        return this.toolCache.get(serverName) ?? [];
    }
    // ── Persistence ────────────────────────────────────────────
    load() {
        try {
            if (!fs_1.default.existsSync(MCP_CONFIG_PATH))
                return;
            const raw = fs_1.default.readFileSync(MCP_CONFIG_PATH, 'utf-8');
            this.servers = JSON.parse(raw);
            // Kick off background tool discovery for enabled servers
            setImmediate(() => this.discoverAllServers().catch(() => { }));
        }
        catch (e) {
            console.warn(`[MCP] Failed to load config: ${e.message}`);
            this.servers = [];
        }
    }
    save() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(MCP_CONFIG_PATH), { recursive: true });
            fs_1.default.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(this.servers, null, 2));
        }
        catch (e) {
            console.warn(`[MCP] Failed to save config: ${e.message}`);
        }
    }
}
exports.MCPClient = MCPClient;
// ── Singleton ──────────────────────────────────────────────────
exports.mcpClient = new MCPClient();
