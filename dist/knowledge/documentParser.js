"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentParser = exports.DocumentParser = void 0;
// knowledge/documentParser.ts — Reads files into structured ParsedDocument objects
//   and splits content into overlapping chunks for embedding / retrieval.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const CHUNK_SIZE = 500; // characters per chunk
const CHUNK_OVERLAP = 50; // overlap between chunks
function makeId() {
    return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
/** Strip HTML tags and collapse whitespace. */
function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s{2,}/g, " ")
        .trim();
}
/** Convert CSV text to a human-readable paragraph form. */
function parseCsv(raw) {
    const lines = raw.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0)
        return raw;
    const headers = lines[0].split(",").map(h => h.replace(/^["']|["']$/g, "").trim());
    const rows = lines.slice(1);
    const readable = rows.map(row => {
        const cells = row.split(",").map(c => c.replace(/^["']|["']$/g, "").trim());
        return headers.map((h, i) => `${h}: ${cells[i] ?? ""}`).join(", ");
    });
    return `[CSV with ${headers.length} columns, ${rows.length} rows]\n` + readable.join("\n");
}
/**
 * Splits content into overlapping chunks of CHUNK_SIZE characters.
 * Tries to break at word boundaries where possible.
 */
function chunkify(content) {
    if (content.length <= CHUNK_SIZE)
        return [content];
    const chunks = [];
    let start = 0;
    while (start < content.length) {
        let end = Math.min(start + CHUNK_SIZE, content.length);
        // Try to snap to a word boundary (space or newline) within the last 50 chars
        if (end < content.length) {
            const boundary = content.lastIndexOf(" ", end);
            if (boundary > start + CHUNK_SIZE - 100)
                end = boundary + 1;
        }
        chunks.push(content.slice(start, end).trim());
        start = Math.max(start + 1, end - CHUNK_OVERLAP);
    }
    return chunks.filter(c => c.length > 0);
}
class DocumentParser {
    /** Parse a file at filePath into a structured ParsedDocument. */
    async parse(filePath) {
        const absPath = path_1.default.resolve(filePath);
        const ext = path_1.default.extname(absPath).toLowerCase();
        const name = path_1.default.basename(absPath, ext);
        const stat = fs_1.default.statSync(absPath);
        const raw = fs_1.default.readFileSync(absPath, "utf-8");
        let content;
        switch (ext) {
            case ".txt":
            case ".md":
                content = raw;
                break;
            case ".json":
                try {
                    content = JSON.stringify(JSON.parse(raw), null, 2);
                }
                catch {
                    content = raw;
                }
                break;
            case ".ts":
            case ".js":
                content = `[${ext.slice(1).toUpperCase()} source file]\n\n${raw}`;
                break;
            case ".html":
            case ".htm":
                content = stripHtml(raw);
                break;
            case ".csv":
                content = parseCsv(raw);
                break;
            default:
                // Best-effort: treat as plain text
                content = raw;
        }
        const chunks = chunkify(content);
        return {
            id: makeId(),
            filePath: absPath,
            title: name,
            content,
            chunks,
            metadata: {
                fileType: ext || "unknown",
                sizeBytes: stat.size,
                parsedAt: new Date(),
            },
        };
    }
}
exports.DocumentParser = DocumentParser;
exports.documentParser = new DocumentParser();
