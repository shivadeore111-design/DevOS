"use strict";
// ============================================================
// DevOS � Autonomous AI Execution System
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
exports.searchEngine = exports.SearchEngine = void 0;
exports.webSearch = webSearch;
// web/searchEngine.ts � DuckDuckGo Instant Answer API + fallback
const https = __importStar(require("https"));
const researchCache_1 = require("../research/researchCache");
const TIMEOUT_MS = 10000;
const MAX_RESULTS = 5;
function ddgJsonFetch(query) {
    return new Promise((resolve, reject) => {
        const path = `/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const options = {
            hostname: "api.duckduckgo.com",
            port: 443,
            path,
            method: "GET",
            headers: { "User-Agent": "DevOS/1.0 (research bot)" },
            timeout: TIMEOUT_MS,
        };
        const req = https.request(options, res => {
            let data = "";
            res.setEncoding("utf-8");
            res.on("data", chunk => { data += chunk; });
            res.on("end", () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    reject(new Error("Failed to parse DDG JSON"));
                }
            });
            res.on("error", reject);
        });
        req.on("timeout", () => { req.destroy(); reject(new Error("DDG request timed out")); });
        req.on("error", reject);
        req.end();
    });
}
function ddgLiteFetch(query) {
    return new Promise((resolve, reject) => {
        const path = `/lite/?q=${encodeURIComponent(query)}&kl=us-en`;
        const options = {
            hostname: "lite.duckduckgo.com",
            port: 443,
            path,
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html",
            },
            timeout: TIMEOUT_MS,
        };
        const req = https.request(options, res => {
            let html = "";
            res.setEncoding("utf-8");
            res.on("data", chunk => { html += chunk; });
            res.on("end", () => resolve(html));
            res.on("error", reject);
        });
        req.on("timeout", () => { req.destroy(); reject(new Error("DDG lite timed out")); });
        req.on("error", reject);
        req.end();
    });
}
function parseLiteResults(html) {
    const results = [];
    const rowRe = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let m;
    while ((m = rowRe.exec(html)) !== null && results.length < MAX_RESULTS) {
        let u = m[1];
        if (!u.startsWith("http"))
            continue;
        if (u.includes("duckduckgo.com"))
            continue;
        results.push({ title: m[2].trim(), url: u, snippet: "" });
    }
    return results;
}
async function webSearch(query) {
    const cacheKey = `search:${query.toLowerCase().trim()}`;
    const cached = researchCache_1.researchCache.get(cacheKey);
    if (cached) {
        console.log(`[SearchEngine] Cache hit for: "${query}"`);
        return cached.results;
    }
    console.log(`[SearchEngine] Searching DDG: "${query}"`);
    // Try JSON API first
    try {
        const data = await ddgJsonFetch(query);
        const results = [];
        // Abstract + RelatedTopics
        if (data.Abstract && data.AbstractURL) {
            results.push({
                title: data.Heading || query,
                url: data.AbstractURL,
                snippet: data.AbstractText || "",
            });
        }
        if (Array.isArray(data.RelatedTopics)) {
            for (const t of data.RelatedTopics) {
                if (results.length >= MAX_RESULTS)
                    break;
                if (t.FirstURL && t.Text) {
                    results.push({ title: t.Text.slice(0, 80), url: t.FirstURL, snippet: t.Text });
                }
            }
        }
        if (results.length > 0) {
            console.log(`[SearchEngine] Found ${results.length} results (JSON API)`);
            researchCache_1.researchCache.set(cacheKey, query, results, undefined, 6 * 60 * 60 * 1000);
            return results;
        }
    }
    catch (err) {
        console.log(`[SearchEngine] JSON API failed: ${err.message} � trying lite`);
    }
    // Fallback to lite.duckduckgo.com
    try {
        const html = await ddgLiteFetch(query);
        const results = parseLiteResults(html);
        console.log(`[SearchEngine] Found ${results.length} results (lite)`);
        researchCache_1.researchCache.set(cacheKey, query, results, undefined, 6 * 60 * 60 * 1000);
        return results;
    }
    catch (err) {
        console.error(`[SearchEngine] All search methods failed: ${err.message}`);
        return [];
    }
}
class SearchEngine {
    search(query) { return webSearch(query); }
}
exports.SearchEngine = SearchEngine;
exports.searchEngine = new SearchEngine();
