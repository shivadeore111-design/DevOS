// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// web/searchEngine.ts — DuckDuckGo Instant Answer API + fallback

import * as https        from "https"
import { researchCache } from "../research/researchCache"

const TIMEOUT_MS  = 10_000
const MAX_RESULTS = 5

export interface SearchResult {
  title:   string
  url:     string
  snippet: string
}

function ddgJsonFetch(query: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const path = `/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const options: https.RequestOptions = {
      hostname: "api.duckduckgo.com",
      port:     443,
      path,
      method:   "GET",
      headers:  { "User-Agent": "DevOS/1.0 (research bot)" },
      timeout:  TIMEOUT_MS,
    }
    const req = https.request(options, res => {
      let data = ""
      res.setEncoding("utf-8")
      res.on("data", chunk => { data += chunk })
      res.on("end",  () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error("Failed to parse DDG JSON")) }
      })
      res.on("error", reject)
    })
    req.on("timeout", () => { req.destroy(); reject(new Error("DDG request timed out")) })
    req.on("error", reject)
    req.end()
  })
}

function ddgLiteFetch(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const path = `/lite/?q=${encodeURIComponent(query)}&kl=us-en`
    const options: https.RequestOptions = {
      hostname: "lite.duckduckgo.com",
      port:     443,
      path,
      method:   "GET",
      headers:  {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept":     "text/html",
      },
      timeout:  TIMEOUT_MS,
    }
    const req = https.request(options, res => {
      let html = ""
      res.setEncoding("utf-8")
      res.on("data", chunk => { html += chunk })
      res.on("end",  () => resolve(html))
      res.on("error", reject)
    })
    req.on("timeout", () => { req.destroy(); reject(new Error("DDG lite timed out")) })
    req.on("error", reject)
    req.end()
  })
}

function parseLiteResults(html: string): SearchResult[] {
  const results: SearchResult[] = []
  const rowRe = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = rowRe.exec(html)) !== null && results.length < MAX_RESULTS) {
    let u = m[1]
    if (!u.startsWith("http")) continue
    if (u.includes("duckduckgo.com")) continue
    results.push({ title: m[2].trim(), url: u, snippet: "" })
  }
  return results
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  const cacheKey = `search:${query.toLowerCase().trim()}`
  const cached   = researchCache.get(cacheKey)
  if (cached) {
    console.log(`[SearchEngine] Cache hit for: "${query}"`)
    return cached.results as SearchResult[]
  }

  console.log(`[SearchEngine] Searching DDG: "${query}"`)

  // Try JSON API first
  try {
    const data = await ddgJsonFetch(query)
    const results: SearchResult[] = []

    // Abstract + RelatedTopics
    if (data.Abstract && data.AbstractURL) {
      results.push({
        title:   data.Heading || query,
        url:     data.AbstractURL,
        snippet: data.AbstractText || "",
      })
    }
    if (Array.isArray(data.RelatedTopics)) {
      for (const t of data.RelatedTopics) {
        if (results.length >= MAX_RESULTS) break
        if (t.FirstURL && t.Text) {
          results.push({ title: t.Text.slice(0, 80), url: t.FirstURL, snippet: t.Text })
        }
      }
    }

    if (results.length > 0) {
      console.log(`[SearchEngine] Found ${results.length} results (JSON API)`)
      researchCache.set(cacheKey, query, results, undefined, 6 * 60 * 60 * 1000)
      return results
    }
  } catch (err: any) {
    console.log(`[SearchEngine] JSON API failed: ${err.message} — trying lite`)
  }

  // Fallback to lite.duckduckgo.com
  try {
    const html    = await ddgLiteFetch(query)
    const results = parseLiteResults(html)
    console.log(`[SearchEngine] Found ${results.length} results (lite)`)
    researchCache.set(cacheKey, query, results, undefined, 6 * 60 * 60 * 1000)
    return results
  } catch (err: any) {
    console.error(`[SearchEngine] All search methods failed: ${err.message}`)
    return []
  }
}

export class SearchEngine {
  search(query: string): Promise<SearchResult[]> { return webSearch(query) }
}
export const searchEngine = new SearchEngine()

