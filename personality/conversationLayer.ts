// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personality/conversationLayer.ts — Two-tier conversation memory
//
// Short-term : last 20 messages in RAM (instant, zero I/O)
// Long-term  : key facts persisted to workspace/conversation-memory.json
// buildContextString() composes both layers into a ≤800-token user-turn
// context string that wrapWithPersona() embeds in the user turn.

import * as fs   from 'fs'
import * as path from 'path'

const MEMORY_FILE  = path.join(process.cwd(), 'workspace', 'conversation-memory.json')
const SHORT_TERM_MAX = 20    // messages kept in RAM
const CONTEXT_TOKEN_LIMIT = 800  // rough token budget for context strings

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  id:        string
  role:      'user' | 'devos'
  content:   string
  timestamp: string
  intent?:   string
}

export interface LongTermFact {
  id:          string
  fact:        string
  source:      string   // message id that produced this fact
  savedAt:     string
}

interface MemoryStore {
  facts: LongTermFact[]
}

// ── Disk helpers ───────────────────────────────────────────────────────────

function loadStore(): MemoryStore {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8')) as MemoryStore
    }
  } catch { /* corrupt — start fresh */ }
  return { facts: [] }
}

function saveStore(store: MemoryStore): void {
  const dir = path.dirname(MEMORY_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  try { fs.writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2)) } catch { /* ignore */ }
}

// ── Rough token estimator (1 token ≈ 4 chars) ─────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// ── ConversationLayer class ────────────────────────────────────────────────

class ConversationLayer {
  /** Short-term in-RAM ring buffer */
  private ram: ConversationMessage[] = []

  // ── Short-term ─────────────────────────────────────────────────────────

  addMessage(role: 'user' | 'devos', content: string, intent?: string): void {
    const msg: ConversationMessage = {
      id:        `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(intent ? { intent } : {}),
    }
    this.ram.push(msg)
    // Keep only last SHORT_TERM_MAX messages in RAM
    if (this.ram.length > SHORT_TERM_MAX) {
      this.ram = this.ram.slice(-SHORT_TERM_MAX)
    }
  }

  getRecentMessages(n = SHORT_TERM_MAX): ConversationMessage[] {
    return this.ram.slice(-n)
  }

  // ── Long-term (disk) ───────────────────────────────────────────────────

  saveFact(fact: string, sourceMessageId?: string): void {
    const store = loadStore()
    store.facts.push({
      id:      `fact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fact:    fact.trim(),
      source:  sourceMessageId || 'unknown',
      savedAt: new Date().toISOString(),
    })
    // Keep only latest 200 facts to avoid unbounded growth
    if (store.facts.length > 200) {
      store.facts = store.facts.slice(-200)
    }
    saveStore(store)
  }

  getFacts(): LongTermFact[] {
    return loadStore().facts
  }

  // ── Context builder ────────────────────────────────────────────────────

  /**
   * Builds a context string ≤ 800 tokens to embed in the user turn.
   * Format:
   *   [Facts about user]
   *   <fact1>
   *   ...
   *
   *   [Recent conversation]
   *   User: ...
   *   DevOS: ...
   */
  async buildContextString(): Promise<string> {
    const parts: string[] = []
    let tokenBudget = CONTEXT_TOKEN_LIMIT

    // 1. Long-term facts (most valuable — up to 10)
    const facts = this.getFacts().slice(-10)
    if (facts.length > 0) {
      const factsHeader = '[Facts about user]'
      const factLines   = facts.map(f => f.fact).join('\n')
      const block       = `${factsHeader}\n${factLines}`
      if (estimateTokens(block) <= tokenBudget) {
        parts.push(block)
        tokenBudget -= estimateTokens(block)
      }
    }

    // 2. Short-term messages (newest first, trim to budget)
    const recentMsgs = this.getRecentMessages(SHORT_TERM_MAX)
    if (recentMsgs.length > 0) {
      const header = '[Recent conversation]'
      parts.push(header)
      tokenBudget -= estimateTokens(header)

      // Walk newest→oldest but append in chronological order
      const selected: string[] = []
      for (let i = recentMsgs.length - 1; i >= 0; i--) {
        const m    = recentMsgs[i]
        const line = `${m.role === 'user' ? 'User' : 'DevOS'}: ${m.content}`
        const cost = estimateTokens(line)
        if (cost > tokenBudget) break
        selected.unshift(line)
        tokenBudget -= cost
      }
      parts.push(...selected)
    }

    return parts.join('\n')
  }

  // ── Utility ────────────────────────────────────────────────────────────

  clear(): void {
    this.ram = []
    saveStore({ facts: [] })
  }
}

export const conversationLayer = new ConversationLayer()
