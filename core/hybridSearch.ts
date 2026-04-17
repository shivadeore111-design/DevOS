// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/hybridSearch.ts — Weighted hybrid: semantic memory (0.6) + FTS (0.4).
//
// Combines:
//   1. semanticMemory.search()  — BM25 + vector, workspace/memory/*.md store
//   2. sessionSearch.searchSessions() — BM25 over workspace/sessions/*.md
//
// Scores are normalised to [0, 1] then merged with the weights above.
// Deduplication: if a result appears in both sources, the max normalised
// score is used (avoids double-counting).

import { semanticMemory }             from './semanticMemory'
import { searchSessions, SearchHit }  from './sessionSearch'

// ── Types ─────────────────────────────────────────────────────

export interface HybridHit {
  id:          string       // unique identifier (doc id or memory text hash)
  title:       string
  snippet:     string       // first 200 chars of content
  score:       number       // combined weighted score [0, 1]
  source:      'semantic' | 'session' | 'both'
}

export interface HybridSearchOptions {
  topK?:          number    // max results (default 5)
  semanticWeight?: number   // default 0.6
  ftsWeight?:     number    // default 0.4
}

// ── Normalise an array of scores to [0, 1] ────────────────────

function normalise(scores: number[]): number[] {
  const max = Math.max(...scores, 1e-9)
  return scores.map(s => s / max)
}

// ── Simple snippet extractor ──────────────────────────────────

function snippet(text: string, maxLen = 200): string {
  const s = text.replace(/\s+/g, ' ').trim()
  return s.length <= maxLen ? s : s.slice(0, maxLen) + '…'
}

// ── Main hybrid search ────────────────────────────────────────

/**
 * Hybrid search combining semantic memory and BM25 session search.
 *
 * @param query   Natural-language query
 * @param opts    Optional weight overrides and topK
 */
export function hybridSearch(query: string, opts: HybridSearchOptions = {}): HybridHit[] {
  const topK   = opts.topK ?? 5
  const wSem   = opts.semanticWeight ?? 0.6
  const wFts   = opts.ftsWeight      ?? 0.4
  const fetch  = topK * 3   // oversample before merging

  // ── 1. Semantic memory results ────────────────────────────────
  let semTexts: string[] = []
  try { semTexts = semanticMemory.searchText(query, fetch) } catch { /* ok */ }

  const semHits: Map<string, { title: string; snippet: string; rawScore: number; source: 'semantic' | 'both' }> = new Map()
  const semScores: number[] = semTexts.map((_, i) => Math.max(0, 1 - i / fetch))

  const normSem = normalise(semScores)
  semTexts.forEach((text, i) => {
    const id = `sem:${simpleHash(text)}`
    semHits.set(id, {
      title:    snippet(text, 60),
      snippet:  snippet(text),
      rawScore: normSem[i] * wSem,
      source:   'semantic',
    })
  })

  // ── 2. Session FTS results ────────────────────────────────────
  let ftsHits: SearchHit[] = []
  try { ftsHits = searchSessions(query, fetch) } catch { /* ok */ }

  const ftsScores   = ftsHits.map(h => h.score)
  const normFts     = normalise(ftsScores)
  const ftsMap: Map<string, { title: string; snippet: string; rawScore: number }> = new Map()
  ftsHits.forEach((h, i) => {
    ftsMap.set(`fts:${h.doc.id}`, {
      title:    h.doc.title,
      snippet:  snippet(h.doc.content),
      rawScore: normFts[i] * wFts,
    })
  })

  // ── 3. Merge ──────────────────────────────────────────────────
  const merged = new Map<string, HybridHit>()

  for (const [id, h] of semHits) {
    merged.set(id, { id, title: h.title, snippet: h.snippet, score: h.rawScore, source: 'semantic' })
  }

  for (const [id, h] of ftsMap) {
    if (merged.has(id)) {
      const existing = merged.get(id)!
      existing.score  = Math.max(existing.score, h.rawScore)
      existing.source = 'both'
    } else {
      merged.set(id, { id, title: h.title, snippet: h.snippet, score: h.rawScore, source: 'session' })
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

// ── Simple string hash for dedup ──────────────────────────────

function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < Math.min(s.length, 64); i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0
  }
  return (h >>> 0).toString(36)
}
