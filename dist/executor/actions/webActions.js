"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeWebAction = executeWebAction;
// ============================================================
// webActions.ts — DevOS Web Action Executor
// Uses Node built-in https — no external deps
// ============================================================
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const pageFetcher_1 = require("../../web/pageFetcher");
const searchEngine_1 = require("../../web/searchEngine");
function httpGet(url, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith("https") ? https_1.default : http_1.default;
        const timeout = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
        lib.get(url, (res) => {
            let body = "";
            res.on("data", chunk => { body += chunk; });
            res.on("end", () => {
                clearTimeout(timeout);
                resolve({ status: res.statusCode ?? 0, body });
            });
        }).on("error", err => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}
async function executeWebAction(action) {
    try {
        switch (action.type) {
            case "web_fetch": {
                const targetUrl = action.url;
                if (!targetUrl)
                    return { success: false, error: "No URL provided" };
                console.log(`[WebActions] Fetching: ${targetUrl}`);
                const result = await (0, pageFetcher_1.fetchPage)(targetUrl);
                return {
                    success: result.success,
                    output: { url: targetUrl, statusCode: result.statusCode, text: result.text ?? "" },
                    error: result.success ? undefined : result.error,
                };
            }
            case "web_search": {
                const query = action.query;
                if (!query)
                    return { success: false, error: "No query provided" };
                console.log(`[WebActions] Searching: ${query}`);
                const results = await (0, searchEngine_1.webSearch)(query);
                return {
                    success: true,
                    output: { query, results, count: results.length },
                };
            }
            default:
                return { success: false, error: `Unknown web action type: ${action.type}` };
        }
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
