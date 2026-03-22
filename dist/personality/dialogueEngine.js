"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.dialogueEngine = void 0;
// personality/dialogueEngine.ts — Top-level chat orchestrator
const conversationMemory_1 = require("./conversationMemory");
const userProfile_1 = require("./userProfile");
const intentClassifier_1 = require("./intentClassifier");
const responseComposer_1 = require("./responseComposer");
const onboarding_1 = require("./onboarding");
class DialogueEngine {
    /**
     * Main entry point — process a user message and yield response chunks.
     * Handles: first-run onboarding, intent classification, response streaming,
     * background memory + fact extraction.
     */
    async *chat(userMessage) {
        // 1. First-run onboarding
        if (userProfile_1.userProfile.isFirstRun()) {
            for await (const chunk of (0, onboarding_1.runOnboarding)()) {
                yield chunk;
            }
            // After onboarding, treat the original message as the first real input
        }
        // 2. Update last seen
        userProfile_1.userProfile.updateLastSeen();
        // 3. Save incoming message to memory
        const userMsg = conversationMemory_1.conversationMemory.addMessage('user', userMessage);
        // 4. Classify intent
        const intent = await intentClassifier_1.intentClassifier.classify(userMessage);
        // 5. Pull recent context for the composer
        const context = conversationMemory_1.conversationMemory.getContext(10);
        // 6. Stream response
        const chunks = [];
        for await (const chunk of responseComposer_1.responseComposer.compose(userMessage, intent.type, context)) {
            chunks.push(chunk);
            yield chunk;
        }
        // 7. Save assistant response to memory
        const fullResponse = chunks.join('').trim();
        conversationMemory_1.conversationMemory.addMessage('assistant', fullResponse, intent.type);
        // 8. Background: extract facts from last 5 exchanges (fire-and-forget)
        const recent = conversationMemory_1.conversationMemory.getRecentMessages(10);
        conversationMemory_1.conversationMemory.extractFacts(recent).catch(() => { });
        // 9. Background: learn from build intents (fire-and-forget)
        if (intent.type === 'build') {
            userProfile_1.userProfile.learnFromGoal(userMessage.slice(0, 80));
        }
    }
}
exports.dialogueEngine = new DialogueEngine();
