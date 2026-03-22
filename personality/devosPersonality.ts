// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personality/devosPersonality.ts — KV-cache safe persona wrapper
//
// CRITICAL: The system prompt is always retrieved from coreBoot which reads
// context/bootstrap/PERSONA.md (+ RULES.md + TOOLS.md) ONCE and caches it.
// Never inject dynamic content into the system prompt — it invalidates
// Ollama's KV-cache and slows every request.
// All dynamic context goes in the USER turn via wrapWithPersona(msg, context).

import { coreBoot } from '../core/coreBoot'

/**
 * KV-cache safe wrapper.
 * system = static bootstrap (always identical bytes → KV-cache hit)
 * user   = dynamic context + user message
 */
export function wrapWithPersona(
  userMessage: string,
  context?: string,
): { system: string; user: string } {
  return {
    system: coreBoot.getSystemPrompt(),   // always static — never varies
    user:   context ? `${context}\n\n${userMessage}` : userMessage,
  }
}

/** Convenience re-export so callers don't need to import coreBoot separately */
export { coreBoot }
