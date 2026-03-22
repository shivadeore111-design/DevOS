"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.responseComposer = void 0;
// personality/responseComposer.ts — Streaming response generation (AsyncGenerator)
const ollama_1 = require("../llm/ollama");
const devosPersonality_1 = require("./devosPersonality");
const MAX_WORDS = 300;
const STREAM_MODEL = 'mistral-nemo:12b';
/** Build an intent-aware instruction suffix so DevOS stays on-brand */
function intentHint(intent) {
    switch (intent) {
        case 'build': return 'Respond as a builder. Outline a concrete execution plan with steps. Be brief.';
        case 'deploy': return 'Respond as a deployment engineer. Mention specific commands or tools. Be precise.';
        case 'debug': return 'Respond as a debugger. Ask clarifying questions if needed, then propose a fix.';
        case 'status': return 'Respond with a concise status summary. Use plain text — no markdown tables.';
        case 'configure': return 'Respond with exact config instructions. Be direct.';
        case 'explain': return 'Explain clearly and concisely. No filler. Max 3 paragraphs.';
        default: return 'Respond naturally. Keep it short.';
    }
}
class ResponseComposer {
    /** Compose a response as an AsyncGenerator<string> that yields words one by one */
    async *compose(userMessage, intent, context) {
        const contextBlock = context
            ? `\nRecent conversation:\n${context}\n`
            : '';
        const userContent = `${contextBlock}User: ${userMessage}\n\n${intentHint(intent)}`;
        const { system, user } = (0, devosPersonality_1.wrapWithPersona)(userContent);
        let fullResponse = '';
        try {
            fullResponse = await (0, ollama_1.callOllama)(user, system, STREAM_MODEL);
        }
        catch {
            fullResponse = 'Unable to reach language model. Check Ollama is running.';
        }
        // Trim to max words
        const words = fullResponse.trim().split(/\s+/).slice(0, MAX_WORDS);
        // Yield word-by-word for SSE streaming effect
        for (const word of words) {
            yield word + ' ';
        }
    }
    /** Collect the full response (for non-streaming contexts) */
    async compose_full(userMessage, intent, context) {
        const chunks = [];
        for await (const chunk of this.compose(userMessage, intent, context)) {
            chunks.push(chunk);
        }
        return chunks.join('').trim();
    }
}
exports.responseComposer = new ResponseComposer();
