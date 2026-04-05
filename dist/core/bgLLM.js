"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callBgLLM = callBgLLM;
// core/bgLLM.ts — Lightweight LLM caller for background agents.
// Tries Cerebras first (fast, free), falls back to Ollama.
// All calls tracked as system cost (not counted toward user budget).
// Separated from agentLoop.ts to avoid circular imports.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const costTracker_1 = require("./costTracker");
const CONFIG_PATH = path_1.default.join(process.cwd(), 'config', 'devos.config.json');
// ── Config helpers ─────────────────────────────────────────────
function getCerebrasKey() {
    try {
        const cfg = JSON.parse(fs_1.default.readFileSync(CONFIG_PATH, 'utf-8'));
        const api = (cfg.providers?.apis ?? []).find((a) => a.provider === 'cerebras' && a.enabled);
        if (!api)
            return '';
        const key = api.key;
        return key.startsWith('env:')
            ? (process.env[key.replace('env:', '')] || '')
            : key;
    }
    catch {
        return '';
    }
}
function getOllamaModel() {
    try {
        const cfg = JSON.parse(fs_1.default.readFileSync(CONFIG_PATH, 'utf-8'));
        return cfg.model?.activeModel || 'mistral:7b';
    }
    catch {
        return 'mistral:7b';
    }
}
// ── callBgLLM ─────────────────────────────────────────────────
// Simple single-turn LLM call for background agents.
// Uses Cerebras → Ollama fallback. Always system cost.
async function callBgLLM(prompt, traceId) {
    // Try Cerebras
    const key = getCerebrasKey();
    if (key) {
        try {
            const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`,
                },
                body: JSON.stringify({
                    model: 'llama3.1-8b',
                    messages: [{ role: 'user', content: prompt }],
                    stream: false,
                    max_tokens: 2000,
                }),
                signal: AbortSignal.timeout(30000),
            });
            if (r.ok) {
                const d = await r.json();
                const text = d?.choices?.[0]?.message?.content || '';
                const inputTokens = d?.usage?.prompt_tokens ?? 0;
                const outputTokens = d?.usage?.completion_tokens ?? 0;
                try {
                    costTracker_1.costTracker.trackUsage('cerebras', 'llama3.1-8b', inputTokens, outputTokens, traceId, true);
                }
                catch { }
                if (text)
                    return text;
            }
        }
        catch { }
    }
    // Fallback: Ollama
    try {
        const ollamaModel = getOllamaModel();
        const r = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: ollamaModel,
                stream: false,
                messages: [{ role: 'user', content: prompt }],
            }),
            signal: AbortSignal.timeout(60000),
        });
        if (r.ok) {
            const d = await r.json();
            const text = d?.message?.content || '';
            try {
                costTracker_1.costTracker.trackUsage('ollama', ollamaModel, d?.prompt_eval_count ?? 0, d?.eval_count ?? 0, traceId, true);
            }
            catch { }
            return text;
        }
    }
    catch (e) {
        console.error('[bgLLM] Ollama fallback failed:', e.message);
    }
    return '';
}
