"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocalModels = getLocalModels;
exports.initLocalModels = initLocalModels;
exports.getOllamaModelForTask = getOllamaModelForTask;
exports.getNextAvailableAPI = getNextAvailableAPI;
exports.markRateLimited = markRateLimited;
exports.recordResponseTime = recordResponseTime;
exports.incrementUsage = incrementUsage;
exports.logProviderStatus = logProviderStatus;
exports.assessComplexity = assessComplexity;
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
const modelDiscovery_1 = require("../core/modelDiscovery");
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
// ── Local model discovery cache ───────────────────────────────
// Populated once at startup via initLocalModels(). Read-only after that.
let localModels = {
    planner: null, responder: null, coder: null, fast: null, all: [],
};
function getLocalModels() { return localModels; }
async function initLocalModels() {
    localModels = await (0, modelDiscovery_1.discoverLocalModels)();
    if (localModels.all.length > 0) {
        console.log('[ModelDiscovery] Found local models:');
        console.log('  Planner:   ', localModels.planner);
        console.log('  Responder: ', localModels.responder);
        console.log('  Coder:     ', localModels.coder);
        console.log('  Fast:      ', localModels.fast);
        // Persist discovered assignments to config so agentLoop can read them
        const config = (0, index_1.loadConfig)();
        config.ollama = {
            ...(config.ollama || { fallbackModels: [], baseUrl: 'http://localhost:11434' }),
            model: localModels.responder || config.ollama?.model || 'gemma4:e4b',
            plannerModel: localModels.planner || undefined,
            coderModel: localModels.coder || undefined,
            fastModel: localModels.fast || undefined,
        };
        (0, index_1.saveConfig)(config);
    }
    else {
        console.log('[ModelDiscovery] No local models found — cloud only');
    }
    return localModels;
}
// ── Per-task Ollama model selector ────────────────────────────
function getOllamaModelForTask(task) {
    // Prefer user overrides from config, then discovered models, then safe default
    const config = (0, index_1.loadConfig)();
    switch (task) {
        case 'planner':
            return config.ollama?.plannerModel || localModels.planner || localModels.responder || 'llama3.2';
        case 'executor':
            return config.ollama?.fastModel || localModels.fast || localModels.responder || 'llama3.2';
        case 'responder':
            return config.ollama?.model || localModels.responder || 'llama3.2';
    }
}
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
    console.log(`  ollama (${OLLAMA_FALLBACK_MODEL}) — local — #${order} guaranteed fallback`);
}
// ── Complexity scorer ─────────────────────────────────────────
// Returns 0–1 where 0 = trivially simple (local Ollama) and
// 1 = highly complex (needs best cloud model).
function assessComplexity(message) {
    let score = 0.3;
    if (message.length > 500)
        score += 0.15;
    if (message.length > 1000)
        score += 0.10;
    const complexPatterns = [
        /research|analyze|compare|explain in detail/i,
        /plan|strategy|architecture|design/i,
        /write.*code|build|create|implement/i,
        /debug|fix.*error|troubleshoot/i,
        /multi.*step|comprehensive|deep.research/i,
    ];
    const simplePatterns = [
        /^(hi|hello|hey|thanks|thank you|ok|yes|no|sure)\b/i,
        /what time|what date|who are you|what can you do/i,
        /^.{1,30}$/,
        /^(good morning|good night|bye)\b/i,
    ];
    if (complexPatterns.some(p => p.test(message)))
        score += 0.30;
    if (simplePatterns.some(p => p.test(message)))
        score -= 0.30;
    if (/open|launch|run|execute|deploy/i.test(message))
        score += 0.10;
    const qMarks = (message.match(/\?/g) || []).length;
    if (qMarks > 2)
        score += 0.15;
    return Math.max(0, Math.min(1, score));
}
const OLLAMA_FALLBACK_MODEL = 'gemma4:e4b';
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
const OLLAMA_RESULT = {
    apiKey: '', model: OLLAMA_FALLBACK_MODEL, providerName: 'ollama', apiName: 'ollama',
};
function getModelForTask(task, message) {
    // ── Complexity gate — responder only ─────────────────────────
    // Simple queries go to local Ollama (zero cost).
    // Complex or tool-using queries proceed to cloud chain below.
    if (task === 'responder' && message) {
        const complexity = assessComplexity(message);
        if (complexity < 0.35) {
            const model = getOllamaModelForTask('responder');
            console.log(`[Router] Routing "${message.substring(0, 30)}..." → ollama:${model}, complexity: ${complexity.toFixed(2)} (simple)`);
            return { apiKey: '', model, providerName: 'ollama', apiName: 'ollama' };
        }
        else {
            console.log(`[Router] Complexity: ${complexity.toFixed(2)} (complex) — "${message.substring(0, 40)}" → cloud`);
        }
    }
    autoResetExpiredLimits();
    const config = (0, index_1.loadConfig)();
    const available = config.providers.apis.filter(a => {
        if (!a.enabled || a.rateLimited)
            return false;
        const k = a.key.startsWith('env:') ? (process.env[a.key.replace('env:', '')] || '') : a.key;
        return k.length > 0;
    });
    // Planner: groq > gemini > openrouter → local planner model
    // Cerebras excluded: 8B model cannot follow complex SOUL-based planning prompts
    if (task === 'planner') {
        for (const p of ['groq', 'gemini', 'openrouter']) {
            const api = available.find(a => a.provider === p);
            if (api)
                return resolveKey(api);
        }
        const model = getOllamaModelForTask('planner');
        console.log(`[Router] Planner: all cloud providers rate-limited — using local Ollama ${model}`);
        return { apiKey: '', model, providerName: 'ollama', apiName: 'ollama' };
    }
    // Responder: groq > gemini > openrouter → local responder model
    // Cerebras excluded: too small (8B) to reliably follow SOUL prompt without hallucinating
    if (task === 'responder') {
        for (const p of ['groq', 'gemini', 'openrouter']) {
            const api = available.find(a => a.provider === p);
            if (api)
                return resolveKey(api);
        }
        const model = getOllamaModelForTask('responder');
        console.log(`[Router] Responder: all cloud providers rate-limited — using local Ollama ${model} (quality may vary)`);
        return { apiKey: '', model, providerName: 'ollama', apiName: 'ollama' };
    }
    // Executor: fastest — cerebras > groq > nvidia → discovered fast model
    if (task === 'executor') {
        for (const p of ['cerebras', 'groq', 'nvidia', 'openai']) {
            const api = available.find(a => a.provider === p);
            if (api)
                return resolveKey(api);
        }
        const model = getOllamaModelForTask('executor');
        console.log(`[Router] Executor: all cloud providers unavailable — falling back to Ollama ${model}`);
        return { apiKey: '', model, providerName: 'ollama', apiName: 'ollama' };
    }
    // Generic fallback — any available API, then gemma4:e4b
    if (available.length > 0)
        return resolveKey(available[0]);
    return OLLAMA_RESULT;
}
// ── Main entry: get smart provider with full fallback chain ───
function getSmartProvider() {
    const config = (0, index_1.loadConfig)();
    const userName = config.user?.name || 'there';
    // MANUAL MODE: use the explicitly selected active provider
    if (config.routing?.mode === 'manual') {
        if (config.model.active === 'ollama') {
            return { provider: ollama_1.ollamaProvider, model: config.model.activeModel || OLLAMA_FALLBACK_MODEL, userName, apiName: 'ollama' };
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
    // FALLBACK: best discovered Ollama model
    if (config.routing?.fallbackToOllama !== false) {
        const model = getOllamaModelForTask('responder');
        console.log(`[Router] All APIs unavailable — falling back to Ollama ${model}`);
        return { provider: ollama_1.ollamaProvider, model, userName, apiName: 'ollama' };
    }
    // Last resort
    const model = getOllamaModelForTask('responder');
    return { provider: ollama_1.ollamaProvider, model, userName, apiName: 'ollama' };
}
