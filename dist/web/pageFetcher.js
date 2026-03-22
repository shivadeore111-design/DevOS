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
exports.fetchPage = fetchPage;
// web/pageFetcher.ts — Pure Node.js HTTP/HTTPS page fetcher
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url = __importStar(require("url"));
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10000;
const MAX_CHARS = 5000;
async function fetchPage(rawUrl, redirectsLeft = MAX_REDIRECTS) {
    if (redirectsLeft < 0) {
        return { success: false, url: rawUrl, error: "Too many redirects" };
    }
    return new Promise(resolve => {
        const parsed = url.parse(rawUrl);
        const isHttps = parsed.protocol === "https:";
        const lib = isHttps ? https : http;
        const options = {
            hostname: parsed.hostname ?? "",
            port: parsed.port ?? (isHttps ? 443 : 80),
            path: parsed.path ?? "/",
            method: "GET",
            headers: {
                "User-Agent": "DevOS/1.0 (research bot)",
                "Accept": "text/html,text/plain",
            },
            timeout: TIMEOUT_MS,
        };
        const req = lib.request(options, res => {
            const code = res.statusCode ?? 0;
            // Handle redirects
            if ((code === 301 || code === 302 || code === 307 || code === 308) && res.headers.location) {
                const next = res.headers.location.startsWith("http")
                    ? res.headers.location
                    : `${parsed.protocol}//${parsed.hostname}${res.headers.location}`;
                res.resume();
                resolve(fetchPage(next, redirectsLeft - 1));
                return;
            }
            if (code < 200 || code >= 400) {
                res.resume();
                resolve({ success: false, url: rawUrl, statusCode: code, error: `HTTP ${code}` });
                return;
            }
            let raw = "";
            res.setEncoding("utf-8");
            res.on("data", chunk => {
                raw += chunk;
                if (raw.length > 200000)
                    res.destroy(); // safety cap on raw download
            });
            res.on("end", () => {
                const text = stripHtml(raw).slice(0, MAX_CHARS);
                resolve({ success: true, url: rawUrl, statusCode: code, text });
            });
            res.on("error", err => resolve({ success: false, url: rawUrl, error: err.message }));
        });
        req.on("timeout", () => {
            req.destroy();
            resolve({ success: false, url: rawUrl, error: "Request timed out" });
        });
        req.on("error", err => resolve({ success: false, url: rawUrl, error: err.message }));
        req.end();
    });
}
// ── HTML stripper ─────────────────────────────────────────
function stripHtml(html) {
    return html
        // Remove script and style blocks entirely
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        // Replace block tags with newlines for readability
        .replace(/<\/?(p|div|h[1-6]|li|tr|br|section|article|header|footer)[^>]*>/gi, "\n")
        // Strip remaining tags
        .replace(/<[^>]+>/g, " ")
        // Decode basic HTML entities
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        // Collapse whitespace
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
