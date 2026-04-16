// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/toolNameRepair.ts — Phase 2: Fuzzy tool name auto-repair.
//
// LLMs occasionally hallucinate tool names that are close but not exact
// (e.g., "web_search_1", "file_write.exec", "getStocks", "deepResearch").
// This module catches those mutations and silently maps them to the real name.
//
// Zero new dependencies — pure TypeScript with standard DP Levenshtein.
//
// Usage:
//   const repair = repairToolName('web_search_1', VALID_TOOLS)
//   // => { original: 'web_search_1', repaired: 'web_search', distance: 2 }

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RepairResult {
  original: string
  repaired: string
  /** Levenshtein distance after normalization — 0 means the normalized name matched exactly. */
  distance: number
}

// ── Levenshtein distance ──────────────────────────────────────────────────────

export function lev(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

// ── Normalization ─────────────────────────────────────────────────────────────
// Strip common hallucination suffixes/patterns that LLMs append to tool names.

const SUFFIX_PATTERNS = [
  /_\d+$/,                     // web_search_1, file_write_2
  /\.(exec|run|call|tool)$/i,  // file_write.exec
  /_(exec|run|call|tool|v\d+)$/i,  // shell_exec_run, web_search_v2
]

const CAMEL_TO_SNAKE_RE = /([A-Z])/g

export function normalize(name: string): string {
  let s = name.trim()

  // camelCase → snake_case: getStocks → get_stocks, deepResearch → deep_research
  s = s.replace(CAMEL_TO_SNAKE_RE, '_$1').toLowerCase().replace(/^_/, '')

  // strip known hallucination suffixes
  for (const pattern of SUFFIX_PATTERNS) {
    s = s.replace(pattern, '')
  }

  return s
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Try to map a hallucinated/corrupted tool name to the closest valid tool.
 *
 * @param name        - The tool name the LLM produced
 * @param validTools  - Authoritative list of valid tool names
 * @returns A RepairResult if a match within threshold was found; null otherwise
 */
export function repairToolName(name: string, validTools: string[]): RepairResult | null {
  if (validTools.includes(name)) return null  // already valid — nothing to do

  const normalized = normalize(name)

  // Exact match after normalization (e.g. getStocks → get_stocks)
  if (validTools.includes(normalized)) {
    return { original: name, repaired: normalized, distance: 0 }
  }

  // Fuzzy match: find the closest valid tool within the edit-distance threshold
  // Threshold scales with name length: max(2, floor(len * 0.3))
  const threshold = Math.max(2, Math.floor(normalized.length * 0.3))

  let best: { repaired: string; distance: number } | null = null

  for (const valid of validTools) {
    const d = lev(normalized, valid)
    if (d <= threshold && (!best || d < best.distance)) {
      best = { repaired: valid, distance: d }
    }
  }

  if (!best) return null

  return { original: name, repaired: best.repaired, distance: best.distance }
}
