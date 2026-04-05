"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.getActiveProvider = getActiveProvider;
// providers/index.ts — Config schema, load/save, legacy provider resolver
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ollama_1 = require("./ollama");
const groq_1 = require("./groq");
const openrouter_1 = require("./openrouter");
const gemini_1 = require("./gemini");
const CONFIG_PATH = path.join(process.cwd(), 'config', 'devos.config.json');
// ── Defaults ──────────────────────────────────────────────────
function defaultConfig() {
    return {
        user: { name: 'there' },
        model: { active: 'cerebras-free', activeModel: 'llama3.1-8b' },
        providers: {
            ollama: { enabled: true, models: [] },
            apis: [
                {
                    name: 'cerebras-free',
                    provider: 'cerebras',
                    key: 'csk-w32jtjthv666erywhmxrkpx9kfnehn4e6cp38n3d3kmym943',
                    model: 'llama3.1-8b',
                    enabled: true,
                    rateLimited: false,
                    usageCount: 0,
                },
                {
                    name: 'cloudflare-free',
                    provider: 'cloudflare',
                    key: 'env:CLOUDFLARE_API_TOKEN',
                    model: 'env:CLOUDFLARE_ACCOUNT_ID|@cf/meta/llama-3.1-8b-instruct',
                    enabled: false,
                    rateLimited: false,
                    usageCount: 0,
                },
            ],
        },
        routing: { mode: 'auto', fallbackToOllama: true },
        onboardingComplete: false,
    };
}
// ── Load / save ───────────────────────────────────────────────
function loadConfig() {
    try {
        const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        // Back-compat: migrate old apis entries that lack new fields
        if (raw.providers?.apis) {
            raw.providers.apis = raw.providers.apis.map(a => ({
                model: '',
                enabled: true,
                rateLimited: false,
                usageCount: 0,
                ...a,
            }));
        }
        // Back-compat: add routing if missing
        if (!raw.routing)
            raw.routing = { mode: 'auto', fallbackToOllama: true };
        return raw;
    }
    catch {
        return defaultConfig();
    }
}
function saveConfig(config) {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
// ── Legacy active provider resolver (used by onboarding fallback) ──
function getActiveProvider() {
    const config = loadConfig();
    const userName = config.user?.name || 'there';
    if (config.model.active === 'ollama') {
        return { provider: ollama_1.ollamaProvider, model: config.model.activeModel || 'mistral:7b', userName };
    }
    const apiConfig = config.providers?.apis?.find(a => a.name === config.model.active);
    if (!apiConfig) {
        return { provider: ollama_1.ollamaProvider, model: config.model.activeModel || 'mistral:7b', userName };
    }
    const key = apiConfig.key.startsWith('env:')
        ? process.env[apiConfig.key.replace('env:', '')] || ''
        : apiConfig.key;
    switch (apiConfig.provider) {
        case 'groq':
            return { provider: (0, groq_1.createGroqProvider)(key), model: apiConfig.model || 'llama-3.3-70b-versatile', userName };
        case 'openrouter':
            return { provider: (0, openrouter_1.createOpenRouterProvider)(key), model: apiConfig.model || 'meta-llama/llama-3.3-70b-instruct', userName };
        case 'gemini':
            return { provider: (0, gemini_1.createGeminiProvider)(key), model: apiConfig.model || 'gemini-1.5-flash', userName };
        default:
            return { provider: ollama_1.ollamaProvider, model: config.model.activeModel || 'mistral:7b', userName };
    }
}
