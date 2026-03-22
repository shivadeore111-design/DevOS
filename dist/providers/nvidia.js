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
exports.askNvidia = askNvidia;
const axios_1 = __importDefault(require("axios"));
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const MODEL = "meta/llama3-8b-instruct";
async function askNvidia(prompt) {
    if (!NVIDIA_API_KEY) {
        throw new Error("Missing NVIDIA_API_KEY");
    }
    try {
        const response = await axios_1.default.post("https://integrate.api.nvidia.com/v1/chat/completions", {
            model: MODEL,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3
        }, {
            headers: {
                Authorization: `Bearer ${NVIDIA_API_KEY}`,
                "Content-Type": "application/json"
            }
        });
        return response.data.choices[0].message.content;
    }
    catch (err) {
        console.error("🔥 NVIDIA Error:");
        console.error(err?.response?.data || err.message);
        throw err;
    }
}
