"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanAndRedact = scanAndRedact;
exports.containsSecret = containsSecret;
// core/secretScanner.ts — Redact API keys and secrets before persist
//
// Scans text for common secret patterns (OpenAI, Groq, Gemini, GitHub,
// Cerebras, license keys, Bearer tokens, generic key= patterns) and
// replaces them with [REDACTED] before any data is written to SQLite
// or the conversation JSON store.
// ── Patterns ──────────────────────────────────────────────────
const SECRET_PATTERNS = [
    /sk-[a-zA-Z0-9]{20,}/g, // OpenAI
    /gsk_[a-zA-Z0-9]{20,}/g, // Groq
    /AIza[a-zA-Z0-9_-]{35}/g, // Google/Gemini
    /ghp_[a-zA-Z0-9]{36}/g, // GitHub PAT
    /csk-[a-zA-Z0-9]{20,}/g, // Cerebras
    /[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}/g, // License keys
    /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/g, // Bearer tokens
    /(?:api[_-]?key|apikey|api[_-]?secret|access[_-]?token)["\s:=]+["']?([a-zA-Z0-9_\-]{20,})["']?/gi,
];
// ── Public API ─────────────────────────────────────────────────
/**
 * Scan text for secrets and replace all matches with [REDACTED].
 * Safe to call on any string before persisting to disk or DB.
 */
function scanAndRedact(text) {
    let result = text;
    for (const pattern of SECRET_PATTERNS) {
        // Reset lastIndex for stateful regexes (those with /g)
        pattern.lastIndex = 0;
        result = result.replace(pattern, '[REDACTED]');
    }
    return result;
}
/**
 * Returns true if the text contains anything matching a known secret pattern.
 * Use for early-warning logging before calling scanAndRedact().
 */
function containsSecret(text) {
    return SECRET_PATTERNS.some(p => {
        p.lastIndex = 0;
        return p.test(text);
    });
}
