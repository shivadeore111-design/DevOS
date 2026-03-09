// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// web/llmExtractor.ts — Uses local Ollama to extract structured data from HTML

import { callOllama }  from "../llm/ollama"
import { SearchResult } from "./searchEngine"

const EXTRACT_MODEL   = "qwen2.5-coder:7b"
const HTML_TRUNC      = 6_000
const MAX_RESULTS     = 8

export class LLMExtractor {

  /**
   * Sends truncated HTML + query to Ollama and extracts structured search results.
   * Returns up to MAX_RESULTS items.
   */
  async extractSearchResults(html: string, query: string): Promise<SearchResult[]> {
    const truncated = html.slice(0, HTML_TRUNC)
    const prompt    =
      `Extract search results from this HTML. Return JSON array of {title, url, snippet}. ` +
      `Query was: ${query}. Return only valid JSON array, no other text.\n\n` +
      `HTML:\n${truncated}`

    try {
      const raw = await callOllama(prompt, undefined, EXTRACT_MODEL)
      const parsed = this._parseJsonArray(raw)
      if (!Array.isArray(parsed)) return []

      return parsed
        .filter((r: any) => r && typeof r.url === "string" && r.url.startsWith("http"))
        .slice(0, MAX_RESULTS)
        .map((r: any) => ({
          title:   String(r.title   ?? "").trim(),
          url:     String(r.url     ?? "").trim(),
          snippet: String(r.snippet ?? "").trim(),
        }))
    } catch (err: any) {
      console.error(`[LLMExtractor] extractSearchResults failed: ${err.message}`)
      return []
    }
  }

  /**
   * General-purpose extraction — sends HTML + instructions to Ollama.
   * Returns the extracted text string.
   */
  async extractContent(html: string, instructions: string): Promise<string> {
    const truncated = html.slice(0, HTML_TRUNC)
    const prompt    = `${instructions}\n\nHTML content:\n${truncated}`

    try {
      return await callOllama(prompt, undefined, EXTRACT_MODEL)
    } catch (err: any) {
      console.error(`[LLMExtractor] extractContent failed: ${err.message}`)
      return ""
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  private _parseJsonArray(text: string): any[] | null {
    // Try direct parse first
    try {
      const parsed = JSON.parse(text.trim())
      if (Array.isArray(parsed)) return parsed
      return null
    } catch { /* fall through */ }

    // Try to extract a JSON array from within surrounding text
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return null
    try {
      const parsed = JSON.parse(match[0])
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
}

export const llmExtractor = new LLMExtractor()
