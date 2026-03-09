// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// knowledge/knowledgeGraph.ts — Directed relationship graph over knowledge entries.

import fs   from "fs"
import path from "path"
import { knowledgeStore, KnowledgeEntry } from "./knowledgeStore"

const GRAPH_FILE = path.join(process.cwd(), "knowledge", "knowledge-graph.json")

export interface KnowledgeEdge {
  fromId:       string
  toId:         string
  relationship: string
  strength:     number   // 0.0 – 1.0
}

export class KnowledgeGraph {

  private edges: KnowledgeEdge[] = []

  constructor() {
    this._load()
  }

  // ── Mutations ─────────────────────────────────────────────

  addEdge(
    fromId:       string,
    toId:         string,
    relationship: string,
    strength:     number = 0.5,
  ): void {
    // Avoid exact duplicates
    const exists = this.edges.some(
      e => e.fromId === fromId && e.toId === toId && e.relationship === relationship
    )
    if (!exists) {
      this.edges.push({ fromId, toId, relationship, strength: Math.min(1, Math.max(0, strength)) })
      this._persist()
    }
  }

  // ── Queries ───────────────────────────────────────────────

  /**
   * Returns knowledge entries related to `id`, sorted by edge strength descending.
   * Follows both outgoing and incoming edges.
   */
  getRelated(id: string, limit: number = 5): KnowledgeEntry[] {
    const relatedIds = this.edges
      .filter(e => e.fromId === id || e.toId === id)
      .sort((a, b) => b.strength - a.strength)
      .map(e => (e.fromId === id ? e.toId : e.fromId))
      .filter((rid, idx, arr) => arr.indexOf(rid) === idx)  // dedupe
      .slice(0, limit)

    return relatedIds
      .map(rid => knowledgeStore.get(rid))
      .filter((e): e is KnowledgeEntry => e !== null)
  }

  /**
   * BFS path finding between two knowledge entries.
   * Returns array of node IDs representing the path, or [] if none found.
   */
  findPath(fromId: string, toId: string): string[] {
    if (fromId === toId) return [fromId]

    const visited = new Set<string>([fromId])
    const queue:  Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }]

    while (queue.length > 0) {
      const current = queue.shift()!

      const neighbours = this.edges
        .filter(e => e.fromId === current.id || e.toId === current.id)
        .map(e => (e.fromId === current.id ? e.toId : e.fromId))

      for (const neighbour of neighbours) {
        if (visited.has(neighbour)) continue
        const newPath = [...current.path, neighbour]
        if (neighbour === toId) return newPath
        visited.add(neighbour)
        queue.push({ id: neighbour, path: newPath })
      }
    }

    return []  // no path
  }

  /** Return all edges. */
  listEdges(): KnowledgeEdge[] {
    return [...this.edges]
  }

  // ── Persistence ───────────────────────────────────────────

  private _load(): void {
    try {
      if (!fs.existsSync(GRAPH_FILE)) return
      const raw   = fs.readFileSync(GRAPH_FILE, "utf-8")
      this.edges  = JSON.parse(raw) as KnowledgeEdge[]
    } catch {
      this.edges = []
    }
  }

  private _persist(): void {
    try {
      fs.mkdirSync(path.dirname(GRAPH_FILE), { recursive: true })
      fs.writeFileSync(GRAPH_FILE, JSON.stringify(this.edges, null, 2), "utf-8")
    } catch (err: any) {
      console.warn(`[KnowledgeGraph] Persist failed: ${err.message}`)
    }
  }
}

export const knowledgeGraph = new KnowledgeGraph()
