"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.semanticMemory = exports.SemanticMemory = void 0;
// core/semanticMemory.ts — Local semantic memory with TF-IDF inspired
// word-level embeddings. No external API required — pure JS math.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bm25_1 = require("./bm25");
const MEMORY_PATH = path_1.default.join(process.cwd(), 'workspace', 'semantic.json');
class SemanticMemory {
    constructor() {
        this.data = [];
        this.bm25 = new bm25_1.BM25();
        this.bm25IndexBuilt = false;
        this.load();
    }
    // ── Persistence ───────────────────────────────────────────────
    load() {
        try {
            if (fs_1.default.existsSync(MEMORY_PATH)) {
                this.data = JSON.parse(fs_1.default.readFileSync(MEMORY_PATH, 'utf-8'));
            }
        }
        catch { }
    }
    save() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(MEMORY_PATH), { recursive: true });
            fs_1.default.writeFileSync(MEMORY_PATH, JSON.stringify(this.data, null, 2));
        }
        catch { }
    }
    // ── Embedding ─────────────────────────────────────────────────
    // TF-IDF inspired bag-of-words embedding into 128-dim space.
    // Uses polynomial rolling hash — similar topics yield similar vectors.
    embed(text) {
        const dim = 128;
        const vec = new Array(dim).fill(0);
        // Normalize and tokenize
        const words = text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2);
        // Remove stop words
        const stopWords = new Set([
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
            'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him',
            'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two',
            'way', 'who', 'did', 'let', 'put', 'say', 'she', 'too', 'use',
        ]);
        const meaningful = words.filter(w => !stopWords.has(w));
        // Hash each word into vector space using polynomial rolling hash
        for (let wi = 0; wi < meaningful.length; wi++) {
            const word = meaningful[wi];
            let h1 = 0, h2 = 0;
            for (let i = 0; i < word.length; i++) {
                const c = word.charCodeAt(i);
                h1 = (h1 * 31 + c) % dim;
                h2 = (h2 * 37 + c) % dim;
            }
            // Boost by word length — longer words carry more meaning
            const weight = Math.log(word.length + 1);
            vec[h1] += weight;
            vec[h2] += weight * 0.5;
            // Bigram context — captures phrase meaning
            if (wi > 0) {
                const prev = meaningful[wi - 1];
                let bh = 0;
                for (let i = 0; i < prev.length && i < 4; i++) {
                    bh = (bh * 41 + prev.charCodeAt(i)) % dim;
                }
                vec[(h1 + bh) % dim] += 0.3;
            }
        }
        // L2 normalize
        const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) + 1e-8;
        return vec.map(v => v / mag);
    }
    cosine(a, b) {
        let dot = 0;
        for (let i = 0; i < a.length; i++)
            dot += a[i] * b[i];
        return Math.max(0, Math.min(1, dot)); // already L2-normalized
    }
    // ── Public API ────────────────────────────────────────────────
    add(text, type = 'exchange', tags) {
        if (!text.trim() || text.length < 10)
            return;
        // Don't store duplicates
        const existing = this.data.find(d => d.text === text);
        if (existing)
            return;
        const item = {
            id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            text: text.slice(0, 500),
            embedding: this.embed(text),
            metadata: { type, timestamp: Date.now(), tags },
        };
        this.data.push(item);
        this.bm25IndexBuilt = false; // Sprint 14: invalidate BM25 index on new item
        // Keep max 500 items — remove oldest
        if (this.data.length > 500) {
            this.data = this.data
                .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)
                .slice(0, 500);
        }
        this.save();
    }
    // ── BM25 index builder ────────────────────────────────────────
    buildBM25Index() {
        const texts = this.data.map(d => d.text);
        if (texts.length > 0) {
            this.bm25.index(texts);
            this.bm25IndexBuilt = true;
        }
    }
    // ── Vector-only search ────────────────────────────────────────
    vectorSearch(query, topK) {
        const qVec = this.embed(query);
        return this.data
            .map((item, index) => ({ index, score: this.cosine(qVec, item.embedding) }))
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }
    // ── Hybrid search: BM25 + vector with reciprocal rank fusion ──
    search(query, topK = 5, minScore = 0.3) {
        if (this.data.length === 0)
            return [];
        if (!this.bm25IndexBuilt)
            this.buildBM25Index();
        const fetch = topK * 2;
        // BM25 reciprocal rank scores (weight 0.4)
        const bm25Results = this.bm25.search(query, fetch);
        const bm25Scores = new Map();
        bm25Results.forEach((r, rank) => bm25Scores.set(r.index, 1 / (rank + 1)));
        // Vector reciprocal rank scores (weight 0.6)
        const vectorResults = this.vectorSearch(query, fetch);
        const vectorScores = new Map();
        vectorResults.forEach((r, rank) => vectorScores.set(r.index, 1 / (rank + 1)));
        // Reciprocal rank fusion
        const allIndices = new Set([...bm25Scores.keys(), ...vectorScores.keys()]);
        return Array.from(allIndices)
            .map(idx => ({
            item: this.data[idx],
            score: (bm25Scores.get(idx) || 0) * 0.4 + (vectorScores.get(idx) || 0) * 0.6,
        }))
            .filter(r => r.item && r.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(r => r.item);
    }
    searchText(query, topK = 3) {
        return this.search(query, topK).map(item => item.text);
    }
    getStats() {
        const byType = {};
        this.data.forEach(d => {
            byType[d.metadata.type] = (byType[d.metadata.type] || 0) + 1;
        });
        return { total: this.data.length, byType };
    }
}
exports.SemanticMemory = SemanticMemory;
exports.semanticMemory = new SemanticMemory();
