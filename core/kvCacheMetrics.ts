// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// core/kvCacheMetrics.ts — KV-cache hit rate tracking
//
// A "hit"  = the system prompt bytes were identical to the previous call.
// A "miss" = different bytes were sent → Ollama re-runs full prefill.
//
// Metrics are persisted to workspace/metrics.json after every call.

import * as fs   from "fs"
import * as path from "path"

const METRICS_FILE = path.join(process.cwd(), "workspace", "metrics.json")

export interface KVMetrics {
  sessionStart:  string
  ollamaCalls:   number
  cacheHits:     number
  cacheMisses:   number
  lastPromptHash: string | null
}

function loadMetrics(): KVMetrics {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      return JSON.parse(fs.readFileSync(METRICS_FILE, "utf-8")) as KVMetrics
    }
  } catch { /* ignore */ }
  return {
    sessionStart:   new Date().toISOString(),
    ollamaCalls:    0,
    cacheHits:      0,
    cacheMisses:    0,
    lastPromptHash: null,
  }
}

function saveMetrics(m: KVMetrics): void {
  try {
    const dir = path.dirname(METRICS_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(METRICS_FILE, JSON.stringify(m, null, 2), "utf-8")
  } catch { /* non-fatal */ }
}

// Simple FNV-1a hash — fast and deterministic, no crypto dependency
function hashString(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h.toString(16)
}

class KVCacheMetrics {
  /**
   * Record one Ollama call.
   * @param systemPrompt — the system prompt bytes sent to Ollama this call
   */
  record(systemPrompt: string): void {
    const m    = loadMetrics()
    const hash = hashString(systemPrompt)

    m.ollamaCalls++

    if (m.lastPromptHash === null || m.lastPromptHash !== hash) {
      m.cacheMisses++
    } else {
      m.cacheHits++
    }

    m.lastPromptHash = hash
    saveMetrics(m)
  }

  /**
   * Return current metrics from disk.
   */
  get(): KVMetrics {
    return loadMetrics()
  }

  /**
   * Return hit rate as a float 0.0–1.0.
   */
  hitRate(): number {
    const m = loadMetrics()
    if (m.ollamaCalls === 0) return 0
    return m.cacheHits / m.ollamaCalls
  }

  /**
   * Reset metrics (e.g. at session start).
   */
  reset(): void {
    saveMetrics({
      sessionStart:   new Date().toISOString(),
      ollamaCalls:    0,
      cacheHits:      0,
      cacheMisses:    0,
      lastPromptHash: null,
    })
  }
}

export const kvCacheMetrics = new KVCacheMetrics()
