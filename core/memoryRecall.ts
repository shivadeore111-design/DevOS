// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/memoryRecall.ts — Sprint 21: Proactive Memory Surfacing
//
// Silently recalls relevant context from all memory layers before
// every response. Injected into the system prompt so Aiden feels
// like it knows the user — without the user having to re-explain.

import { conversationMemory } from './conversationMemory'
import { semanticMemory }     from './semanticMemory'
import { entityGraph }        from './entityGraph'
import { knowledgeBase }      from './knowledgeBase'

// ── Types ─────────────────────────────────────────────────────

export interface RecalledContext {
  relevant: string[]
  entities: string[]
  source:   string
}

// ── Main recall function ───────────────────────────────────────

export async function unifiedMemoryRecall(
  query: string,
  topK  = 5,
): Promise<RecalledContext> {
  const results:  string[] = []
  const entities: string[] = []

  // 1. Semantic memory — hybrid BM25 + vector search
  try {
    const semantic = semanticMemory.search(query, topK)
    for (const item of semantic.slice(0, 3)) {
      if (item.text) results.push(item.text.slice(0, 200))
    }
  } catch {}

  // 2. Entity graph — extract named entities from query and expand
  try {
    const queryEntities = query.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || []
    for (const entity of queryEntities.slice(0, 3)) {
      const related = entityGraph.getRelated(entity, 2)
      if (related.length > 0) {
        // getRelated returns strings like "name (relation)"
        entities.push(`${entity}: ${related.join(', ')}`)
      }
    }
  } catch {}

  // 3. Knowledge base — BM25 + vector hybrid search
  try {
    const kb = knowledgeBase.search(query, 2)
    for (const chunk of kb) {
      if (chunk.text) results.push(chunk.text.slice(0, 200))
    }
  } catch {}

  // 4. Recent conversation — pull relevant exchanges
  try {
    const recent = conversationMemory.getRecentHistory()
    const queryWords = new Set(
      query.toLowerCase().split(/\s+/).filter(w => w.length > 4),
    )
    const relevant = recent.filter(ex => {
      const combined = `${ex.userMessage} ${ex.aiReply}`.toLowerCase()
      return [...queryWords].some(w => combined.includes(w))
    })
    for (const ex of relevant.slice(0, 2)) {
      if (ex.userMessage) {
        results.push(`Previously: ${ex.userMessage.slice(0, 150)}`)
      }
    }
  } catch {}

  return {
    relevant: [...new Set(results)].slice(0, topK),
    entities,
    source: 'unified_recall',
  }
}

// ── Prompt injection builder ───────────────────────────────────

export function buildMemoryInjection(recalled: RecalledContext): string {
  if (recalled.relevant.length === 0 && recalled.entities.length === 0) return ''

  const parts: string[] = []

  if (recalled.entities.length > 0) {
    parts.push(`Known context:\n${recalled.entities.map(e => `  - ${e}`).join('\n')}`)
  }

  if (recalled.relevant.length > 0) {
    parts.push(`Relevant memory:\n${recalled.relevant.map(r => `  - ${r}`).join('\n')}`)
  }

  return `\n\n[MEMORY CONTEXT — use naturally, do not mention these are memories]\n${parts.join('\n')}\n`
}
