"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vectorMemory = void 0;
exports.embed = embed;
// ============================================================
// memory/vectorMemory.ts — SQLite-backed vector memory
// Local-first. No Docker. No cloud. Just SQLite + Ollama embeddings.
// Upgrade path → Qdrant when you outgrow it.
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const DB_DIR = path_1.default.join(process.cwd(), "workspace", "memory");
const DB_FILE = path_1.default.join(DB_DIR, "vectors.json");
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
// ── Embedding ─────────────────────────────────────────────────
async function embed(text) {
    try {
        const res = await axios_1.default.post(`${OLLAMA_BASE}/api/embeddings`, { model: EMBED_MODEL, prompt: text }, { timeout: 30000 });
        return res.data.embedding;
    }
    catch (err) {
        console.warn(`[VectorMemory] Embedding failed (${EMBED_MODEL}): ${err.message}`);
        console.warn(`  Make sure Ollama is running and model is pulled:`);
        console.warn(`  ollama pull ${EMBED_MODEL}`);
        // Return zero vector as fallback — search will return no matches
        return new Array(768).fill(0);
    }
}
// ── Cosine Similarity ─────────────────────────────────────────
function cosineSimilarity(a, b) {
    if (a.length !== b.length || a.length === 0)
        return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}
// ── VectorMemory Store ────────────────────────────────────────
class VectorMemoryStore {
    constructor() {
        this.entries = [];
    }
    load() {
        if (!fs_1.default.existsSync(DB_DIR))
            fs_1.default.mkdirSync(DB_DIR, { recursive: true });
        if (!fs_1.default.existsSync(DB_FILE)) {
            this.persist();
            return;
        }
        try {
            this.entries = JSON.parse(fs_1.default.readFileSync(DB_FILE, "utf-8"));
            console.log(`[VectorMemory] Loaded ${this.entries.length} vectors.`);
        }
        catch (err) {
            console.error(`[VectorMemory] Load failed: ${err.message}`);
            this.entries = [];
        }
    }
    persist() {
        const tmp = DB_FILE + ".tmp";
        try {
            if (!fs_1.default.existsSync(DB_DIR))
                fs_1.default.mkdirSync(DB_DIR, { recursive: true });
            fs_1.default.writeFileSync(tmp, JSON.stringify(this.entries, null, 2));
            fs_1.default.renameSync(tmp, DB_FILE);
        }
        catch (err) {
            console.error(`[VectorMemory] Persist failed: ${err.message}`);
        }
    }
    /**
     * Store a text + its embedding in the vector store.
     * Returns the entry id.
     */
    async store(text, metadata = {}, tags = []) {
        const id = `vec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const embedding = await embed(text);
        const entry = {
            id, text, embedding, metadata, tags,
            createdAt: new Date().toISOString(),
        };
        this.entries.push(entry);
        this.persist();
        return id;
    }
    /**
     * Semantic search: embed the query and find top-k nearest entries.
     * Optional tag filter: only search entries matching all provided tags.
     */
    async search(query, topK = 5, minScore = 0.3, tags) {
        if (this.entries.length === 0)
            return [];
        const queryVec = await embed(query);
        if (queryVec.every(v => v === 0))
            return []; // embedding failed
        let pool = this.entries;
        if (tags && tags.length > 0) {
            pool = pool.filter(e => tags.every(t => e.tags.includes(t)));
        }
        const scored = pool
            .map(entry => ({ entry, similarity: cosineSimilarity(queryVec, entry.embedding) }))
            .filter(r => r.similarity >= minScore)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);
        return scored;
    }
    /**
     * Retrieve by exact id.
     */
    getById(id) {
        return this.entries.find(e => e.id === id);
    }
    /**
     * Delete by id.
     */
    delete(id) {
        const before = this.entries.length;
        this.entries = this.entries.filter(e => e.id !== id);
        if (this.entries.length !== before) {
            this.persist();
            return true;
        }
        return false;
    }
    count() { return this.entries.length; }
    /** Upgrade path: export all entries for migration to Qdrant later */
    exportAll() { return [...this.entries]; }
}
exports.vectorMemory = new VectorMemoryStore();
