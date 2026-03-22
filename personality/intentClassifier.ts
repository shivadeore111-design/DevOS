// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personality/intentClassifier.ts — Classify user messages into intent types

import { callOllama }    from '../llm/ollama'
import { getCodingModel } from '../core/autoModelSelector'

export type IntentType =
  | 'build'       // "build me a", "create a", "make a", "generate"
  | 'status'      // "what's running", "show me", "list", "status"
  | 'deploy'      // "deploy", "ship", "push to production", "release"
  | 'explain'     // "how does", "what is", "explain", "why"
  | 'debug'       // "fix", "error", "broken", "not working", "debug"
  | 'configure'   // "set", "configure", "enable", "disable", "change"
  | 'chat'        // anything else / casual conversation

export interface ClassifiedIntent {
  type:       IntentType
  confidence: number         // 0-1
  raw:        string         // original message
}

// Keyword-based fast-path rules (ordered by specificity)
const KEYWORD_RULES: Array<{ type: IntentType; keywords: string[] }> = [
  { type: 'build',     keywords: ['build', 'create', 'make', 'generate', 'write', 'scaffold', 'init', 'new project', 'new app', 'new api', 'new service', 'create a file', 'create file', 'write a file', 'make a file', 'create a folder', 'create folder'] },
  { type: 'deploy',    keywords: ['deploy', 'ship', 'release', 'push to', 'go live', 'publish', 'vercel', 'railway', 'heroku'] },
  { type: 'debug',     keywords: ['fix', 'debug', 'error', 'broken', 'not working', 'failing', 'crash', 'exception', 'bug', 'issue'] },
  { type: 'status',    keywords: ['status', 'list', 'show me', 'what\'s running', 'running', 'active goals', 'active missions', 'progress', 'monitor'] },
  { type: 'configure', keywords: ['set', 'configure', 'enable', 'disable', 'turn on', 'turn off', 'change', 'update setting', 'settings'] },
  { type: 'explain',   keywords: ['how does', 'what is', 'explain', 'why', 'when should', 'what are', 'tell me about', 'describe', 'help me understand'] },
]

function keywordMatch(message: string): ClassifiedIntent | null {
  const lower = message.toLowerCase()
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        return { type: rule.type, confidence: 0.85, raw: message }
      }
    }
  }
  return null
}

class IntentClassifier {

  async classify(message: string): Promise<ClassifiedIntent> {
    // 1. Fast keyword match
    const fast = keywordMatch(message)
    if (fast) return fast

    // 2. Ollama fallback for ambiguous messages
    const prompt = `Classify this user message into exactly one of these intent types:
build, deploy, debug, status, configure, explain, chat

Message: "${message}"

Reply with ONLY the intent type word and nothing else.`

    try {
      const raw    = await callOllama(prompt, undefined, getCodingModel())
      const word   = raw.trim().toLowerCase().split(/\s+/)[0] ?? ''
      const valid: IntentType[] = ['build', 'deploy', 'debug', 'status', 'configure', 'explain', 'chat']
      const type   = valid.includes(word as IntentType) ? (word as IntentType) : 'chat'
      return { type, confidence: 0.7, raw: message }
    } catch {
      return { type: 'chat', confidence: 0.5, raw: message }
    }
  }
}

export const intentClassifier = new IntentClassifier()
