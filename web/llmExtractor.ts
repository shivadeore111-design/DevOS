// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// web/llmExtractor.ts — Uses local Ollama to extract structured data from HTML.
//                        Pre-processes HTML to pull real external URLs before
//                        sending to LLM, dramatically improving accuracy.

import { callOllama }   from "../llm/ollama"
import { SearchResult } from "./searchEngine"

const EXTRACT_MODEL = "qwen2.5-coder:7b"
const HTML_TRUNC    = 6_000
const MAX_RESULTS   = 8

// Domains to exclude when harvesting external links from search engines
const SEARCH_ENGINE_DOMAINS = [
  "bing.com", "microsoft.com", "msn.com",
  "google.com", "gstatic.com", "googleadservices.com", "googlesyndication.com",
  "duckduckgo.com", "yahoo.com", "baidu.com",
  "amazon-adsystem.com", "doubleclick.net",
]

export class LLMExtractor {

  /**
   * Extracts search results from HTML.
   * Step 1: Pre-parse all external <a href> links from the HTML.
   * Step 2: Send those URLs + query to Ollama for structured extraction.
   * Returns up to MAX_RESULTS items.
   */
  async extractSearchResults(html: string, query: string): Promise<SearchResult[]> {
    // ── Pre-extract external URLs ─────────────────────────────
    const externalUrls = this._extractExternalLinks(html)
    console.log(`[LLMExtractor] Pre-extracted ${externalUrls.length} external URLs from HTML`)

    let prompt: string

    if (externalUrls.length > 0) {
      const urlList = externalUrls.slice(0, 30).join("\n")
      prompt =
        `Here are the external links found:\n${urlList}\n\n` +
        `Extract search results matching query: ${query}. ` +
        `Return JSON array of {title, url, snippet} using ONLY these real URLs. ` +
        `Return only valid JSON, no other text.`
    } else {
      // Fallback: send raw HTML (truncated) when no links found
      const truncated = html.slice(0, HTML_TRUNC)
      prompt =
        `Extract search results from this HTML. Return JSON array of {title, url, snippet}. ` +
        `Query was: ${query}. Return only valid JSON array, no other text.\n\n` +
        `HTML:\n${truncated}`
    }

    try {
      const raw    = await callOllama(prompt, undefined, EXTRACT_MODEL)
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

  /**
   * Scans HTML for all <a href="..."> attributes where:
   *  - href starts with "http"
   *  - hostname is NOT a known search-engine / ad domain
   * Returns deduplicated list of URLs.
   */
  private _extractExternalLinks(html: string): string[] {
    const seen  = new Set<string>()
    const links: string[] = []
    const hrefRe = /href=["']([^"']+)["']/gi
    let m: RegExpExecArray | null

    while ((m = hrefRe.exec(html)) !== null) {
      const url = m[1]
      if (!url.startsWith("http")) continue
      if (seen.has(url))           continue

      // Filter out search engine / ad domains
      try {
        const host = new URL(url).hostname.toLowerCase()
        if (SEARCH_ENGINE_DOMAINS.some(d => host === d || host.endsWith("." + d))) continue
      } catch {
        continue
      }

      seen.add(url)
      links.push(url)
    }

    return links
  }

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
