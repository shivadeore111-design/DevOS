"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeExtractor = exports.KnowledgeExtractor = void 0;
// knowledge/knowledgeExtractor.ts — Uses Ollama to pull structured knowledge
//   from a parsed document.
const ollama_1 = require("../llm/ollama");
const EXTRACT_MODEL = "qwen2.5-coder:7b";
const MAX_CONTENT = 4000; // chars sent to LLM per extraction
const FALLBACK = {
    title: "Unknown",
    summary: "",
    keyFacts: [],
    tags: [],
    relatedTopics: [],
};
class KnowledgeExtractor {
    /**
     * Extracts structured knowledge metadata from a parsed document.
     * Uses the first MAX_CONTENT chars of the document content.
     */
    async extract(document, goal) {
        const content = document.content.slice(0, MAX_CONTENT);
        const goalHint = goal ? `\nThe user is interested in: "${goal}".` : "";
        const prompt = `Extract key knowledge from this document. ` +
            `Return JSON with: title (string), summary (2-3 sentence string), ` +
            `keyFacts (array of 5 important facts), tags (array of topic tags), ` +
            `relatedTopics (array of related subjects). ` +
            `Return ONLY valid JSON, no other text.${goalHint}\n\nDocument:\n${content}`;
        try {
            const raw = await (0, ollama_1.callOllama)(prompt, undefined, EXTRACT_MODEL);
            const parsed = this._parseJson(raw);
            if (!parsed) {
                console.warn("[KnowledgeExtractor] LLM returned unparseable JSON — using fallback");
                return { ...FALLBACK, title: document.title };
            }
            return {
                title: String(parsed.title ?? document.title),
                summary: String(parsed.summary ?? ""),
                keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts.map(String) : [],
                tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
                relatedTopics: Array.isArray(parsed.relatedTopics) ? parsed.relatedTopics.map(String) : [],
            };
        }
        catch (err) {
            console.error(`[KnowledgeExtractor] Extraction failed: ${err.message}`);
            return { ...FALLBACK, title: document.title };
        }
    }
    // ── Private ───────────────────────────────────────────────
    _parseJson(text) {
        try {
            return JSON.parse(text.trim());
        }
        catch { /* fall through */ }
        const match = text.match(/\{[\s\S]*\}/);
        if (!match)
            return null;
        try {
            return JSON.parse(match[0]);
        }
        catch {
            return null;
        }
    }
}
exports.KnowledgeExtractor = KnowledgeExtractor;
exports.knowledgeExtractor = new KnowledgeExtractor();
