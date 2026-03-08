// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// research/researchCache.ts — TTL-based cache for research results

import * as fs   from "fs";
import * as path from "path";

export interface CachedResearch {
  key:       string;
  query:     string;
  results:   any[];
  summary?:  string;
  cachedAt:  string;   // ISO timestamp
  ttlMs:     number;
}

const CACHE_FILE = path.join(process.cwd(), "research", "research-cache.json");
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class ResearchCache {
  private cache: Map<string, CachedResearch> = new Map();

  constructor() {
    this.load();
  }

  // ── Public API ────────────────────────────────────────────

  get(key: string): CachedResearch | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const age = Date.now() - new Date(entry.cachedAt).getTime();
    if (age > entry.ttlMs) {
      this.cache.delete(key);
      this.persist();
      return null;
    }

    return entry;
  }

  set(key: string, query: string, results: any[], summary?: string, ttlMs = DEFAULT_TTL_MS): void {
    const entry: CachedResearch = {
      key,
      query,
      results,
      summary,
      cachedAt: new Date().toISOString(),
      ttlMs,
    };
    this.cache.set(key, entry);
    this.persist();
  }

  invalidate(key: string): void {
    if (this.cache.delete(key)) {
      this.persist();
    }
  }

  clear(): void {
    this.cache.clear();
    this.persist();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // ── Persistence ───────────────────────────────────────────

  private load(): void {
    try {
      if (!fs.existsSync(CACHE_FILE)) return;
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const entries: CachedResearch[] = JSON.parse(raw);
      const now = Date.now();
      for (const entry of entries) {
        const age = now - new Date(entry.cachedAt).getTime();
        if (age <= entry.ttlMs) {
          this.cache.set(entry.key, entry);
        }
      }
      console.log(`[ResearchCache] Loaded ${this.cache.size} valid entries`);
    } catch {
      // Fresh start if file is missing or corrupt
    }
  }

  private persist(): void {
    try {
      const dir = path.dirname(CACHE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const entries = Array.from(this.cache.values());
      fs.writeFileSync(CACHE_FILE, JSON.stringify(entries, null, 2), "utf-8");
    } catch (err: any) {
      console.error(`[ResearchCache] Persist error: ${err.message}`);
    }
  }
}

export const researchCache = new ResearchCache();
