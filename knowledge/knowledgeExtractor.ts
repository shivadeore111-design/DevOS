// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// knowledge/knowledgeExtractor.ts — Uses Ollama to pull structured knowledge
//   from a parsed document.

import { callOllama }    from "../llm/ollama"
import { ParsedDocument } from "./documentParser"

const EXTRACT_MODEL = "qwen2.5-coder:7b"
const MAX_CONTENT   = 4_000   // chars sent to LLM per extraction

export interface ExtractionResult {
  title:         string
  summary:       string
  keyFacts:      string[]
  tags:          string[]
  relatedTopics: string[]
}

const FALLBACK: ExtractionResult = {
  title:         "Unknown",
  summary:       "",
  keyFacts:      [],
  tags:          [],
  relatedTopics: [],
}

export class KnowledgeExtractor {

  /**
   * Extracts structured knowledge metadata from a parsed document.
   * Uses the first MAX_CONTENT chars of the document content.
   */
  async extract(document: ParsedDocument, goal?: string): Promise<ExtractionResult> {
    const content   = document.content.slice(0, MAX_CONTENT)
    const goalHint  = goal ? `\nThe user is interested in: "${goal}".` : ""

    const prompt =
      `Extract key knowledge from this document. ` +
      `Return JSON with: title (string), summary (2-3 sentence string), ` +
      `keyFacts (array of 5 important facts), tags (array of topic tags), ` +
      `relatedTopics (array of related subjects). ` +
      `Return ONLY valid JSON, no other text.${goalHint}\n\nDocument:\n${content}`

    try {
      const raw    = await callOllama(prompt, undefined, EXTRACT_MODEL)
      const parsed = this._parseJson(raw)
      if (!parsed) {
        console.warn("[KnowledgeExtractor] LLM returned unparseable JSON — using fallback")
        return { ...FALLBACK, title: document.title }
      }
      return {
        title:         String(parsed.title         ?? document.title),
        summary:       String(parsed.summary        ?? ""),
        keyFacts:      Array.isArray(parsed.keyFacts)      ? parsed.keyFacts.map(String)      : [],
        tags:          Array.isArray(parsed.tags)           ? parsed.tags.map(String)           : [],
        relatedTopics: Array.isArray(parsed.relatedTopics)  ? parsed.relatedTopics.map(String)  : [],
      }
    } catch (err: any) {
      console.error(`[KnowledgeExtractor] Extraction failed: ${err.message}`)
      return { ...FALLBACK, title: document.title }
    }
  }

  // ── Private ───────────────────────────────────────────────

  private _parseJson(text: string): any | null {
    try {
      return JSON.parse(text.trim())
    } catch { /* fall through */ }

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null

    try { return JSON.parse(match[0]) } catch { return null }
  }
}

export const knowledgeExtractor = new KnowledgeExtractor()
