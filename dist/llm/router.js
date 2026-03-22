"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureOllamaReady = ensureOllamaReady;
exports.llmCall = llmCall;
exports.llmCallJSON = llmCallJSON;
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
const ollama_1 = require("./ollama");
const modelRouter_1 = require("./modelRouter");
const AUTO_MODEL = process.env.DEVOS_AUTO_MODEL !== "false";
let _healthChecked = false;
async function ensureOllamaReady() {
    if (_healthChecked)
        return;
    const alive = await (0, ollama_1.checkOllamaHealth)();
    if (!alive) {
        throw new Error("[LLMRouter] Ollama is not running.\n" +
            "  Start it with: ollama serve\n" +
            "  Then pull a model: ollama pull llama3");
    }
    const model = process.env.OLLAMA_MODEL ?? "llama3";
    const models = await (0, ollama_1.listOllamaModels)();
    const hasModel = models.some((m) => m.startsWith(model));
    if (!hasModel) {
        console.warn(`[LLMRouter] Model "${model}" not found. Run: ollama pull ${model}`);
    }
    else {
        console.log(`[LLMRouter] ✅ Ollama ready — model: ${model}`);
    }
    console.log(`[LLMRouter] Auto model routing: ${AUTO_MODEL ? "ON" : "OFF"}`);
    _healthChecked = true;
}
function extractJSON(text) {
    try {
        const match = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
        if (!match)
            return null;
        return JSON.parse(match[0]);
    }
    catch {
        return null;
    }
}
async function llmCall(prompt, systemPrompt) {
    await ensureOllamaReady();
    const model = AUTO_MODEL
        ? await (0, modelRouter_1.resolveModel)(prompt, systemPrompt)
        : (process.env.OLLAMA_MODEL ?? "llama3");
    console.log(`[LLMRouter] Calling Ollama (${model})...`);
    const content = await (0, ollama_1.callOllama)(prompt, systemPrompt, model);
    return {
        content,
        provider: "ollama",
        model,
        tokensEstimate: Math.ceil(content.length / 4),
    };
}
async function llmCallJSON(prompt, systemPrompt, fallback) {
    try {
        await ensureOllamaReady();
        const model = AUTO_MODEL
            ? await (0, modelRouter_1.resolveModel)(prompt, systemPrompt)
            : (process.env.OLLAMA_MODEL ?? "llama3");
        console.log(`[LLMRouter] Calling Ollama JSON (${model})...`);
        const first = await (0, ollama_1.callOllama)(prompt, systemPrompt, model);
        const parsed = extractJSON(first);
        if (parsed !== null)
            return parsed;
        console.log("[LLMRouter] JSON parse failed, retrying with stronger instruction...");
        const retryPrompt = prompt +
            "\n\nCRITICAL: Your response MUST be valid JSON only. No text. No markdown. Just raw JSON.";
        const second = await (0, ollama_1.callOllama)(retryPrompt, systemPrompt, model);
        const parsed2 = extractJSON(second);
        if (parsed2 !== null)
            return parsed2;
        console.warn("[LLMRouter] Both attempts failed — using fallback");
        return fallback;
    }
    catch {
        return fallback;
    }
}
