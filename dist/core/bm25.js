"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.BM25 = void 0;
// core/bm25.ts — Lightweight BM25 ranking. No external dependencies.
// Okapi BM25 with k1=1.5, b=0.75 (standard defaults).
class BM25 {
    constructor() {
        this.k1 = 1.5;
        this.b = 0.75;
        this.corpus = [];
        this.idf = new Map();
        this.avgDocLength = 0;
    }
    // ── Index ───────────────────────────────────────────────────
    index(documents) {
        this.corpus = documents;
        const N = documents.length;
        if (N === 0)
            return;
        const df = new Map();
        let totalLength = 0;
        for (const doc of documents) {
            totalLength += doc.split(/\s+/).length;
            const terms = new Set(doc.toLowerCase().split(/\W+/).filter(Boolean));
            for (const term of terms) {
                df.set(term, (df.get(term) || 0) + 1);
            }
        }
        this.avgDocLength = totalLength / N;
        this.idf.clear();
        for (const [term, freq] of df) {
            // Robertson-Walker IDF with +1 smoothing
            this.idf.set(term, Math.log((N - freq + 0.5) / (freq + 0.5) + 1));
        }
    }
    // ── Search ──────────────────────────────────────────────────
    search(query, topK = 5) {
        if (this.corpus.length === 0)
            return [];
        const queryTerms = query.toLowerCase().split(/\W+/).filter(Boolean);
        const scores = new Array(this.corpus.length).fill(0);
        for (const term of queryTerms) {
            const idf = this.idf.get(term);
            if (!idf)
                continue;
            for (let i = 0; i < this.corpus.length; i++) {
                const docTerms = this.corpus[i].toLowerCase().split(/\W+/).filter(Boolean);
                const tf = docTerms.filter(t => t === term).length;
                if (tf === 0)
                    continue;
                const docLength = docTerms.length;
                const numerator = tf * (this.k1 + 1);
                const denominator = tf + this.k1 * (1 - this.b + this.b * docLength / this.avgDocLength);
                scores[i] += idf * (numerator / denominator);
            }
        }
        return scores
            .map((score, index) => ({ index, score }))
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }
}
exports.BM25 = BM25;
