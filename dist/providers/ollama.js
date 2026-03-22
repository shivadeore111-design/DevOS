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
exports.askOllama = askOllama;
const axios_1 = __importDefault(require("axios"));
const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = process.env.DEVOS_MODEL || "qwen2.5:7b-instruct";
async function askOllama(prompt) {
    try {
        const response = await axios_1.default.post(OLLAMA_URL, {
            model: MODEL,
            prompt,
            stream: false,
        });
        if (!response.data || !response.data.response) {
            throw new Error("Invalid response from Ollama.");
        }
        return response.data.response;
    }
    catch (error) {
        console.error("🔥 Ollama Error:");
        if (error.response?.data) {
            console.error(error.response.data);
        }
        else {
            console.error(error.message);
        }
        throw error;
    }
}
