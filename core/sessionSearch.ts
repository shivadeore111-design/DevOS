// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/sessionSearch.ts — BM25 full-text index over workspace session files.
//
// Indexes workspace/sessions/*.md and workspace/memory/*.md on first call,
// then incrementally re-indexes any files newer than the last rebuild.
// Exposes searchSessions(query, topK) for synchronous ranked results.
//
// BM25 parameters:  k1=1.5  b=0.75  (standard defaults)

import fs   from 'fs'
import path from 'path'

// ── Types ─────────────────────────────────────────────────────

export interface SessionDoc {
  id:       string   // file basename without extension
  path:     string   // absolute path
  title:    string   // first H1 or filename
  content:  string   // raw text
  mtime:    number   // last-modified timestamp (ms)
}

export interface SearchHit {
  doc:   SessionDoc
  score: number
}

// ── BM25 index ────────────────────────────────────────────────

interface BM25Index {
  docs:   SessionDoc[]
  tf:     Map<string, number>[]   // tf[docIdx][term] = raw count
  df:     Map<string, number>     // df[term] = number of docs containing term
  avgdl:  number
  built:  number                  // timestamp (ms) when built
}

const K1 = 1.5
const B  = 0.75

let _index: BM25Index | null = null

// ── Tokenizer ─────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1)
}

// ── Index builder ─────────────────────────────────────────────

function getSessionDirs(): string[] {
  const base = process.cwd()
  return [
    path.join(base, 'workspace', 'sessions'),
    path.join(base, 'workspace', 'memory'),
  ]
}

function loadDocuments(): SessionDoc[] {
  const docs: SessionDoc[] = []
  for (const dir of getSessionDirs()) {
    if (!fs.existsSync(dir)) continue
    let entries: string[]
    try { entries = fs.readdirSync(dir) } catch { continue }
    for (const fname of entries) {
      if (!fname.endsWith('.md') && !fname.endsWith('.json')) continue
      const fpath = path.join(dir, fname)
      let raw = ''
      try { raw = fs.readFileSync(fpath, 'utf-8') } catch { continue }
      let content = raw
      // For JSON, stringify to searchable text
      if (fname.endsWith('.json')) {
        try { content = JSON.stringify(JSON.parse(raw), null, 1) } catch { /* keep raw */ }
      }
      const stat   = fs.statSync(fpath)
      const firstH1 = raw.match(/^#\s+(.+)$/m)?.[1] ?? fname.replace(/\.\w+$/, '')
      docs.push({
        id:      fname.replace(/\.\w+$/, ''),
        path:    fpath,
        title:   firstH1.trim(),
        content,
        mtime:   stat.mtimeMs,
      })
    }
  }
  return docs
}

function buildIndex(docs: SessionDoc[]): BM25Index {
  const tf: Map<string, number>[] = []
  const df = new Map<string, number>()
  let totalLen = 0

  for (const doc of docs) {
    const tokens = tokenize(doc.content)
    totalLen += tokens.length
    const counts = new Map<string, number>()
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1)
    tf.push(counts)
    for (const term of counts.keys()) df.set(term, (df.get(term) ?? 0) + 1)
  }

  return {
    docs,
    tf,
    df,
    avgdl: docs.length ? totalLen / docs.length : 1,
    built: Date.now(),
  }
}

/** Rebuild index from disk. */
export function rebuildIndex(): BM25Index {
  const docs = loadDocuments()
  _index = buildIndex(docs)
  return _index
}

/** Get or lazily build the index. Rebuilds if > 5 minutes old. */
export function getIndex(): BM25Index {
  if (!_index || Date.now() - _index.built > 5 * 60 * 1000) {
    _index = rebuildIndex()
  }
  return _index
}

// ── BM25 scoring ─────────────────────────────────────────────

function bm25Score(
  idx:    BM25Index,
  docI:   number,
  query:  string[],
): number {
  const N   = idx.docs.length
  const dl  = Array.from(idx.tf[docI].values()).reduce((a, b) => a + b, 0)
  let score = 0
  for (const term of query) {
    const freq = idx.tf[docI].get(term) ?? 0
    if (freq === 0) continue
    const df  = idx.df.get(term) ?? 0
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1)
    const tf  = (freq * (K1 + 1)) / (freq + K1 * (1 - B + B * (dl / idx.avgdl)))
    score += idf * tf
  }
  return score
}

// ── Public search API ─────────────────────────────────────────

/**
 * Full-text BM25 search over indexed session/memory files.
 * @param query  Natural-language query string
 * @param topK   Maximum results to return (default 5)
 * @returns      Hits sorted by descending BM25 score
 */
export function searchSessions(query: string, topK = 5): SearchHit[] {
  const idx    = getIndex()
  if (!idx.docs.length) return []
  const tokens = tokenize(query)
  if (!tokens.length) return []

  const scored = idx.docs.map((doc, i) => ({
    doc,
    score: bm25Score(idx, i, tokens),
  }))

  return scored
    .filter(h => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/** Returns the number of indexed documents. */
export function getIndexSize(): number {
  return getIndex().docs.length
}
