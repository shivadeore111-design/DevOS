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
exports.askOpenRouter = askOpenRouter;
const axios_1 = __importDefault(require("axios"));
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "openai/gpt-4o-mini";
async function askOpenRouter(prompt) {
    if (!OPENROUTER_API_KEY) {
        throw new Error("Missing OPENROUTER_API_KEY");
    }
    try {
        const response = await axios_1.default.post("https://openrouter.ai/api/v1/chat/completions", {
            model: MODEL,
            messages: [{ role: "user", content: prompt }]
        }, {
            headers: {
                Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            }
        });
        return response.data.choices[0].message.content;
    }
    catch (err) {
        console.error("🔥 OpenRouter Error:");
        console.error(err?.response?.data || err.message);
        throw err;
    }
}
