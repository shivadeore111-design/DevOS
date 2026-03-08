// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// webActions.ts — DevOS Web Action Executor
// Uses Node built-in https — no external deps
// ============================================================

import https from "https";
import http  from "http";
import { fetchPage }  from "../../web/pageFetcher";
import { webSearch }  from "../../web/searchEngine";

export interface WebActionResult {
  success: boolean;
  output?: any;
  error?: string;
}

function httpGet(url: string, timeoutMs = 15000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const lib     = url.startsWith("https") ? https : http;
    const timeout = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);

    lib.get(url, (res) => {
      let body = "";
      res.on("data", chunk => { body += chunk; });
      res.on("end",  () => {
        clearTimeout(timeout);
        resolve({ status: res.statusCode ?? 0, body });
      });
    }).on("error", err => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export async function executeWebAction(action: any): Promise<WebActionResult> {
  try {
    switch (action.type) {

      case "web_fetch": {
        const targetUrl = action.url as string;
        if (!targetUrl) return { success: false, error: "No URL provided" };

        console.log(`[WebActions] Fetching: ${targetUrl}`);
        const result = await fetchPage(targetUrl);

        return {
          success: result.success,
          output:  { url: targetUrl, statusCode: result.statusCode, text: result.text ?? "" },
          error:   result.success ? undefined : result.error,
        };
      }

      case "web_search": {
        const query = action.query as string;
        if (!query) return { success: false, error: "No query provided" };

        console.log(`[WebActions] Searching: ${query}`);
        const results = await webSearch(query);

        return {
          success: true,
          output:  { query, results, count: results.length },
        };
      }

      default:
        return { success: false, error: `Unknown web action type: ${action.type}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
