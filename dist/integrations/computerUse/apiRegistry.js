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
exports.apiRegistry = void 0;
class APIRegistry {
    constructor() {
        this.registry = new Map();
    }
    // ── Registration ─────────────────────────────────────────────
    register(serviceName, handler) {
        this.registry.set(serviceName.toLowerCase(), handler);
    }
    hasAPI(service) {
        return this.registry.has(service.toLowerCase());
    }
    // ── Execute ──────────────────────────────────────────────────
    /**
     * Execute a service call.
     *
     * Resolution order:
     *   1. Registered API handler → fast, structured, no UI
     *   2. BrowserVault UI fallback → slow, visual, always works
     *
     * Returns `{ result, usedAPI: true }` when a handler succeeded,
     * or `{ result: { status: 'ui_fallback', ... }, usedAPI: false }` for fallback.
     */
    async execute(service, params) {
        const handler = this.registry.get(service.toLowerCase());
        if (handler) {
            try {
                const result = await handler(params);
                return { result, usedAPI: true };
            }
            catch (err) {
                console.warn(`[APIRegistry] ${service} API handler failed — falling back to UI: ${err?.message}`);
            }
        }
        // UI fallback — open BrowserVault on the service's web app
        const { browserVault } = await Promise.resolve().then(() => __importStar(require('../../security/browserVault')));
        const SERVICE_URLS = {
            gmail: 'https://mail.google.com',
            notion: 'https://notion.so',
            github: 'https://github.com',
            slack: 'https://app.slack.com',
            sheets: 'https://docs.google.com/spreadsheets',
            linear: 'https://linear.app',
            jira: 'https://id.atlassian.com',
            figma: 'https://www.figma.com',
            trello: 'https://trello.com',
            asana: 'https://app.asana.com',
        };
        const url = SERVICE_URLS[service.toLowerCase()];
        if (!url)
            throw new Error(`[APIRegistry] No API handler and no UI fallback for service: ${service}`);
        const taskId = `api-fallback-${Date.now()}`;
        const vault = await browserVault.createBrowserVault(taskId);
        const liveViewUrl = browserVault.getLiveViewUrl(taskId);
        console.log(`[APIRegistry] 🌐 UI fallback → ${url}  (vault: ${vault.containerName})`);
        return {
            result: {
                status: 'ui_fallback',
                url,
                vaultId: vault.taskId,
                liveViewUrl,
            },
            usedAPI: false,
        };
    }
    // ── Introspection ─────────────────────────────────────────────
    listServices() {
        return Array.from(this.registry.keys());
    }
}
exports.apiRegistry = new APIRegistry();
// ── Built-in registrations ────────────────────────────────────
// Extend via config/api-keys.json or register() calls at startup.
// Example: apiRegistry.register('github', githubHandler)
