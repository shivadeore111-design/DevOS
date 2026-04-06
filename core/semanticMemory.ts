// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/semanticMemory.ts — Local semantic memory with TF-IDF inspired
// word-level embeddings. No external API required — pure JS math.

import fs   from 'fs'
import path from 'path'
import { BM25 } from './bm25'

interface MemoryItem {
  id:        string
  text:      string
  embedding: number[]
  metadata: {
    type:       'exchange' | 'fact' | 'result' | 'entity'
    timestamp:  number
    tags?:      string[]
  }
}

const MEMORY_PATH = path.join(process.cwd(), 'workspace', 'semantic.json')

// ── Temporal decay helpers ────────────────────────────────────

const HALF_LIFE_DAYS = 30
const DECAY_LAMBDA   = Math.LN2 / HALF_LIFE_DAYS

type FusedResult = { item: MemoryItem; score: number }

function applyTemporalDecay(results: FusedResult[]): FusedResult[] {
  const now = Date.now()
  return results.map(r => {
    // Facts and entities are evergreen — never decay
    if (r.item.metadata.type === 'fact' || r.item.metadata.type === 'entity') {
      return r
    }
    const ageInDays    = (now - r.item.metadata.timestamp) / 86400000
    const multiplier   = Math.exp(-DECAY_LAMBDA * ageInDays)
    return { ...r, score: r.score * multiplier }
  }).sort((a, b) => b.score - a.score)
}

// ── MMR diversity re-ranking helpers ──────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().split(/\W+/).filter(t => t.length > 2)
  )
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter(x => b.has(x)))
  const union        = new Set([...a, ...b])
  return union.size === 0 ? 0 : intersection.size / union.size
}

function applyMMR(
  results:    FusedResult[],
  lambda      = 0.7,
  maxResults  = 10,
): FusedResult[] {
  if (results.length <= 1) return results

  const selected: FusedResult[] = []
  const remaining = [...results]

  // Always pick highest-scoring first
  selected.push(remaining.shift()!)

  while (selected.length < maxResults && remaining.length > 0) {
    let bestIdx   = 0
    let bestScore = -Infinity

    for (let i = 0; i < remaining.length; i++) {
      const relevance = remaining[i].score
      const maxSim    = Math.max(
        ...selected.map(s =>
          jaccardSimilarity(
            tokenize(remaining[i].item.text),
            tokenize(s.item.text),
          )
        )
      )
      const mmrScore = lambda * relevance - (1 - lambda) * maxSim
      if (mmrScore > bestScore) {
        bestScore = mmrScore
        bestIdx   = i
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0])
  }

  return selected
}

export class SemanticMemory {
  private data:           MemoryItem[] = []
  private bm25            = new BM25()
  private bm25IndexBuilt  = false

  constructor() {
    this.load()
  }

  // ── Persistence ───────────────────────────────────────────────

  private load(): void {
    try {
      if (fs.existsSync(MEMORY_PATH)) {
        this.data = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf-8')) as MemoryItem[]
      }
    } catch {}
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true })
      fs.writeFileSync(MEMORY_PATH, JSON.stringify(this.data, null, 2))
    } catch {}
  }

  // ── Embedding ─────────────────────────────────────────────────
  // TF-IDF inspired bag-of-words embedding into 128-dim space.
  // Uses polynomial rolling hash — similar topics yield similar vectors.

  private embed(text: string): number[] {
    const dim = 128
    const vec = new Array<number>(dim).fill(0)

    // Normalize and tokenize
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)

    // Remove stop words
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
      'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him',
      'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two',
      'way', 'who', 'did', 'let', 'put', 'say', 'she', 'too', 'use',
    ])

    const meaningful = words.filter(w => !stopWords.has(w))

    // Hash each word into vector space using polynomial rolling hash
    for (let wi = 0; wi < meaningful.length; wi++) {
      const word = meaningful[wi]
      let h1 = 0, h2 = 0
      for (let i = 0; i < word.length; i++) {
        const c = word.charCodeAt(i)
        h1 = (h1 * 31 + c) % dim
        h2 = (h2 * 37 + c) % dim
      }
      // Boost by word length — longer words carry more meaning
      const weight = Math.log(word.length + 1)
      vec[h1] += weight
      vec[h2] += weight * 0.5

      // Bigram context — captures phrase meaning
      if (wi > 0) {
        const prev = meaningful[wi - 1]
        let bh = 0
        for (let i = 0; i < prev.length && i < 4; i++) {
          bh = (bh * 41 + prev.charCodeAt(i)) % dim
        }
        vec[(h1 + bh) % dim] += 0.3
      }
    }

    // L2 normalize
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) + 1e-8
    return vec.map(v => v / mag)
  }

  private cosine(a: number[], b: number[]): number {
    let dot = 0
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
    return Math.max(0, Math.min(1, dot)) // already L2-normalized
  }

  // ── Public API ────────────────────────────────────────────────

  add(
    text:  string,
    type:  MemoryItem['metadata']['type'] = 'exchange',
    tags?: string[],
  ): void {
    if (!text.trim() || text.length < 10) return

    // Don't store duplicates
    const existing = this.data.find(d => d.text === text)
    if (existing) return

    const item: MemoryItem = {
      id:        `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text:      text.slice(0, 500),
      embedding: this.embed(text),
      metadata:  { type, timestamp: Date.now(), tags },
    }

    this.data.push(item)
    this.bm25IndexBuilt = false  // Sprint 14: invalidate BM25 index on new item

    // Keep max 500 items — remove oldest
    if (this.data.length > 500) {
      this.data = this.data
        .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)
        .slice(0, 500)
    }

    this.save()
  }

  // ── BM25 index builder ────────────────────────────────────────

  private buildBM25Index(): void {
    const texts = this.data.map(d => d.text)
    if (texts.length > 0) {
      this.bm25.index(texts)
      this.bm25IndexBuilt = true
    }
  }

  // ── Vector-only search ────────────────────────────────────────

  private vectorSearch(query: string, topK: number): Array<{ index: number }> {
    const qVec = this.embed(query)
    return this.data
      .map((item, index) => ({ index, score: this.cosine(qVec, item.embedding) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  // ── Hybrid search: BM25 + vector with reciprocal rank fusion ──

  search(query: string, topK = 5, minScore = 0.3): MemoryItem[] {
    if (this.data.length === 0) return []

    if (!this.bm25IndexBuilt) this.buildBM25Index()

    const fetch = topK * 2

    // BM25 reciprocal rank scores (weight 0.4)
    const bm25Results = this.bm25.search(query, fetch)
    const bm25Scores  = new Map<number, number>()
    bm25Results.forEach((r, rank) => bm25Scores.set(r.index, 1 / (rank + 1)))

    // Vector reciprocal rank scores (weight 0.6)
    const vectorResults = this.vectorSearch(query, fetch)
    const vectorScores  = new Map<number, number>()
    vectorResults.forEach((r, rank) => vectorScores.set(r.index, 1 / (rank + 1)))

    // Reciprocal rank fusion
    const allIndices = new Set([...bm25Scores.keys(), ...vectorScores.keys()])
    const fused = Array.from(allIndices)
      .map(idx => ({
        item:  this.data[idx],
        score: (bm25Scores.get(idx) || 0) * 0.4 + (vectorScores.get(idx) || 0) * 0.6,
      }))
      .filter(r => r.item && r.score >= minScore)
      .sort((a, b) => b.score - a.score)

    // Feature 4: temporal decay — recent memories rank higher
    const decayed = applyTemporalDecay(fused)

    // Feature 5: MMR diversity — prevent duplicate daily-note results
    const diverse = applyMMR(decayed, 0.7, topK)

    return diverse.map(r => r.item)
  }

  searchText(query: string, topK = 3): string[] {
    return this.search(query, topK).map(item => item.text)
  }

  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {}
    this.data.forEach(d => {
      byType[d.metadata.type] = (byType[d.metadata.type] || 0) + 1
    })
    return { total: this.data.length, byType }
  }
}

export const semanticMemory = new SemanticMemory()
