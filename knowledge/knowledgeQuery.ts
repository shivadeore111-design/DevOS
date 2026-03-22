// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// knowledge/knowledgeQuery.ts — Answers natural-language questions by
//   retrieving relevant knowledge entries and passing them to Ollama.

import { callOllama }   from "../llm/ollama"
import { knowledgeStore, KnowledgeEntry } from "./knowledgeStore"

const QUERY_MODEL    = "qwen2.5-coder:7b"
const MAX_SOURCES    = 3
const MAX_CONTENT_PER_SOURCE = 800  // chars per source sent to LLM

export interface QueryResult {
  answer:     string
  sources:    KnowledgeEntry[]
  confidence: number   // 0.0 – 1.0
}

export class KnowledgeQuery {

  async query(question: string): Promise<QueryResult> {
    const results = knowledgeStore.search(question, MAX_SOURCES)

    if (results.length === 0) {
      return {
        answer:     "No relevant knowledge found",
        sources:    [],
        confidence: 0,
      }
    }

    // Record access for ranking
    for (const r of results) {
      knowledgeStore.recordAccess(r.id)
    }

    // Build context block
    const context = results
      .map((r, i) =>
        `SOURCE ${i + 1} — "${r.title}" (${r.source})\n${r.content.slice(0, MAX_CONTENT_PER_SOURCE)}`
      )
      .join("\n\n---\n\n")

    const prompt =
      `You are a knowledge assistant. Answer the question below using ONLY the provided sources. ` +
      `Cite sources by number. If the sources don't contain enough information, say so.\n\n` +
      `Question: ${question}\n\n` +
      `Sources:\n${context}\n\n` +
      `Return a JSON object: { "answer": "...", "confidence": 0.0-1.0 }. ` +
      `Return ONLY valid JSON, no other text.`

    try {
      const raw    = await callOllama(prompt, undefined, QUERY_MODEL)
      const parsed = this._parseJson(raw)

      return {
        answer:     String(parsed?.answer ?? raw.trim()),
        sources:    results,
        confidence: typeof parsed?.confidence === "number"
                      ? Math.min(1, Math.max(0, parsed.confidence))
                      : 0.5,
      }
    } catch (err: any) {
      console.error(`[KnowledgeQuery] Query failed: ${err.message}`)
      return {
        answer:     "Error querying knowledge base",
        sources:    results,
        confidence: 0,
      }
    }
  }

  private _parseJson(text: string): any | null {
    try { return JSON.parse(text.trim()) } catch { /* fall through */ }
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try { return JSON.parse(match[0]) } catch { return null }
  }
}

export const knowledgeQuery = new KnowledgeQuery()
