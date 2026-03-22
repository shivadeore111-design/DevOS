// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// memoryStore.ts — DevOS Agent Memory Layer
// Persistent key-value memory with tagging and search
// ============================================================

import fs   from "fs";
import path from "path";

const MEMORY_DIR  = path.join(process.cwd(), "workspace", "memory");
const MEMORY_FILE = path.join(MEMORY_DIR, "memory.json");

export interface MemoryEntry {
  key: string;
  value: any;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

class MemoryStore {
  private store: Map<string, MemoryEntry> = new Map();

  load(): void {
    if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
    if (!fs.existsSync(MEMORY_FILE)) { this.persist(); return; }

    try {
      const raw: MemoryEntry[] = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
      this.store.clear();
      for (const e of raw) this.store.set(e.key, e);
      console.log(`[Memory] Loaded ${this.store.size} entries.`);
    } catch (err: any) {
      console.error(`[Memory] Load failed: ${err.message}`);
    }
  }

  set(key: string, value: any, tags: string[] = []): MemoryEntry {
    const now  = new Date().toISOString();
    const existing = this.store.get(key);
    const entry: MemoryEntry = {
      key,
      value,
      tags,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.store.set(key, entry);
    this.persist();
    return entry;
  }

  get(key: string): any {
    return this.store.get(key)?.value;
  }

  search(tag: string): MemoryEntry[] {
    return Array.from(this.store.values()).filter(e => e.tags.includes(tag));
  }

  delete(key: string): boolean {
    const ok = this.store.delete(key);
    if (ok) this.persist();
    return ok;
  }

  getAll(): MemoryEntry[] {
    return Array.from(this.store.values());
  }

  private persist(): void {
    const tmp = MEMORY_FILE + ".tmp";
    try {
      if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.getAll(), null, 2), "utf-8");
      fs.renameSync(tmp, MEMORY_FILE);
    } catch (err: any) {
      console.error(`[Memory] Persist failed: ${err.message}`);
    }
  }
}

export const memoryStore = new MemoryStore();
