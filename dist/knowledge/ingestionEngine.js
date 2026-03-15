"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestionEngine = exports.IngestionEngine = void 0;
// knowledge/ingestionEngine.ts — Orchestrates the full ingest pipeline:
//   parse → extract → store → graph edges.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const documentParser_1 = require("./documentParser");
const knowledgeExtractor_1 = require("./knowledgeExtractor");
const knowledgeStore_1 = require("./knowledgeStore");
const knowledgeGraph_1 = require("./knowledgeGraph");
const pageFetcher_1 = require("../web/pageFetcher");
const SUPPORTED_EXTENSIONS = new Set([
    ".txt", ".md", ".json", ".ts", ".js", ".html", ".htm", ".csv",
]);
class IngestionEngine {
    /**
     * Full ingest pipeline for a single file.
     * Returns the new KnowledgeEntry id.
     */
    async ingest(filePath, tags = []) {
        const absPath = path_1.default.resolve(filePath);
        // 1. Parse
        const doc = await documentParser_1.documentParser.parse(absPath);
        // 2. Extract metadata via LLM (best-effort; falls back to defaults)
        let extraction = { title: doc.title, summary: "", keyFacts: [], tags: [], relatedTopics: [] };
        try {
            extraction = await knowledgeExtractor_1.knowledgeExtractor.extract(doc);
        }
        catch (err) {
            console.warn(`[IngestionEngine] Extractor failed (continuing): ${err.message}`);
        }
        // 3. Store
        const allTags = [...new Set([...tags, ...extraction.tags])];
        const entryId = knowledgeStore_1.knowledgeStore.add({
            title: extraction.title || doc.title,
            content: doc.content,
            chunks: doc.chunks,
            source: absPath,
            tags: allTags,
        });
        // 4. Add graph edges for related topics
        //    Link to any existing entries whose title appears in relatedTopics
        for (const topic of extraction.relatedTopics) {
            const related = knowledgeStore_1.knowledgeStore.search(topic, 1);
            if (related.length > 0 && related[0].id !== entryId) {
                knowledgeGraph_1.knowledgeGraph.addEdge(entryId, related[0].id, "related_to", 0.6);
            }
        }
        // 5. Log
        console.log(`[IngestionEngine] ✅ Ingested: ${extraction.title || doc.title} (${doc.chunks.length} chunks)`);
        return entryId;
    }
    /**
     * Ingest all supported files in a directory (non-recursive by default).
     * Returns array of knowledge entry ids.
     */
    async ingestDirectory(dirPath, tags = []) {
        const absDir = path_1.default.resolve(dirPath);
        if (!fs_1.default.existsSync(absDir)) {
            console.warn(`[IngestionEngine] Directory not found: ${absDir}`);
            return [];
        }
        const entries = fs_1.default.readdirSync(absDir);
        const ids = [];
        for (const entry of entries) {
            const full = path_1.default.join(absDir, entry);
            const ext = path_1.default.extname(entry).toLowerCase();
            let stat;
            try {
                stat = fs_1.default.statSync(full);
            }
            catch {
                continue;
            }
            if (stat.isFile() && SUPPORTED_EXTENSIONS.has(ext)) {
                try {
                    const id = await this.ingest(full, tags);
                    ids.push(id);
                }
                catch (err) {
                    console.warn(`[IngestionEngine] Skipping ${entry}: ${err.message}`);
                }
            }
        }
        console.log(`[IngestionEngine] Ingested ${ids.length} files from ${dirPath}`);
        return ids;
    }
    /**
     * Fetch a URL via pageFetcher, write to a temp file, ingest, then clean up.
     */
    async ingestUrl(url, tags = []) {
        console.log(`[IngestionEngine] Fetching URL: ${url}`);
        const result = await (0, pageFetcher_1.fetchPage)(url);
        if (!result.success || !result.text) {
            throw new Error(`Failed to fetch URL: ${result.error ?? "no content"}`);
        }
        // Write to temp file so documentParser can handle it
        const tmpDir = path_1.default.join(process.cwd(), "workspace", "tmp");
        fs_1.default.mkdirSync(tmpDir, { recursive: true });
        const safeName = url
            .replace(/^https?:\/\//, "")
            .replace(/[^a-zA-Z0-9]/g, "_")
            .slice(0, 60);
        const tmpFile = path_1.default.join(tmpDir, `${safeName}.txt`);
        fs_1.default.writeFileSync(tmpFile, result.text, "utf-8");
        try {
            const id = await this.ingest(tmpFile, [...tags, "web", "url"]);
            return id;
        }
        finally {
            try {
                fs_1.default.unlinkSync(tmpFile);
            }
            catch { /* ignore */ }
        }
    }
}
exports.IngestionEngine = IngestionEngine;
exports.ingestionEngine = new IngestionEngine();
