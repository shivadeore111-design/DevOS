"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPDF = extractPDF;
exports.extractEPUB = extractEPUB;
exports.extractText = extractText;
exports.extractFile = extractFile;
// core/fileIngestion.ts — Local PDF / EPUB / TXT / MD text extractor
//
// All processing is done on the user's machine. No data leaves the device.
//
// Dependencies (bundled with DevOS):
//   pdf-parse  — pure-JS PDF text extraction
//   epub2      — EPUB chapter extraction
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ── PDF extraction ─────────────────────────────────────────
// Uses pdf-parse (pure JS, no native canvas dependency)
async function extractPDF(filePath) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require('pdf-parse');
    const buf = fs_1.default.readFileSync(filePath);
    const fileSizeMB = parseFloat((buf.length / 1024 / 1024).toFixed(2));
    let result;
    try {
        result = await pdfParse(buf, { max: 0 }); // max: 0 = all pages
    }
    catch (e) {
        throw new Error(`PDF parse failed: ${e.message}`);
    }
    const text = cleanText(result.text);
    const wordCount = countWords(text);
    const pageCount = result.numpages ?? 0;
    return { text, wordCount, pageCount, format: 'pdf', fileSizeMB };
}
// ── EPUB extraction ────────────────────────────────────────
// Reads all spine chapters and concatenates their text content
async function extractEPUB(filePath) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const EPub = require('epub2').EPub;
    const fileSizeMB = parseFloat((fs_1.default.statSync(filePath).size / 1024 / 1024).toFixed(2));
    const epub = new EPub(filePath);
    await new Promise((resolve, reject) => {
        epub.on('end', resolve);
        epub.on('error', reject);
        epub.parse();
    });
    const chapterIds = epub.spine.contents.map((c) => c.id);
    const textParts = [];
    for (const id of chapterIds) {
        try {
            const chapter = await new Promise((resolve, reject) => {
                epub.getChapter(id, (err, data) => {
                    if (err)
                        reject(err);
                    else
                        resolve(data || '');
                });
            });
            // Strip HTML tags from chapter HTML
            const stripped = chapter.replace(/<[^>]+>/g, ' ');
            textParts.push(stripped);
        }
        catch {
            // skip unreadable chapters
        }
    }
    const text = cleanText(textParts.join('\n'));
    const wordCount = countWords(text);
    return { text, wordCount, pageCount: 0, format: 'epub', fileSizeMB };
}
// ── Plain-text / Markdown extraction ──────────────────────
function extractText(filePath, format = 'txt') {
    const raw = fs_1.default.readFileSync(filePath, 'utf-8');
    const fileSizeMB = parseFloat((Buffer.byteLength(raw, 'utf-8') / 1024 / 1024).toFixed(2));
    const text = cleanText(raw);
    const wordCount = countWords(text);
    return { text, wordCount, pageCount: 0, format, fileSizeMB };
}
// ── Router — pick extractor by extension ──────────────────
async function extractFile(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    switch (ext) {
        case '.pdf':
            return extractPDF(filePath);
        case '.epub':
            return extractEPUB(filePath);
        case '.md':
        case '.markdown':
            return extractText(filePath, 'md');
        case '.txt':
        default:
            return extractText(filePath, 'txt');
    }
}
// ── Helpers ────────────────────────────────────────────────
function cleanText(raw) {
    return raw
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n') // collapse >2 blank lines
        .replace(/[ \t]+/g, ' ') // collapse horizontal whitespace
        .trim();
}
function countWords(text) {
    return text.split(/\s+/).filter(w => w.length > 0).length;
}
