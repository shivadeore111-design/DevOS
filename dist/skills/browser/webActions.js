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
exports.WebActions = void 0;
const https_1 = __importDefault(require("https"));
class WebActions {
    async search(query) {
        const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
        return new Promise((resolve) => {
            https_1.default.get(apiUrl, (res) => {
                let data = "";
                res.on("data", chunk => {
                    data += chunk;
                });
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        const results = [];
                        if (parsed.RelatedTopics && Array.isArray(parsed.RelatedTopics)) {
                            parsed.RelatedTopics.forEach((item) => {
                                if (item.Text && item.FirstURL && results.length < 5) {
                                    results.push({
                                        title: item.Text,
                                        url: item.FirstURL
                                    });
                                }
                            });
                        }
                        resolve(results);
                    }
                    catch {
                        resolve([]);
                    }
                });
            }).on("error", () => {
                resolve([]);
            });
        });
    }
}
exports.WebActions = WebActions;
