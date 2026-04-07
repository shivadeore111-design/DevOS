"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryLayers = void 0;
// memory/memoryLayers.ts — 3-tier memory: HOT (RAM) → WARM (SQLite) → COLD (JSON)
// Stub for sandbox; full implementation on user machine (committed in Sprint 18).
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ── Persistence paths ─────────────────────────────────────────
const WORKSPACE_MEM = path.join(process.cwd(), 'workspace', 'memory');
const COLD_JSON_PATH = path.join(WORKSPACE_MEM, 'cold.json');
function _makeId() {
    return `ml_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
function _loadCold() {
    try {
        if (!fs.existsSync(COLD_JSON_PATH))
            return [];
        return JSON.parse(fs.readFileSync(COLD_JSON_PATH, 'utf-8'));
    }
    catch {
        return [];
    }
}
function _saveCold(entries) {
    try {
        fs.mkdirSync(path.dirname(COLD_JSON_PATH), { recursive: true });
        fs.writeFileSync(COLD_JSON_PATH, JSON.stringify(entries.slice(-2000), null, 2), 'utf-8');
    }
    catch { /* non-fatal */ }
}
// ── MemoryLayers ──────────────────────────────────────────────
class MemoryLayers {
    constructor() {
        this.hot = new Map();
    }
    /** Write a new entry. Always lands in HOT first. */
    write(content, tags) {
        const now = Date.now();
        const entry = {
            id: _makeId(),
            content: content.slice(0, 2000),
            tier: 'hot',
            timestamp: now,
            tags,
            accessCount: 0,
            lastAccessed: now,
        };
        this.hot.set(entry.id, entry);
        // Overflow: flush oldest to cold.json when HOT exceeds 20
        if (this.hot.size > 20) {
            const oldest = Array.from(this.hot.values())
                .sort((a, b) => a.timestamp - b.timestamp)
                .slice(0, 5);
            const cold = _loadCold();
            for (const e of oldest) {
                cold.push({ ...e, tier: 'cold' });
                this.hot.delete(e.id);
            }
            _saveCold(cold);
        }
    }
    /** Simple keyword search across HOT then COLD. */
    async read(query, maxTokens = 1000) {
        const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        const charBudget = maxTokens * 4;
        const score = (e) => {
            const hay = (e.content + ' ' + e.tags.join(' ')).toLowerCase();
            return tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
        };
        const hotResults = Array.from(this.hot.values())
            .sort((a, b) => score(b) - score(a));
        let used = 0;
        const result = [];
        for (const e of hotResults) {
            used += e.content.length;
            if (used > charBudget)
                break;
            result.push(e);
        }
        if (result.length < 3) {
            const cold = _loadCold()
                .sort((a, b) => score(b) - score(a))
                .slice(0, 10);
            for (const e of cold) {
                used += e.content.length;
                if (used > charBudget)
                    break;
                result.push(e);
            }
        }
        return result;
    }
    async getStats() {
        return { hot: this.hot.size, warm: 0, cold: _loadCold().length };
    }
    async getContextForPrompt(maxTokens = 500) {
        const entries = Array.from(this.hot.values())
            .sort((a, b) => b.lastAccessed - a.lastAccessed)
            .slice(0, 10);
        if (entries.length === 0)
            return '';
        const lines = entries.map(e => `• [${e.tags.join(',')}] ${e.content.slice(0, 200)}`);
        return `=== MEMORY CONTEXT ===\n${lines.join('\n')}\n=== END MEMORY ===`;
    }
}
exports.memoryLayers = new MemoryLayers();
