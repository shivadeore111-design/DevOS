// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personality/devOSMind.ts — Top-level chat orchestrator
//
// Routing table:
//   run_goal       → fire goalEngine.run(), yield confirmation, return
//   status_check   → query goalStore, yield summary, return
//   system_command → handle inline (profile, pilots, clear), return
//   ask_question   → conversationLayer context + voiceEngine.stream()
//   chitchat       → lightweight voiceEngine.stream()
//   feedback       → voiceEngine.stream() + flag for correction
//   unclear        → voiceEngine.stream() with clarifying hint
//
// All response tokens are collected and saved to conversationLayer so
// later turns have full context.

import { intentEngine, IntentType }   from './intentEngine'
import { conversationLayer }          from './conversationLayer'
import { voiceEngine }                from './voiceEngine'
import { userProfile }                from './userProfile'
import { firstBoot }                  from './firstBoot'
import { persistentMemory }           from '../memory/persistentMemory'

class DevOSMind {

  /**
   * Primary chat entry point.
   * Yields response tokens as an AsyncGenerator<string>.
   */
  async *chat(userMessage: string): AsyncGenerator<string> {

    // ── 0. First-run onboarding (only runs once ever) ────────────────────
    if (userProfile.isFirstRun()) {
      for await (const chunk of firstBoot.run()) {
        yield chunk
      }
      // After onboarding the original message becomes the first real input
    }

    // ── 1. Update last-seen ───────────────────────────────────────────────
    userProfile.updateLastSeen()

    // ── 2. Classify intent ────────────────────────────────────────────────
    const intent = await intentEngine.classify(userMessage)

    // ── 3. Route ──────────────────────────────────────────────────────────

    // --- run_goal: fire and confirm ---
    if (intent.type === 'run_goal') {
      yield 'On it — '
      const { goalEngine } = await import('../goals/goalEngine')
      goalEngine.run(userMessage.slice(0, 60), userMessage).catch(() => {})
      yield 'goal started. Watch the activity feed.'

      // Save exchange to memory
      conversationLayer.addMessage('user', userMessage, intent.type)
      conversationLayer.addMessage('devos', 'Goal started.', intent.type)
      await persistentMemory.addMessage('user', userMessage, intent.type).catch(() => {})
      await persistentMemory.addMessage('assistant', 'Goal started.', intent.type).catch(() => {})
      return
    }

    // --- status_check: pull live data, no LLM needed ---
    if (intent.type === 'status_check') {
      const { goalStore } = await import('../goals/goalStore')
      const active  = goalStore.listGoals('active')
      const pending = goalStore.listGoals('pending')
      const reply   = active.length > 0
        ? `${active.length} goal${active.length !== 1 ? 's' : ''} running. ${pending.length} pending. Check the Goals tab.`
        : pending.length > 0
        ? `Nothing running right now. ${pending.length} goal${pending.length !== 1 ? 's' : ''} pending.`
        : `No active goals. Chat to start one.`
      yield reply

      conversationLayer.addMessage('user', userMessage, intent.type)
      conversationLayer.addMessage('devos', reply, intent.type)
      return
    }

    // --- system_command: handle inline shortcuts ---
    if (intent.type === 'system_command') {
      const lower = userMessage.toLowerCase()
      if (lower.includes('clear memory')) {
        conversationLayer.clear()
        yield 'Memory cleared. Starting fresh.'
        conversationLayer.addMessage('user', userMessage, intent.type)
        conversationLayer.addMessage('devos', 'Memory cleared.', intent.type)
        return
      }
      // Fall through to LLM for other system commands
    }

    // --- conversational intents: ask_question, chitchat, feedback, unclear,
    //     or system_command not handled above ---

    const context = await conversationLayer.buildContextString()

    const collectedChunks: string[] = []
    for await (const chunk of voiceEngine.stream(userMessage, intent.type, context || undefined)) {
      collectedChunks.push(chunk)
      yield chunk
    }

    const collectedResponse = collectedChunks.join('').trim()

    // ── 4. Save to memory ─────────────────────────────────────────────────
    conversationLayer.addMessage('user', userMessage, intent.type)
    if (collectedResponse) {
      conversationLayer.addMessage('devos', collectedResponse, intent.type)
    }

    await persistentMemory.addMessage('user', userMessage, intent.type).catch(() => {})
    if (collectedResponse) {
      await persistentMemory.addMessage('assistant', collectedResponse, intent.type).catch(() => {})
    }

    // ── 5. Background: extract facts from conversation ────────────────────
    if (collectedResponse && intent.type !== 'chitchat') {
      setImmediate(() => {
        persistentMemory.learnFromConversation([
          { role: 'user',      content: userMessage      },
          { role: 'assistant', content: collectedResponse },
        ]).catch(() => {})
      })
    }
  }
}

export const devOSMind = new DevOSMind()
