"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeStore = exports.KnowledgeStore = void 0;
// knowledge/knowledgeStore.ts — Persistent keyword-searchable knowledge base.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const STORE_FILE = path_1.default.join(process.cwd(), "knowledge", "knowledge-store.json");
function makeId() {
    return `ke_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
/** Compute a simple keyword-frequency relevance score. */
function scoreEntry(entry, keywords) {
    const haystack = [
        entry.title,
        entry.content.slice(0, 2000),
        ...entry.tags,
    ]
        .join(" ")
        .toLowerCase();
    return keywords.reduce((score, kw) => {
        const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const hits = (haystack.match(re) ?? []).length;
        return score + hits;
    }, 0);
}
class KnowledgeStore {
    constructor() {
        this.entries = new Map();
        this._load();
    }
    // ── CRUD ──────────────────────────────────────────────────
    add(entry) {
        const id = makeId();
        const now = new Date();
        const rec = {
            ...entry,
            id,
            createdAt: now,
            updatedAt: now,
            accessCount: 0,
        };
        this.entries.set(id, rec);
        this._persist();
        return id;
    }
    get(id) {
        return this.entries.get(id) ?? null;
    }
    delete(id) {
        this.entries.delete(id);
        this._persist();
    }
    recordAccess(id) {
        const e = this.entries.get(id);
        if (!e)
            return;
        e.accessCount++;
        e.updatedAt = new Date();
        this._persist();
    }
    // ── Query ─────────────────────────────────────────────────
    /**
     * Keyword search across title + content + tags.
     * Returns top `limit` entries ordered by relevance score descending.
     */
    search(query, limit = 5) {
        const keywords = query
            .toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 2);
        if (keywords.length === 0)
            return this.list().slice(0, limit);
        return Array.from(this.entries.values())
            .map(e => ({ entry: e, score: scoreEntry(e, keywords) }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(({ entry }) => entry);
    }
    /** List all entries, optionally filtered by tag. */
    list(tag) {
        const all = Array.from(this.entries.values());
        if (!tag)
            return all;
        const lower = tag.toLowerCase();
        return all.filter(e => e.tags.some(t => t.toLowerCase() === lower));
    }
    // ── Persistence ───────────────────────────────────────────
    _load() {
        try {
            if (!fs_1.default.existsSync(STORE_FILE))
                return;
            const raw = fs_1.default.readFileSync(STORE_FILE, "utf-8");
            const data = JSON.parse(raw);
            for (const e of data) {
                e.createdAt = new Date(e.createdAt);
                e.updatedAt = new Date(e.updatedAt);
                this.entries.set(e.id, e);
            }
            console.log(`[KnowledgeStore] Loaded ${this.entries.size} entries`);
        }
        catch {
            /* start fresh */
        }
    }
    _persist() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(STORE_FILE), { recursive: true });
            fs_1.default.writeFileSync(STORE_FILE, JSON.stringify(Array.from(this.entries.values()), null, 2), "utf-8");
        }
        catch (err) {
            console.warn(`[KnowledgeStore] Persist failed: ${err.message}`);
        }
    }
}
exports.KnowledgeStore = KnowledgeStore;
exports.knowledgeStore = new KnowledgeStore();
