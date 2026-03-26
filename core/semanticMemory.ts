// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/semanticMemory.ts — Local semantic memory with TF-IDF inspired
// word-level embeddings. No external API required — pure JS math.

import fs   from 'fs'
import path from 'path'

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

export class SemanticMemory {
  private data: MemoryItem[] = []

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

    // Keep max 500 items — remove oldest
    if (this.data.length > 500) {
      this.data = this.data
        .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)
        .slice(0, 500)
    }

    this.save()
  }

  search(query: string, topK = 5, minScore = 0.3): MemoryItem[] {
    if (this.data.length === 0) return []
    const qVec = this.embed(query)
    return this.data
      .map(item => ({ item, score: this.cosine(qVec, item.embedding) }))
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(r => r.item)
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
