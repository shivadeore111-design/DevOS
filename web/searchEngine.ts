// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// web/searchEngine.ts — DuckDuckGo HTML scraper

import * as https        from "https";
import * as url          from "url";
import { researchCache } from "../research/researchCache";

const DDG_HOST    = "html.duckduckgo.com";
const DDG_PATH    = "/html/";
const TIMEOUT_MS  = 10_000;
const MAX_RESULTS = 5;

export interface SearchResult {
  title:   string;
  url:     string;
  snippet: string;
}

// ── DuckDuckGo raw fetch ──────────────────────────────────

function ddgFetch(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = `q=${encodeURIComponent(query)}&kl=us-en`;

    const options: https.RequestOptions = {
      hostname: DDG_HOST,
      port:     443,
      path:     DDG_PATH,
      method:   "POST",
      headers: {
        "Content-Type":   "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent":     "DevOS/1.0 (research bot)",
        "Accept":         "text/html",
      },
      timeout: TIMEOUT_MS,
    };

    const req = https.request(options, res => {
      if ((res.statusCode ?? 0) >= 400) {
        res.resume();
        reject(new Error(`DDG responded with HTTP ${res.statusCode}`));
        return;
      }

      let html = "";
      res.setEncoding("utf-8");
      res.on("data", chunk => { html += chunk; });
      res.on("end",  () => resolve(html));
      res.on("error", reject);
    });

    req.on("timeout", () => { req.destroy(); reject(new Error("DDG request timed out")); });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── HTML parser for DDG results ───────────────────────────

function parseDDGResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // DDG HTML structure: <div class="result__body"> or <div class="results_links">
  // Title: <a class="result__a" href="...">Title</a>
  // Snippet: <a class="result__snippet">...</a>

  const resultBlockRe = /<div class="result__body">([\s\S]*?)<\/div>\s*<\/div>/gi;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = resultBlockRe.exec(html)) !== null && results.length < MAX_RESULTS) {
    const block = blockMatch[1];

    // Extract URL
    const hrefMatch = /href="([^"]+)"/.exec(block);
    if (!hrefMatch) continue;
    let resultUrl = hrefMatch[1];

    // DDG uses redirect URLs like //duckduckgo.com/l/?uddg=...
    const uddgMatch = /uddg=([^&"]+)/.exec(resultUrl);
    if (uddgMatch) {
      try { resultUrl = decodeURIComponent(uddgMatch[1]); } catch { continue; }
    }
    if (!resultUrl.startsWith("http")) continue;

    // Extract title
    const titleMatch = /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
      : resultUrl;

    // Extract snippet
    const snippetMatch = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      : "";

    results.push({ title, url: resultUrl, snippet });
  }

  // Fallback: simpler regex if structured blocks weren't found
  if (results.length === 0) {
    const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null && results.length < MAX_RESULTS) {
      let resultUrl = m[1];
      const uddgMatch = /uddg=([^&"]+)/.exec(resultUrl);
      if (uddgMatch) {
        try { resultUrl = decodeURIComponent(uddgMatch[1]); } catch { continue; }
      }
      if (!resultUrl.startsWith("http")) continue;
      const title = m[2].replace(/<[^>]+>/g, "").trim();
      results.push({ title, url: resultUrl, snippet: "" });
    }
  }

  return results;
}

// ── Public API ────────────────────────────────────────────

export async function webSearch(query: string): Promise<SearchResult[]> {
  const cacheKey = `search:${query.toLowerCase().trim()}`;
  const cached   = researchCache.get(cacheKey);

  if (cached) {
    console.log(`[SearchEngine] Cache hit for: "${query}"`);
    return cached.results as SearchResult[];
  }

  console.log(`[SearchEngine] Searching DDG: "${query}"`);

  try {
    const html    = await ddgFetch(query);
    const results = parseDDGResults(html);

    console.log(`[SearchEngine] Found ${results.length} results for: "${query}"`);

    researchCache.set(cacheKey, query, results, undefined, 6 * 60 * 60 * 1000); // 6h TTL
    return results;

  } catch (err: any) {
    console.error(`[SearchEngine] Error: ${err.message}`);
    return [];
  }
}
