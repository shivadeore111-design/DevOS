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
exports.askGrok = askGrok;
const axios_1 = __importDefault(require("axios"));
async function askGrok(prompt) {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey)
        throw new Error("Missing XAI_API_KEY");
    try {
        const response = await axios_1.default.post("https://api.x.ai/v1/chat/completions", {
            model: "grok-3",
            messages: [
                { role: "system", content: "You are a structured AI planner that returns JSON only." },
                { role: "user", content: prompt }
            ],
            temperature: 0.3
        }, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        });
        return response.data.choices[0].message.content;
    }
    catch (err) {
        console.error("🔥 Grok Real Error:");
        console.error(err.response?.data || err.message);
        throw err;
    }
}
