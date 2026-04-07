"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.responseCache = exports.ResponseCache = void 0;
// core/responseCache.ts — TTL-based response cache for tool results.
// Tools with defined TTLs get their outputs cached and reused within
// the TTL window. Side-effectful tools (file_write, shell_exec, etc.)
// are explicitly excluded via NO_CACHE_TOOLS.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const CACHE_PATH = path_1.default.join(process.cwd(), 'workspace', 'cache', 'response-cache.json');
// TTL per tool type (milliseconds)
const TOOL_TTL = {
    system_info: 30 * 1000, // 30 seconds — hardware changes rarely
    get_market_data: 5 * 60 * 1000, // 5 minutes  — prices update frequently
    get_company_info: 60 * 60 * 1000, // 1 hour     — fundamentals change slowly
    get_stocks: 5 * 60 * 1000, // 5 minutes
    social_research: 30 * 60 * 1000, // 30 minutes
    web_search: 10 * 60 * 1000, // 10 minutes
    fetch_url: 15 * 60 * 1000, // 15 minutes
    fetch_page: 15 * 60 * 1000, // 15 minutes
};
// Tools that should NEVER be cached (side-effectful or time-sensitive)
const NO_CACHE_TOOLS = new Set([
    'file_write', 'file_read', 'shell_exec', 'run_python',
    'run_node', 'screenshot', 'notify', 'open_browser',
    'browser_click', 'browser_type', 'mouse_click', 'keyboard_type',
    'code_interpreter_python', 'code_interpreter_node',
]);
class ResponseCache {
    constructor() {
        this.cache = new Map();
        this.load();
        // Cleanup expired entries every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
    // ── Key hashing ───────────────────────────────────────────────
    hashKey(tool, input) {
        const str = `${tool}:${JSON.stringify(input, Object.keys(input).sort())}`;
        return crypto_1.default.createHash('md5').update(str).digest('hex');
    }
    // ── Cache read ────────────────────────────────────────────────
    get(tool, input) {
        if (NO_CACHE_TOOLS.has(tool))
            return null;
        const key = this.hashKey(tool, input);
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        entry.hitCount++;
        console.log(`[Cache] HIT: ${tool} (hits: ${entry.hitCount})`);
        return entry.output;
    }
    // ── Cache write ───────────────────────────────────────────────
    set(tool, input, output) {
        if (NO_CACHE_TOOLS.has(tool))
            return;
        const ttl = TOOL_TTL[tool];
        if (!ttl)
            return; // Only cache tools with a defined TTL
        const key = this.hashKey(tool, input);
        this.cache.set(key, {
            key,
            output,
            tool,
            input,
            createdAt: Date.now(),
            expiresAt: Date.now() + ttl,
            hitCount: 0,
        });
        this.save();
    }
    // ── Stats ─────────────────────────────────────────────────────
    getStats() {
        const tools = {};
        let totalHits = 0;
        for (const entry of this.cache.values()) {
            tools[entry.tool] = (tools[entry.tool] || 0) + 1;
            totalHits += entry.hitCount;
        }
        return { totalEntries: this.cache.size, totalHits, tools };
    }
    // ── Clear all ─────────────────────────────────────────────────
    clear() {
        this.cache.clear();
        this.save();
    }
    // ── Expired entry cleanup ─────────────────────────────────────
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now > entry.expiresAt)
                this.cache.delete(key);
        }
        this.save();
    }
    // ── Persistence ───────────────────────────────────────────────
    load() {
        try {
            if (!fs_1.default.existsSync(CACHE_PATH))
                return;
            const data = JSON.parse(fs_1.default.readFileSync(CACHE_PATH, 'utf-8'));
            this.cache = new Map(Object.entries(data));
            this.cleanup(); // Remove expired entries on load
        }
        catch { }
    }
    save() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(CACHE_PATH), { recursive: true });
            fs_1.default.writeFileSync(CACHE_PATH, JSON.stringify(Object.fromEntries(this.cache), null, 2));
        }
        catch { }
    }
}
exports.ResponseCache = ResponseCache;
exports.responseCache = new ResponseCache();
