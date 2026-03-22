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
exports.askGemini = askGemini;
const axios_1 = __importDefault(require("axios"));
async function askGemini(prompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
        throw new Error("Missing GEMINI_API_KEY");
    try {
        const response = await axios_1.default.post(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ]
        }, {
            headers: {
                "Content-Type": "application/json"
            }
        });
        return response.data.candidates[0].content.parts[0].text;
    }
    catch (err) {
        console.error("🔥 Gemini Real Error:");
        console.error(err.response?.data || err.message);
        throw err;
    }
}
