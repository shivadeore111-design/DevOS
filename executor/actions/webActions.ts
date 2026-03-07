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
        const url = action.url as string;
        if (!url) return { success: false, error: "No URL provided" };

        console.log(`[WebActions] Fetching: ${url}`);
        const { status, body } = await httpGet(url);
        const ok = status >= 200 && status < 300;

        return {
          success: ok,
          output:  { url, status, body: body.substring(0, 5000) },
          error:   ok ? undefined : `HTTP ${status}`,
        };
      }

      case "web_search": {
        // Local stub — no external search API
        console.log(`[WebActions] Search query: ${action.query}`);
        return {
          success: true,
          output:  {
            query: action.query,
            note:  "Web search not available in local mode. Wire a local search tool if needed.",
          },
        };
      }

      default:
        return { success: false, error: `Unknown web action type: ${action.type}` };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
