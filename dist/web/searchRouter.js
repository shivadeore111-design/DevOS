"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRouter = exports.SearchRouter = void 0;
// web/searchRouter.ts — Tries multiple search strategies in priority order
const searchEngine_1 = require("./searchEngine");
const browserFetcher_1 = require("./browserFetcher");
const llmExtractor_1 = require("./llmExtractor");
const ollama_1 = require("../llm/ollama");
class SearchRouter {
    async search(query) {
        // ── 1. HTTP attempt via existing searchEngine ─────────────
        console.log(`[SearchRouter] Trying HTTP search...`);
        try {
            const results = await (0, searchEngine_1.webSearch)(query);
            if (results.length > 0) {
                console.log(`[SearchRouter] ✅ DuckDuckGo HTTP (${results.length} results)`);
                return { results, engine: "DuckDuckGo", method: "http" };
            }
        }
        catch (err) {
            console.log(`[SearchRouter] HTTP search failed: ${err.message}`);
        }
        // ── 2. Browser + LLM — Bing ───────────────────────────────
        console.log(`[SearchRouter] Trying Bing browser...`);
        try {
            const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
            const pageResult = await browserFetcher_1.browserFetcher.fetch(bingUrl, { timeout: 20000 });
            if (pageResult.success && pageResult.html) {
                const results = await llmExtractor_1.llmExtractor.extractSearchResults(pageResult.html, query);
                if (results.length > 0) {
                    console.log(`[SearchRouter] ✅ Bing browser (${results.length} results)`);
                    return { results, engine: "Bing", method: "browser" };
                }
            }
        }
        catch (err) {
            console.log(`[SearchRouter] Bing browser failed: ${err.message}`);
        }
        // ── 3. Browser + LLM — Google ────────────────────────────
        console.log(`[SearchRouter] Trying Google browser...`);
        try {
            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            const pageResult = await browserFetcher_1.browserFetcher.fetch(googleUrl, { timeout: 20000 });
            if (pageResult.success && pageResult.html) {
                const results = await llmExtractor_1.llmExtractor.extractSearchResults(pageResult.html, query);
                if (results.length > 0) {
                    console.log(`[SearchRouter] ✅ Google browser (${results.length} results)`);
                    return { results, engine: "Google", method: "browser" };
                }
            }
        }
        catch (err) {
            console.log(`[SearchRouter] Google browser failed: ${err.message}`);
        }
        // ── 4. LLM fallback — Ollama knowledge ───────────────────
        console.log(`[SearchRouter] Trying LLM fallback...`);
        try {
            const prompt = `You are a research assistant. List 5 real URLs and descriptions for: ${query}. ` +
                `Return JSON array of {title, url, snippet}. No other text.`;
            const raw = await (0, ollama_1.callOllama)(prompt);
            const results = this._parseFallbackResults(raw);
            if (results.length > 0) {
                console.log(`[SearchRouter] ✅ LLM fallback (${results.length} results)`);
                return { results, engine: "LLM", method: "llm" };
            }
        }
        catch (err) {
            console.log(`[SearchRouter] LLM fallback failed: ${err.message}`);
        }
        // ── Nothing worked ────────────────────────────────────────
        console.log(`[SearchRouter] ⚠️  All search methods exhausted — returning empty`);
        return { results: [], engine: "none", method: "llm" };
    }
    // ── Helpers ───────────────────────────────────────────────
    _parseFallbackResults(text) {
        try {
            const match = text.match(/\[[\s\S]*\]/);
            if (!match)
                return [];
            const parsed = JSON.parse(match[0]);
            if (!Array.isArray(parsed))
                return [];
            return parsed
                .filter((r) => r && typeof r.url === "string")
                .slice(0, 8)
                .map((r) => ({
                title: String(r.title ?? "").trim(),
                url: String(r.url ?? "").trim(),
                snippet: String(r.snippet ?? "").trim(),
            }));
        }
        catch {
            return [];
        }
    }
}
exports.SearchRouter = SearchRouter;
exports.searchRouter = new SearchRouter();
