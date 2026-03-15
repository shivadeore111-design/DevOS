// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personality/dialogueEngine.ts — Top-level chat orchestrator

import { conversationMemory }  from './conversationMemory'
import { userProfile }         from './userProfile'
import { intentClassifier }    from './intentClassifier'
import { responseComposer }    from './responseComposer'
import { runOnboarding }       from './onboarding'

class DialogueEngine {

  /**
   * Main entry point — process a user message and yield response chunks.
   * Handles: first-run onboarding, intent classification, response streaming,
   * background memory + fact extraction.
   */
  async *chat(userMessage: string): AsyncGenerator<string> {
    // 1. First-run onboarding
    if (userProfile.isFirstRun()) {
      for await (const chunk of runOnboarding()) {
        yield chunk
      }
      // After onboarding, treat the original message as the first real input
    }

    // 2. Update last seen
    userProfile.updateLastSeen()

    // 3. Save incoming message to memory
    const userMsg = conversationMemory.addMessage('user', userMessage)

    // 4. Classify intent
    const intent = await intentClassifier.classify(userMessage)

    // 5. Pull recent context for the composer
    const context = conversationMemory.getContext(10)

    // 6. Stream response
    const chunks: string[] = []
    for await (const chunk of responseComposer.compose(userMessage, intent.type, context)) {
      chunks.push(chunk)
      yield chunk
    }

    // 7. Save assistant response to memory
    const fullResponse = chunks.join('').trim()
    conversationMemory.addMessage('assistant', fullResponse, intent.type)

    // 8. Background: extract facts from last 5 exchanges (fire-and-forget)
    const recent = conversationMemory.getRecentMessages(10)
    conversationMemory.extractFacts(recent).catch(() => { /* silent */ })

    // 9. Background: learn from build intents (fire-and-forget)
    if (intent.type === 'build') {
      userProfile.learnFromGoal(userMessage.slice(0, 80))
    }
  }
}

export const dialogueEngine = new DialogueEngine()
