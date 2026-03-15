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
exports.researchCache = exports.ResearchCache = void 0;
// research/researchCache.ts — TTL-based cache for research results
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CACHE_FILE = path.join(process.cwd(), "research", "research-cache.json");
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
class ResearchCache {
    constructor() {
        this.cache = new Map();
        this.load();
    }
    // ── Public API ────────────────────────────────────────────
    get(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return null;
        const age = Date.now() - new Date(entry.cachedAt).getTime();
        if (age > entry.ttlMs) {
            this.cache.delete(key);
            this.persist();
            return null;
        }
        return entry;
    }
    set(key, query, results, summary, ttlMs = DEFAULT_TTL_MS) {
        const entry = {
            key,
            query,
            results,
            summary,
            cachedAt: new Date().toISOString(),
            ttlMs,
        };
        this.cache.set(key, entry);
        this.persist();
    }
    invalidate(key) {
        if (this.cache.delete(key)) {
            this.persist();
        }
    }
    clear() {
        this.cache.clear();
        this.persist();
    }
    size() {
        return this.cache.size;
    }
    keys() {
        return Array.from(this.cache.keys());
    }
    // ── Persistence ───────────────────────────────────────────
    load() {
        try {
            if (!fs.existsSync(CACHE_FILE))
                return;
            const raw = fs.readFileSync(CACHE_FILE, "utf-8");
            const entries = JSON.parse(raw);
            const now = Date.now();
            for (const entry of entries) {
                const age = now - new Date(entry.cachedAt).getTime();
                if (age <= entry.ttlMs) {
                    this.cache.set(entry.key, entry);
                }
            }
            console.log(`[ResearchCache] Loaded ${this.cache.size} valid entries`);
        }
        catch {
            // Fresh start if file is missing or corrupt
        }
    }
    persist() {
        try {
            const dir = path.dirname(CACHE_FILE);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            const entries = Array.from(this.cache.values());
            fs.writeFileSync(CACHE_FILE, JSON.stringify(entries, null, 2), "utf-8");
        }
        catch (err) {
            console.error(`[ResearchCache] Persist error: ${err.message}`);
        }
    }
}
exports.ResearchCache = ResearchCache;
exports.researchCache = new ResearchCache();
