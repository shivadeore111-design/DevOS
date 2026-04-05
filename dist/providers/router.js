"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextAvailableAPI = getNextAvailableAPI;
exports.markRateLimited = markRateLimited;
exports.recordResponseTime = recordResponseTime;
exports.incrementUsage = incrementUsage;
exports.logProviderStatus = logProviderStatus;
exports.getModelForTask = getModelForTask;
exports.getSmartProvider = getSmartProvider;
// providers/router.ts — Smart multi-API routing engine
// Round-robin across available keys, auto-marks 429s, falls back to Ollama
const index_1 = require("./index");
const ollama_1 = require("./ollama");
const groq_1 = require("./groq");
const openrouter_1 = require("./openrouter");
const gemini_1 = require("./gemini");
const cerebras_1 = require("./cerebras");
const nvidia_1 = require("./nvidia");
// Per-provider rate-limit windows — tuned to actual reset characteristics.
// Previous flat 1-hour window was far too conservative for fast-reset APIs.
const RATE_LIMIT_WINDOWS = {
    groq: 15 * 1000, // Groq free tier resets in ~10–15 s
    gemini: 90 * 1000, // Gemini resets in ~60–90 s
    openrouter: 30 * 1000, // OpenRouter rarely rate-limits; 30 s is safe
    together: 30 * 1000,
    mistral: 60 * 1000,
    cohere: 60 * 1000,
    deepseek: 60 * 1000,
    openai: 60 * 1000,
    anthropic: 60 * 1000,
    cerebras: 30 * 1000,
    nvidia: 60 * 1000,
    cloudflare: 30 * 1000,
    github: 30 * 1000,
    ollama: 0, // local — never rate-limited
};
const DEFAULT_RATE_LIMIT_MS = 60 * 1000; // 1 minute fallback
// In-memory response-time tracking (EWMA per provider)
// Separate from the config file so it resets on restart without persisting stale values.
const responseTimesMs = new Map();
// ── Provider factory ──────────────────────────────────────────
function buildProvider(entry) {
    const key = entry.key.startsWith('env:')
        ? process.env[entry.key.replace('env:', '')] || ''
        : entry.key;
    switch (entry.provider) {
        case 'groq': return (0, groq_1.createGroqProvider)(key);
        case 'openrouter': return (0, openrouter_1.createOpenRouterProvider)(key);
        case 'gemini': return (0, gemini_1.createGeminiProvider)(key);
        case 'cerebras': return (0, cerebras_1.createCerebrasProvider)(key);
        case 'nvidia': return (0, nvidia_1.createNvidiaProvider)(key);
        default: return ollama_1.ollamaProvider;
    }
}
// ── Auto-reset stale rate limits ──────────────────────────────
function autoResetExpiredLimits() {
    const config = (0, index_1.loadConfig)();
    let changed = false;
    config.providers.apis = config.providers.apis.map(api => {
        if (api.rateLimited && api.rateLimitedAt) {
            const window = RATE_LIMIT_WINDOWS[api.provider] ?? DEFAULT_RATE_LIMIT_MS;
            if (window === 0 || Date.now() - api.rateLimitedAt > window) {
                changed = true;
                const { rateLimitedAt, ...rest } = api;
                return { ...rest, rateLimited: false };
            }
        }
        return api;
    });
    if (changed)
        (0, index_1.saveConfig)(config);
    return changed;
}
// ── Get next available API — scored by response time + failures ──
function getNextAvailableAPI() {
    autoResetExpiredLimits();
    const config = (0, index_1.loadConfig)();
    const available = config.providers.apis.filter(api => {
        if (!api.enabled || api.rateLimited)
            return false;
        // Resolve the actual key value — skip if env var is missing or empty
        const resolvedKey = api.key.startsWith('env:')
            ? (process.env[api.key.replace('env:', '')] || '')
            : api.key;
        return resolvedKey.length > 0;
    });
    if (!available.length)
        return null;
    // Score: lower is better — blend usage count, response time, and failure history
    const scored = available
        .map(api => {
        const avgMs = responseTimesMs.get(api.name) ?? 2000; // assume 2s if unknown
        const usageScore = (api.usageCount || 0) * 0.1;
        const timeScore = avgMs / 1000;
        return { api, score: usageScore + timeScore };
    })
        .sort((a, b) => a.score - b.score);
    const entry = scored[0].api;
    return { provider: buildProvider(entry), model: entry.model, entry };
}
// ── Mark an API as rate-limited ───────────────────────────────
function markRateLimited(apiName) {
    const config = (0, index_1.loadConfig)();
    // Find the provider type to get the right window
    const entry = config.providers.apis.find(a => a.name === apiName);
    const window = entry ? (RATE_LIMIT_WINDOWS[entry.provider] ?? DEFAULT_RATE_LIMIT_MS) : DEFAULT_RATE_LIMIT_MS;
    config.providers.apis = config.providers.apis.map(api => api.name === apiName
        ? { ...api, rateLimited: true, rateLimitedAt: Date.now() }
        : api);
    (0, index_1.saveConfig)(config);
    const resetSecs = window === 0 ? 'never' : `${window / 1000}s`;
    console.log(`[Router] ${apiName} rate limited — auto-reset in ${resetSecs}`);
}
// ── Record response time (EWMA) ───────────────────────────────
// Call this after each successful LLM response to improve provider selection.
function recordResponseTime(providerName, ms) {
    const prev = responseTimesMs.get(providerName);
    // Exponential moving average — weight recent observations at 20%
    responseTimesMs.set(providerName, prev ? prev * 0.8 + ms * 0.2 : ms);
}
// ── Increment usage count ─────────────────────────────────────
function incrementUsage(apiName) {
    if (apiName === 'ollama')
        return; // don't track Ollama usage
    const config = (0, index_1.loadConfig)();
    config.providers.apis = config.providers.apis.map(api => api.name === apiName ? { ...api, usageCount: (api.usageCount || 0) + 1 } : api);
    (0, index_1.saveConfig)(config);
}
// ── Log which providers are active at startup ────────────────
function logProviderStatus() {
    const config = (0, index_1.loadConfig)();
    const apis = config.providers.apis;
    console.log('[Router] Provider chain:');
    let order = 1;
    for (const api of apis) {
        const resolvedKey = api.key.startsWith('env:')
            ? (process.env[api.key.replace('env:', '')] || '')
            : api.key;
        const keyStatus = resolvedKey.length > 0 ? '✓ key present' : '✗ key missing';
        const status = !api.enabled ? 'disabled' : api.rateLimited ? 'rate-limited' : resolvedKey.length === 0 ? 'SKIPPED (no key)' : `#${order++} active`;
        console.log(`  ${api.name} (${api.provider}/${api.model}) — ${keyStatus} — ${status}`);
    }
    console.log(`  ollama — local — #${order} guaranteed fallback`);
}
function resolveKey(api) {
    return {
        apiKey: api.key.startsWith('env:')
            ? (process.env[api.key.replace('env:', '')] || '')
            : api.key,
        model: api.model,
        providerName: api.provider,
        apiName: api.name,
    };
}
function getModelForTask(task) {
    autoResetExpiredLimits();
    const config = (0, index_1.loadConfig)();
    const available = config.providers.apis.filter(a => {
        if (!a.enabled || a.rateLimited)
            return false;
        const k = a.key.startsWith('env:') ? (process.env[a.key.replace('env:', '')] || '') : a.key;
        return k.length > 0;
    });
    // Planner: strongest reasoning — openrouter > groq > gemini > cerebras > others
    if (task === 'planner') {
        for (const p of ['openrouter', 'groq', 'gemini', 'cerebras']) {
            const api = available.find(a => a.provider === p);
            if (api)
                return resolveKey(api);
        }
    }
    // Executor: fastest — cerebras > groq > nvidia > others
    if (task === 'executor') {
        for (const p of ['cerebras', 'groq', 'nvidia', 'openai']) {
            const api = available.find(a => a.provider === p);
            if (api)
                return resolveKey(api);
        }
    }
    // Responder: best quality — groq > gemini > openrouter > cerebras > others
    if (task === 'responder') {
        for (const p of ['groq', 'gemini', 'openrouter', 'cerebras']) {
            const api = available.find(a => a.provider === p);
            if (api)
                return resolveKey(api);
        }
    }
    // Generic fallback — any available API, then Ollama
    if (available.length > 0)
        return resolveKey(available[0]);
    const ollamaModel = config.model?.activeModel || 'mistral:7b';
    return { apiKey: '', model: ollamaModel, providerName: 'ollama', apiName: 'ollama' };
}
// ── Main entry: get smart provider with full fallback chain ───
function getSmartProvider() {
    const config = (0, index_1.loadConfig)();
    const userName = config.user?.name || 'there';
    // MANUAL MODE: use the explicitly selected active provider
    if (config.routing?.mode === 'manual') {
        if (config.model.active === 'ollama') {
            return { provider: ollama_1.ollamaProvider, model: config.model.activeModel || 'mistral:7b', userName, apiName: 'ollama' };
        }
        const active = config.providers.apis.find(a => a.name === config.model.active);
        if (active && active.enabled && !active.rateLimited) {
            return { provider: buildProvider(active), model: active.model || config.model.activeModel, userName, apiName: active.name };
        }
        // Configured API is unavailable — fall through to auto
    }
    // AUTO MODE: round-robin across available APIs
    const next = getNextAvailableAPI();
    if (next) {
        return { provider: next.provider, model: next.entry.model || 'llama-3.3-70b-versatile', userName, apiName: next.entry.name };
    }
    // FALLBACK: Ollama
    if (config.routing?.fallbackToOllama !== false) {
        console.log('[Router] All APIs unavailable — falling back to Ollama');
        return { provider: ollama_1.ollamaProvider, model: config.model.activeModel || 'mistral:7b', userName, apiName: 'ollama' };
    }
    // Last resort
    return { provider: ollama_1.ollamaProvider, model: 'mistral:7b', userName, apiName: 'ollama' };
}
