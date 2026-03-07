// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// memory/vectorMemory.ts — SQLite-backed vector memory
// Local-first. No Docker. No cloud. Just SQLite + Ollama embeddings.
// Upgrade path → Qdrant when you outgrow it.
// ============================================================

import fs   from "fs";
import path from "path";
import axios from "axios";

const DB_DIR  = path.join(process.cwd(), "workspace", "memory");
const DB_FILE = path.join(DB_DIR, "vectors.json");

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

// ── Types ─────────────────────────────────────────────────────

export interface VectorEntry {
  id:        string;
  text:      string;
  embedding: number[];
  metadata:  Record<string, any>;
  createdAt: string;
  tags:      string[];
}

export interface SearchResult {
  entry:      VectorEntry;
  similarity: number;
}

// ── Embedding ─────────────────────────────────────────────────

export async function embed(text: string): Promise<number[]> {
  try {
    const res = await axios.post(
      `${OLLAMA_BASE}/api/embeddings`,
      { model: EMBED_MODEL, prompt: text },
      { timeout: 30000 }
    );
    return res.data.embedding as number[];
  } catch (err: any) {
    console.warn(`[VectorMemory] Embedding failed (${EMBED_MODEL}): ${err.message}`);
    console.warn(`  Make sure Ollama is running and model is pulled:`);
    console.warn(`  ollama pull ${EMBED_MODEL}`);
    // Return zero vector as fallback — search will return no matches
    return new Array(768).fill(0);
  }
}

// ── Cosine Similarity ─────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── VectorMemory Store ────────────────────────────────────────

class VectorMemoryStore {
  private entries: VectorEntry[] = [];

  load(): void {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE)) { this.persist(); return; }
    try {
      this.entries = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      console.log(`[VectorMemory] Loaded ${this.entries.length} vectors.`);
    } catch (err: any) {
      console.error(`[VectorMemory] Load failed: ${err.message}`);
      this.entries = [];
    }
  }

  private persist(): void {
    const tmp = DB_FILE + ".tmp";
    try {
      if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.entries, null, 2));
      fs.renameSync(tmp, DB_FILE);
    } catch (err: any) {
      console.error(`[VectorMemory] Persist failed: ${err.message}`);
    }
  }

  /**
   * Store a text + its embedding in the vector store.
   * Returns the entry id.
   */
  async store(
    text:     string,
    metadata: Record<string, any> = {},
    tags:     string[]            = []
  ): Promise<string> {
    const id = `vec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const embedding = await embed(text);
    const entry: VectorEntry = {
      id, text, embedding, metadata, tags,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    this.persist();
    return id;
  }

  /**
   * Semantic search: embed the query and find top-k nearest entries.
   * Optional tag filter: only search entries matching all provided tags.
   */
  async search(
    query:    string,
    topK:     number   = 5,
    minScore: number   = 0.3,
    tags?:    string[]
  ): Promise<SearchResult[]> {
    if (this.entries.length === 0) return [];

    const queryVec = await embed(query);
    if (queryVec.every(v => v === 0)) return []; // embedding failed

    let pool = this.entries;
    if (tags && tags.length > 0) {
      pool = pool.filter(e => tags.every(t => e.tags.includes(t)));
    }

    const scored = pool
      .map(entry => ({ entry, similarity: cosineSimilarity(queryVec, entry.embedding) }))
      .filter(r => r.similarity >= minScore)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return scored;
  }

  /**
   * Retrieve by exact id.
   */
  getById(id: string): VectorEntry | undefined {
    return this.entries.find(e => e.id === id);
  }

  /**
   * Delete by id.
   */
  delete(id: string): boolean {
    const before = this.entries.length;
    this.entries = this.entries.filter(e => e.id !== id);
    if (this.entries.length !== before) { this.persist(); return true; }
    return false;
  }

  count(): number { return this.entries.length; }

  /** Upgrade path: export all entries for migration to Qdrant later */
  exportAll(): VectorEntry[] { return [...this.entries]; }
}

export const vectorMemory = new VectorMemoryStore();
