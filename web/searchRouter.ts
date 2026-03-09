// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// web/searchRouter.ts — Tries multiple search strategies in priority order

import { webSearch, SearchResult } from "./searchEngine"
import { browserFetcher }          from "./browserFetcher"
import { llmExtractor }            from "./llmExtractor"
import { callOllama }              from "../llm/ollama"

export interface RouterResult {
  results: SearchResult[]
  engine:  string
  method:  "http" | "browser" | "llm" | "rss"
}

export class SearchRouter {

  async search(query: string): Promise<RouterResult> {
    // ── 1. HTTP attempt via existing searchEngine ─────────────
    console.log(`[SearchRouter] Trying HTTP search...`)
    try {
      const results = await webSearch(query)
      if (results.length > 0) {
        console.log(`[SearchRouter] ✅ DuckDuckGo HTTP (${results.length} results)`)
        return { results, engine: "DuckDuckGo", method: "http" }
      }
    } catch (err: any) {
      console.log(`[SearchRouter] HTTP search failed: ${err.message}`)
    }

    // ── 2. Browser + LLM — Bing ───────────────────────────────
    console.log(`[SearchRouter] Trying Bing browser...`)
    try {
      const bingUrl    = `https://www.bing.com/search?q=${encodeURIComponent(query)}`
      const pageResult = await browserFetcher.fetch(bingUrl, { timeout: 20_000 })
      if (pageResult.success && pageResult.html) {
        const results = await llmExtractor.extractSearchResults(pageResult.html, query)
        if (results.length > 0) {
          console.log(`[SearchRouter] ✅ Bing browser (${results.length} results)`)
          return { results, engine: "Bing", method: "browser" }
        }
      }
    } catch (err: any) {
      console.log(`[SearchRouter] Bing browser failed: ${err.message}`)
    }

    // ── 3. Browser + LLM — Google ────────────────────────────
    console.log(`[SearchRouter] Trying Google browser...`)
    try {
      const googleUrl  = `https://www.google.com/search?q=${encodeURIComponent(query)}`
      const pageResult = await browserFetcher.fetch(googleUrl, { timeout: 20_000 })
      if (pageResult.success && pageResult.html) {
        const results = await llmExtractor.extractSearchResults(pageResult.html, query)
        if (results.length > 0) {
          console.log(`[SearchRouter] ✅ Google browser (${results.length} results)`)
          return { results, engine: "Google", method: "browser" }
        }
      }
    } catch (err: any) {
      console.log(`[SearchRouter] Google browser failed: ${err.message}`)
    }

    // ── 4. LLM fallback — Ollama knowledge ───────────────────
    console.log(`[SearchRouter] Trying LLM fallback...`)
    try {
      const prompt =
        `You are a research assistant. List 5 real URLs and descriptions for: ${query}. ` +
        `Return JSON array of {title, url, snippet}. No other text.`

      const raw     = await callOllama(prompt)
      const results = this._parseFallbackResults(raw)

      if (results.length > 0) {
        console.log(`[SearchRouter] ✅ LLM fallback (${results.length} results)`)
        return { results, engine: "LLM", method: "llm" }
      }
    } catch (err: any) {
      console.log(`[SearchRouter] LLM fallback failed: ${err.message}`)
    }

    // ── Nothing worked ────────────────────────────────────────
    console.log(`[SearchRouter] ⚠️  All search methods exhausted — returning empty`)
    return { results: [], engine: "none", method: "llm" }
  }

  // ── Helpers ───────────────────────────────────────────────

  private _parseFallbackResults(text: string): SearchResult[] {
    try {
      const match = text.match(/\[[\s\S]*\]/)
      if (!match) return []
      const parsed = JSON.parse(match[0])
      if (!Array.isArray(parsed)) return []
      return parsed
        .filter((r: any) => r && typeof r.url === "string")
        .slice(0, 8)
        .map((r: any) => ({
          title:   String(r.title   ?? "").trim(),
          url:     String(r.url     ?? "").trim(),
          snippet: String(r.snippet ?? "").trim(),
        }))
    } catch {
      return []
    }
  }
}

export const searchRouter = new SearchRouter()
