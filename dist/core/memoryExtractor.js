"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryExtractor = void 0;
// core/memoryExtractor.ts — Post-conversation durable memory extraction.
// After every conversation ends, scans messages and writes facts to
// workspace/memory/ as typed frontmatter markdown files.
// Maintains workspace/memory/MEMORY_INDEX.md (max 100 entries).
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bgLLM_1 = require("./bgLLM");
const MEMORY_DIR = path_1.default.join(process.cwd(), 'workspace', 'memory');
const INDEX_PATH = path_1.default.join(MEMORY_DIR, 'MEMORY_INDEX.md');
const SESSIONS_DIR = path_1.default.join(process.cwd(), 'workspace', 'sessions');
// ── Helpers ───────────────────────────────────────────────────
function memoryFilePath(filename) {
    return path_1.default.join(MEMORY_DIR, filename);
}
function today() {
    return new Date().toISOString().split('T')[0];
}
function readIndex() {
    try {
        if (!fs_1.default.existsSync(INDEX_PATH))
            return [];
        const content = fs_1.default.readFileSync(INDEX_PATH, 'utf-8');
        return content.trim().split('\n')
            .filter(l => l.startsWith('- ['))
            .map(l => {
            const m = l.match(/^- \[(.+?)\]\((.+?)\) — (.+)$/);
            if (!m)
                return null;
            return { filename: m[2], title: m[1], type: 'project_fact', summary: m[3] };
        })
            .filter((e) => e !== null);
    }
    catch {
        return [];
    }
}
function writeIndex(entries) {
    try {
        const lines = entries.slice(0, 100).map(e => `- [${e.title}](${e.filename}) — ${e.summary}`);
        fs_1.default.writeFileSync(INDEX_PATH, lines.join('\n') + '\n', 'utf-8');
    }
    catch (e) {
        console.error('[MemoryExtractor] Index write failed:', e.message);
    }
}
function buildExtractionPrompt(sessionContent, existingIndex) {
    return `You are a memory extractor for DevOS. Read the session below and extract durable facts worth remembering.

EXISTING MEMORY INDEX:
${existingIndex || '(empty)'}

SESSION CONTENT:
${sessionContent.slice(0, 3000)}

Extract 1-5 memory items. For each one output JSON in this format:
[
  {
    "type": "user_preference|project_fact|tool_pattern|learned_behavior",
    "filename": "user_name.md or project_architecture.md (use type prefix + snake_case descriptor)",
    "title": "Short descriptive title",
    "content": "Concise actionable fact. 1-4 sentences.",
    "summary": "One-line summary for index"
  }
]

Rules:
- Only extract facts that are genuinely useful in a future conversation
- Skip trivial or already-indexed facts
- learned_behavior: corrections, things to avoid
- tool_pattern: commands that work/fail, file paths
- project_fact: architecture, design decisions
- user_preference: communication style, preferences
- Output ONLY valid JSON array, nothing else`;
}
// ── MemoryExtractor ───────────────────────────────────────────
class MemoryExtractor {
    constructor() {
        try {
            fs_1.default.mkdirSync(MEMORY_DIR, { recursive: true });
        }
        catch { }
    }
    // ── Extract from session ───────────────────────────────────
    async extractFromSession(sessionId) {
        const sessionFile = path_1.default.join(SESSIONS_DIR, `${sessionId}.md`);
        if (!fs_1.default.existsSync(sessionFile))
            return;
        try {
            const sessionContent = fs_1.default.readFileSync(sessionFile, 'utf-8');
            if (sessionContent.length < 100)
                return; // too short
            const existingIndex = fs_1.default.existsSync(INDEX_PATH)
                ? fs_1.default.readFileSync(INDEX_PATH, 'utf-8').slice(0, 2000)
                : '';
            const prompt = buildExtractionPrompt(sessionContent, existingIndex);
            const raw = await (0, bgLLM_1.callBgLLM)(prompt, `memory_extract_${sessionId}`);
            if (!raw)
                return;
            // Parse JSON array from response
            const jsonMatch = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\[[\s\S]*\]/);
            if (!jsonMatch)
                return;
            const items = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(items) || items.length === 0)
                return;
            const existingEntries = readIndex();
            for (const item of items) {
                if (!item.filename || !item.title || !item.content)
                    continue;
                await this.writeMemoryFile(item.filename, item.type, item.title, item.content, existingEntries);
            }
            // Update index
            writeIndex(existingEntries);
            console.log(`[MemoryExtractor] Extracted ${items.length} memory item(s) from session ${sessionId}`);
        }
        catch (e) {
            console.error('[MemoryExtractor] Extraction failed:', e.message);
        }
    }
    // ── Write a single memory file ─────────────────────────────
    async writeMemoryFile(filename, type, title, content, indexEntries) {
        const filePath = memoryFilePath(filename);
        const now = today();
        // Check if file already exists — update rather than duplicate
        let created = now;
        if (fs_1.default.existsSync(filePath)) {
            try {
                const existing = fs_1.default.readFileSync(filePath, 'utf-8');
                const m = existing.match(/^created:\s*(.+)$/m);
                if (m)
                    created = m[1].trim();
            }
            catch { }
        }
        const frontmatter = `---
title: ${title}
type: ${type}
created: ${created}
updated: ${now}
---

${content.trim()}
`;
        try {
            fs_1.default.writeFileSync(filePath, frontmatter, 'utf-8');
        }
        catch (e) {
            console.error(`[MemoryExtractor] Write failed for ${filename}:`, e.message);
            return;
        }
        // Update or add index entry
        const existing = indexEntries.findIndex(e => e.filename === filename);
        const entry = { filename, title, type, summary: content.slice(0, 80).replace(/\n/g, ' ') };
        if (existing >= 0) {
            indexEntries[existing] = entry;
        }
        else {
            indexEntries.unshift(entry);
        }
    }
    // ── Load memory index for system prompt injection ──────────
    loadMemoryIndex() {
        try {
            if (!fs_1.default.existsSync(INDEX_PATH))
                return '';
            return fs_1.default.readFileSync(INDEX_PATH, 'utf-8');
        }
        catch {
            return '';
        }
    }
    // ── Load a specific memory file ────────────────────────────
    loadMemoryFile(filename) {
        try {
            const p = memoryFilePath(filename);
            if (!fs_1.default.existsSync(p))
                return '';
            return fs_1.default.readFileSync(p, 'utf-8');
        }
        catch {
            return '';
        }
    }
}
// ── Singleton ──────────────────────────────────────────────────
exports.memoryExtractor = new MemoryExtractor();
