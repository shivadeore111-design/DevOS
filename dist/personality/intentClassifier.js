"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.intentClassifier = void 0;
// personality/intentClassifier.ts — Classify user messages into intent types
const ollama_1 = require("../llm/ollama");
// Keyword-based fast-path rules (ordered by specificity)
const KEYWORD_RULES = [
    { type: 'build', keywords: ['build', 'create', 'make', 'generate', 'write', 'scaffold', 'init', 'new project', 'new app', 'new api', 'new service'] },
    { type: 'deploy', keywords: ['deploy', 'ship', 'release', 'push to', 'go live', 'publish', 'vercel', 'railway', 'heroku'] },
    { type: 'debug', keywords: ['fix', 'debug', 'error', 'broken', 'not working', 'failing', 'crash', 'exception', 'bug', 'issue'] },
    { type: 'status', keywords: ['status', 'list', 'show me', 'what\'s running', 'running', 'active goals', 'active missions', 'progress', 'monitor'] },
    { type: 'configure', keywords: ['set', 'configure', 'enable', 'disable', 'turn on', 'turn off', 'change', 'update setting', 'settings'] },
    { type: 'explain', keywords: ['how does', 'what is', 'explain', 'why', 'when should', 'what are', 'tell me about', 'describe', 'help me understand'] },
];
function keywordMatch(message) {
    const lower = message.toLowerCase();
    for (const rule of KEYWORD_RULES) {
        for (const kw of rule.keywords) {
            if (lower.includes(kw)) {
                return { type: rule.type, confidence: 0.85, raw: message };
            }
        }
    }
    return null;
}
class IntentClassifier {
    async classify(message) {
        // 1. Fast keyword match
        const fast = keywordMatch(message);
        if (fast)
            return fast;
        // 2. Ollama fallback for ambiguous messages
        const prompt = `Classify this user message into exactly one of these intent types:
build, deploy, debug, status, configure, explain, chat

Message: "${message}"

Reply with ONLY the intent type word and nothing else.`;
        try {
            const raw = await (0, ollama_1.callOllama)(prompt, undefined, 'qwen2.5-coder:7b');
            const word = raw.trim().toLowerCase().split(/\s+/)[0] ?? '';
            const valid = ['build', 'deploy', 'debug', 'status', 'configure', 'explain', 'chat'];
            const type = valid.includes(word) ? word : 'chat';
            return { type, confidence: 0.7, raw: message };
        }
        catch {
            return { type: 'chat', confidence: 0.5, raw: message };
        }
    }
}
exports.intentClassifier = new IntentClassifier();
