// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personality/intentEngine.ts — Fast keyword-first intent classification
//
// Intent types match the DevOSMind routing table.
// Keyword heuristics run first (< 1ms). LLM fallback only when unclear.

import { callOllama }    from '../llm/ollama'
import { getCodingModel } from '../core/autoModelSelector'

// ── Intent types ───────────────────────────────────────────────────────────

export type IntentType =
  | 'run_goal'       // "build", "create", "make", "generate", "write", "scaffold"
  | 'ask_question'   // "how does", "what is", "explain", "why", "tell me about"
  | 'chitchat'       // greetings, casual, short messages
  | 'status_check'   // "what's running", "list", "status", "show me", "progress"
  | 'system_command' // "reset", "restart", "stop", "clear", "configure", "set"
  | 'feedback'       // "that was wrong", "no", "undo", "revert", "cancel", "bad"
  | 'unclear'        // ambiguous — falls back to LLM

export interface ClassifiedIntent {
  type:       IntentType
  confidence: number    // 0-1
  raw:        string    // original message
}

// ── Keyword rules (ordered: most specific first) ───────────────────────────

const KEYWORD_RULES: Array<{ type: IntentType; keywords: string[] }> = [
  {
    type: 'system_command',
    keywords: [
      'reset', 'restart', 'stop devos', 'clear memory', 'configure',
      'set model', 'set api', 'update setting', 'turn on', 'turn off',
      'enable pilots', 'disable pilots', 'settings'
    ],
  },
  {
    type: 'feedback',
    keywords: [
      'that was wrong', 'not what i meant', 'undo', 'revert', 'cancel that',
      'bad idea', 'too long', 'too short', 'wrong approach', 'try again',
      'no that\'s not', 'you misunderstood'
    ],
  },
  {
    type: 'run_goal',
    keywords: [
      'build', 'create', 'make', 'generate', 'write', 'scaffold', 'init',
      'new project', 'new app', 'new api', 'new service', 'set up',
      'deploy', 'ship', 'release', 'push to', 'go live', 'publish',
      'fix', 'debug', 'refactor', 'implement', 'add feature', 'migrate',
      'start a', 'start building', 'research and build', 'scrape', 'automate',
      'run goal', 'execute'
    ],
  },
  {
    type: 'status_check',
    keywords: [
      'status', 'list', 'show me', 'what\'s running', 'running',
      'active goals', 'active missions', 'progress', 'what have you done',
      'what did you build', 'recent goals', 'last goal', 'monitor',
      'what is happening', 'any updates', 'how many'
    ],
  },
  {
    type: 'ask_question',
    keywords: [
      'how does', 'what is', 'explain', 'why', 'when should', 'what are',
      'tell me about', 'describe', 'help me understand', 'can you explain',
      'what do you think', 'is it possible', 'difference between',
      'what\'s the best', 'which is better', 'should i use'
    ],
  },
  {
    type: 'chitchat',
    keywords: [
      'hi', 'hello', 'hey', 'thanks', 'thank you', 'ok', 'okay', 'yes', 'no',
      'sure', 'cool', 'great', 'good job', 'nice', 'awesome', 'perfect',
      'got it', 'understood', 'bye', 'see you', 'later', 'sup', 'yo',
      'how are you', 'how\'s it going', 'what\'s up'
    ],
  },
]

function keywordMatch(message: string): ClassifiedIntent | null {
  const lower = message.toLowerCase().trim()
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (lower.startsWith(kw) || lower.includes(` ${kw}`) || lower === kw) {
        return { type: rule.type, confidence: 0.88, raw: message }
      }
    }
  }
  return null
}

// ── IntentEngine class ─────────────────────────────────────────────────────

class IntentEngine {

  /**
   * Classify a user message.
   * Fast keyword path first; LLM only when message is ambiguous (unclear).
   */
  async classify(message: string): Promise<ClassifiedIntent> {
    // 0. Trivially short messages = chitchat
    const wordCount = message.trim().split(/\s+/).length
    if (wordCount <= 3 && !/^(build|make|create|fix|debug|deploy|write)/i.test(message.trim())) {
      return { type: 'chitchat', confidence: 0.9, raw: message }
    }

    // 1. Keyword fast-path
    const fast = keywordMatch(message)
    if (fast && fast.type !== 'unclear') return fast

    // 2. LLM fallback for genuinely ambiguous messages
    const prompt = `Classify this user message into exactly one of these intent types:
run_goal, ask_question, chitchat, status_check, system_command, feedback, unclear

Message: "${message}"

Reply with ONLY the intent type word and nothing else.`

    try {
      const raw   = await callOllama(prompt, undefined, getCodingModel())
      const word  = raw.trim().toLowerCase().split(/\s+/)[0] ?? ''
      const valid: IntentType[] = [
        'run_goal', 'ask_question', 'chitchat',
        'status_check', 'system_command', 'feedback', 'unclear'
      ]
      const type  = valid.includes(word as IntentType) ? (word as IntentType) : 'unclear'
      return { type, confidence: 0.72, raw: message }
    } catch {
      return { type: 'unclear', confidence: 0.5, raw: message }
    }
  }
}

export const intentEngine = new IntentEngine()
