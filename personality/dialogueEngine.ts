// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personality/dialogueEngine.ts — Top-level chat orchestrator

import { conversationMemory }         from './conversationMemory'
import { userProfile }               from './userProfile'
import { intentClassifier, IntentType } from './intentClassifier'
import { responseComposer }          from './responseComposer'
import { runOnboarding }             from './onboarding'
import { persistentMemory }          from '../memory/persistentMemory'

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
    conversationMemory.addMessage('user', userMessage)
    await persistentMemory.addMessage('user', userMessage)

    // 4. Classify intent — skip Ollama for simple/short messages
    const wordCount = userMessage.trim().split(/\s+/).length
    const isSimple  = wordCount <= 5
      && !/^(create|make|build|write|generate|deploy|fix|debug|run|execute)/i.test(userMessage.trim())
      && /^(hi|hello|hey|thanks|ok|okay|yes|no|sure|cool|great|good|bye|test|sup|yo|what|how|why|who|when|where)(\s|$)/i.test(userMessage.trim())
    const intent = isSimple
      ? { type: 'chat' as const, confidence: 1, raw: userMessage }
      : await intentClassifier.classify(userMessage)

    // 5. Route based on intent
    const chunks: string[] = []

    if (intent.type === 'build' || intent.type === 'deploy') {
      yield 'Got it — starting now. Watch the activity feed on the right for live progress.\n'
      const { goalEngine } = await import('../goals/goalEngine')
      goalEngine.run(userMessage.slice(0, 60), userMessage).catch(() => {})
      chunks.push('Goal started.')
      return  // STOP HERE — don't generate any more text

    } else if (intent.type === 'status') {
      const { goalStore } = await import('../goals/goalStore')
      const active = goalStore.listGoals('active')
      yield `Active goals: ${active.length}. Check the Goals tab for details.`
      return

    } else {
      // Only for chitchat/explain — generate actual LLM response
      // Use persistent memory context (stable facts) instead of raw conversation (prevents hallucination)
      const persistentContext = await persistentMemory.buildContext()
      const shortContext      = conversationMemory.getRecentMessages(3)
        .map(m => `${m.role}: ${m.content}`).join('\n')
      const safeContext = [persistentContext, shortContext].filter(Boolean).join('\n\n')
      for await (const chunk of responseComposer.compose(userMessage, intent.type, safeContext)) {
        chunks.push(chunk)
        yield chunk
      }
    }

    // 6. Save response to memory
    const fullResponse = chunks.join('').trim()
    if (fullResponse) {
      conversationMemory.addMessage('assistant', fullResponse, intent.type)
      await persistentMemory.addMessage('assistant', fullResponse, intent.type)
    }

    // 7. Background tasks — extract facts and learn from conversation
    const recent = conversationMemory.getRecentMessages(10)
    conversationMemory.extractFacts(recent).catch(() => {})
    persistentMemory.learnFromConversation([{ role: 'user', content: userMessage }]).catch(() => {})
  }
}

export const dialogueEngine = new DialogueEngine()
