// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personality/conversationMemory.ts — Short-term conversation memory + fact extraction

import * as fs       from 'fs'
import * as path     from 'path'
import { callOllama } from '../llm/ollama'

const MEMORY_FILE  = path.join(process.cwd(), 'workspace', 'conversation-memory.json')
const MAX_MESSAGES = 200

export interface ConversationMessage {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  timestamp: string
  intent?:   string
}

export interface ExtractedFact {
  id:          string
  fact:        string
  source:      string   // message id that produced this fact
  extractedAt: string
}

interface MemoryStore {
  messages: ConversationMessage[]
  facts:    ExtractedFact[]
}

function loadStore(): MemoryStore {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8')) as MemoryStore
    }
  } catch { /* corrupt file — start fresh */ }
  return { messages: [], facts: [] }
}

function saveStore(store: MemoryStore): void {
  const dir = path.dirname(MEMORY_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2))
}

class ConversationMemory {

  addMessage(role: 'user' | 'assistant', content: string, intent?: string): ConversationMessage {
    const store = loadStore()
    const msg: ConversationMessage = {
      id:        `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(intent ? { intent } : {}),
    }
    store.messages.push(msg)
    // Keep only the most recent MAX_MESSAGES
    if (store.messages.length > MAX_MESSAGES) {
      store.messages = store.messages.slice(-MAX_MESSAGES)
    }
    saveStore(store)
    return msg
  }

  getRecentMessages(n = 20): ConversationMessage[] {
    const store = loadStore()
    return store.messages.slice(-n)
  }

  /** Build a compact context string from the last N messages */
  getContext(n = 10): string {
    const msgs = this.getRecentMessages(n)
    if (msgs.length === 0) return ''
    return msgs
      .map(m => `${m.role === 'user' ? 'User' : 'DevOS'}: ${m.content}`)
      .join('\n')
  }

  /** Call Ollama to extract facts from recent messages and save them */
  async extractFacts(messages: ConversationMessage[]): Promise<ExtractedFact[]> {
    if (messages.length === 0) return []

    const conversation = messages
      .map(m => `${m.role === 'user' ? 'User' : 'DevOS'}: ${m.content}`)
      .join('\n')

    const prompt = `Extract factual information about the user from this conversation.
Return ONLY a JSON array of strings, each being a concise fact. Example: ["User prefers TypeScript", "User is building a SaaS product"]
If no facts can be extracted, return [].

Conversation:
${conversation}

Facts:`

    try {
      const raw  = await callOllama(prompt, undefined, 'qwen2.5-coder:7b')
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) return []

      const factStrings: string[] = JSON.parse(match[0])
      if (!Array.isArray(factStrings)) return []

      const sourceId = messages[messages.length - 1]?.id ?? 'unknown'
      const facts: ExtractedFact[] = factStrings
        .filter(f => typeof f === 'string' && f.trim().length > 0)
        .map(f => ({
          id:          `fact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fact:        f.trim(),
          source:      sourceId,
          extractedAt: new Date().toISOString(),
        }))

      this.saveFacts(facts)
      return facts
    } catch {
      return []
    }
  }

  saveFacts(newFacts: ExtractedFact[]): void {
    if (newFacts.length === 0) return
    const store = loadStore()
    store.facts.push(...newFacts)
    saveStore(store)
  }

  getFacts(): ExtractedFact[] {
    return loadStore().facts
  }

  clear(): void {
    saveStore({ messages: [], facts: [] })
  }
}

export const conversationMemory = new ConversationMemory()
