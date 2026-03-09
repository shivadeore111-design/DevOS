// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// knowledge/knowledgeStore.ts — Persistent keyword-searchable knowledge base.

import fs   from "fs"
import path from "path"

const STORE_FILE = path.join(process.cwd(), "knowledge", "knowledge-store.json")

export interface KnowledgeEntry {
  id:          string
  title:       string
  content:     string
  chunks:      string[]
  source:      string
  tags:        string[]
  embedding?:  number[]
  createdAt:   Date
  updatedAt:   Date
  accessCount: number
}

function makeId(): string {
  return `ke_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** Compute a simple keyword-frequency relevance score. */
function scoreEntry(entry: KnowledgeEntry, keywords: string[]): number {
  const haystack = [
    entry.title,
    entry.content.slice(0, 2000),
    ...entry.tags,
  ]
    .join(" ")
    .toLowerCase()

  return keywords.reduce((score, kw) => {
    const re  = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")
    const hits = (haystack.match(re) ?? []).length
    return score + hits
  }, 0)
}

export class KnowledgeStore {

  private entries = new Map<string, KnowledgeEntry>()

  constructor() {
    this._load()
  }

  // ── CRUD ──────────────────────────────────────────────────

  add(
    entry: Omit<KnowledgeEntry, "id" | "createdAt" | "updatedAt" | "accessCount">,
  ): string {
    const id  = makeId()
    const now = new Date()
    const rec: KnowledgeEntry = {
      ...entry,
      id,
      createdAt:   now,
      updatedAt:   now,
      accessCount: 0,
    }
    this.entries.set(id, rec)
    this._persist()
    return id
  }

  get(id: string): KnowledgeEntry | null {
    return this.entries.get(id) ?? null
  }

  delete(id: string): void {
    this.entries.delete(id)
    this._persist()
  }

  recordAccess(id: string): void {
    const e = this.entries.get(id)
    if (!e) return
    e.accessCount++
    e.updatedAt = new Date()
    this._persist()
  }

  // ── Query ─────────────────────────────────────────────────

  /**
   * Keyword search across title + content + tags.
   * Returns top `limit` entries ordered by relevance score descending.
   */
  search(query: string, limit: number = 5): KnowledgeEntry[] {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2)

    if (keywords.length === 0) return this.list().slice(0, limit)

    return Array.from(this.entries.values())
      .map(e => ({ entry: e, score: scoreEntry(e, keywords) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ entry }) => entry)
  }

  /** List all entries, optionally filtered by tag. */
  list(tag?: string): KnowledgeEntry[] {
    const all = Array.from(this.entries.values())
    if (!tag) return all
    const lower = tag.toLowerCase()
    return all.filter(e => e.tags.some(t => t.toLowerCase() === lower))
  }

  // ── Persistence ───────────────────────────────────────────

  private _load(): void {
    try {
      if (!fs.existsSync(STORE_FILE)) return
      const raw  = fs.readFileSync(STORE_FILE, "utf-8")
      const data = JSON.parse(raw) as KnowledgeEntry[]
      for (const e of data) {
        e.createdAt = new Date(e.createdAt)
        e.updatedAt = new Date(e.updatedAt)
        this.entries.set(e.id, e)
      }
      console.log(`[KnowledgeStore] Loaded ${this.entries.size} entries`)
    } catch {
      /* start fresh */
    }
  }

  private _persist(): void {
    try {
      fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true })
      fs.writeFileSync(
        STORE_FILE,
        JSON.stringify(Array.from(this.entries.values()), null, 2),
        "utf-8",
      )
    } catch (err: any) {
      console.warn(`[KnowledgeStore] Persist failed: ${err.message}`)
    }
  }
}

export const knowledgeStore = new KnowledgeStore()
