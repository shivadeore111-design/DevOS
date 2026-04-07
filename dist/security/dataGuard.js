"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataGuard = void 0;
// security/dataGuard.ts — Routes sensitive data to local-only processing.
//
// When DevOS handles screenshots, documents, or text that may contain PII,
// credentials, or financial data, DataGuard decides whether it is safe to
// send that data to a cloud LLM (e.g. Claude via API) or whether it must
// stay on-device and be processed by the local Ollama model only.
//
// Heuristic sensitivity detection is fast and runs synchronously.
// For higher-assurance scenarios, set DEVOS_DATAGUARD_STRICT=true to force
// all data through local models regardless of content.
// ── Patterns that indicate sensitive content ──────────────────
const SENSITIVE_PATTERNS = [
    // Credentials
    /password\s*[:=]/i,
    /api[_-]?key\s*[:=]/i,
    /secret[_-]?key\s*[:=]/i,
    /access[_-]?token\s*[:=]/i,
    /auth[_-]?token\s*[:=]/i,
    /bearer\s+[A-Za-z0-9._\-]{20,}/i,
    /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
    // Financial data
    /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/, // credit cards
    /\biban\b/i,
    /\bswift\s*code\b/i,
    /\brouting\s*number\b/i,
    // PII
    /\bssn\b/i,
    /\bsocial\s+security\b/i,
    /\bdate\s+of\s+birth\b/i,
    /\bpassport\s+number\b/i,
    // Dev secrets
    /sk-[A-Za-z0-9]{20,}/, // OpenAI / Anthropic keys
    /ghp_[A-Za-z0-9]{36}/, // GitHub PAT
    /xox[bpra]-[A-Za-z0-9\-]{24,}/, // Slack tokens
];
// ── DataGuard class ────────────────────────────────────────────
class DataGuard {
    /**
     * Returns true if the given data string appears to contain sensitive
     * information that should not be sent to a cloud LLM.
     *
     * For screenshots, pass a short text description or a sample of any
     * OCR output, not the raw base64 — base64 is never matched.
     *
     * When DEVOS_DATAGUARD_STRICT=true, always returns true (local-only).
     */
    async isSensitive(data) {
        if (process.env.DEVOS_DATAGUARD_STRICT === 'true')
            return true;
        // Limit scan to first 4 KB — avoids scanning huge binary blobs
        const sample = data.slice(0, 4096);
        for (const pattern of SENSITIVE_PATTERNS) {
            if (pattern.test(sample)) {
                console.log(`[DataGuard] Sensitive pattern detected — routing to local model`);
                return true;
            }
        }
        return false;
    }
    /**
     * Synchronous variant for hot paths — no async overhead.
     * Less thorough than the async version (no awaitable plugins).
     */
    isSensitiveSync(data) {
        if (process.env.DEVOS_DATAGUARD_STRICT === 'true')
            return true;
        const sample = data.slice(0, 4096);
        return SENSITIVE_PATTERNS.some(p => p.test(sample));
    }
    /**
     * Redact sensitive values from a string before logging or storage.
     * Replaces matched values with [REDACTED].
     */
    redact(data) {
        let out = data;
        for (const p of SENSITIVE_PATTERNS) {
            out = out.replace(new RegExp(p.source, p.flags.includes('g') ? p.flags : p.flags + 'g'), '[REDACTED]');
        }
        return out;
    }
}
exports.dataGuard = new DataGuard();
