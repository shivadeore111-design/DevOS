"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.askLLM = askLLM;
const grok_1 = require("./grok");
const gemini_1 = require("./gemini");
const openrouter_1 = require("./openrouter");
const nvidia_1 = require("./nvidia");
const ollama_1 = require("./ollama");
const PRIORITY = (process.env.PROVIDER_PRIORITY || "grok,gemini,openrouter,nvidia,ollama")
    .split(",")
    .map(p => p.trim());
async function askLLM(prompt) {
    for (const provider of PRIORITY) {
        try {
            if (provider === "grok") {
                const result = await (0, grok_1.askGrok)(prompt);
                console.log("✅ Used provider: Grok");
                return result;
            }
            if (provider === "gemini") {
                const result = await (0, gemini_1.askGemini)(prompt);
                console.log("✅ Used provider: Gemini");
                return result;
            }
            if (provider === "openrouter") {
                const result = await (0, openrouter_1.askOpenRouter)(prompt);
                console.log("✅ Used provider: OpenRouter");
                return result;
            }
            if (provider === "nvidia") {
                const result = await (0, nvidia_1.askNvidia)(prompt);
                console.log("✅ Used provider: NVIDIA");
                return result;
            }
            if (provider === "ollama") {
                const result = await (0, ollama_1.askOllama)(prompt);
                console.log("✅ Used provider: Ollama");
                return result;
            }
        }
        catch (err) {
            console.log(`❌ ${provider} failed`);
            continue;
        }
    }
    throw new Error("All providers failed.");
}
