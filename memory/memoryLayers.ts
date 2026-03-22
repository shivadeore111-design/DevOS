// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// memory/memoryLayers.ts — 3-tier memory: HOT (RAM) → WARM (SQLite) → COLD (JSON)

import * as fs   from 'fs'
import * as path from 'path'
import type { Database, SqlJsStatic } from 'sql.js'

// ── Types ──────────────────────────────────────────────────────

export interface MemoryEntry {
  id:           string
  content:      string
  tier:         'hot' | 'warm' | 'cold'
  timestamp:    number    // unix ms
  tags:         string[]
  accessCount:  number
  lastAccessed: number    // unix ms
}

// ── Constants ──────────────────────────────────────────────────

const WORKSPACE_MEM  = path.join(process.cwd(), 'workspace', 'memory')
const WARM_DB_PATH   = path.join(WORKSPACE_MEM, 'warm.db')
const COLD_JSON_PATH = path.join(WORKSPACE_MEM, 'cold.json')

const HOT_MAX         = 20          // max entries in RAM tier
const HOT_OVERFLOW    = 5           // entries to demote when HOT overflows
const WARM_TTL_MS     = 7 * 24 * 60 * 60 * 1000   // 7 days in ms
const MAX_COLD        = 2000        // hard cap on cold.json entries
const APPROX_CHARS_PER_TOKEN = 4    // rough token estimator

// ── Database helpers (same pattern as persistentMemory.ts) ─────

let _db:  Database | null    = null
let _SQL: SqlJsStatic | null = null

async function getWarmDb(): Promise<Database> {
  if (_db) return _db

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const initSqlJs = require('sql.js') as (opts?: any) => Promise<SqlJsStatic>
  _SQL = await initSqlJs({
    locateFile: (file: string) =>
      path.join(path.dirname(require.resolve('sql.js')), file),
  })

  fs.mkdirSync(path.dirname(WARM_DB_PATH), { recursive: true })

  if (fs.existsSync(WARM_DB_PATH)) {
    const buf = fs.readFileSync(WARM_DB_PATH)
    _db = new _SQL.Database(buf)
  } else {
    _db = new _SQL.Database()
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS warm_memory (
      id           TEXT PRIMARY KEY,
      content      TEXT NOT NULL,
      tags         TEXT NOT NULL DEFAULT '[]',
      timestamp    INTEGER NOT NULL,
      access_count INTEGER NOT NULL DEFAULT 0,
      last_accessed INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_warm_ts ON warm_memory(timestamp);
    CREATE INDEX IF NOT EXISTS idx_warm_la ON warm_memory(last_accessed);
  `)
  _saveWarmDb()
  return _db
}

function _saveWarmDb(): void {
  if (!_db) return
  try {
    fs.mkdirSync(path.dirname(WARM_DB_PATH), { recursive: true })
    fs.writeFileSync(WARM_DB_PATH, Buffer.from(_db.export()))
  } catch { /* non-fatal */ }
}

function _queryAll(db: Database, sql: string, params: any[] = []): Record<string, any>[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: Record<string, any>[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

// ── Cold JSON helpers ──────────────────────────────────────────

function _loadCold(): MemoryEntry[] {
  try {
    if (!fs.existsSync(COLD_JSON_PATH)) return []
    return JSON.parse(fs.readFileSync(COLD_JSON_PATH, 'utf-8')) as MemoryEntry[]
  } catch { return [] }
}

function _saveCold(entries: MemoryEntry[]): void {
  try {
    fs.mkdirSync(path.dirname(COLD_JSON_PATH), { recursive: true })
    const trimmed = entries.slice(-MAX_COLD)
    fs.writeFileSync(COLD_JSON_PATH, JSON.stringify(trimmed, null, 2), 'utf-8')
  } catch { /* non-fatal */ }
}

// ── Simple keyword score ───────────────────────────────────────

function _score(entry: MemoryEntry, tokens: string[]): number {
  const hay = (entry.content + ' ' + entry.tags.join(' ')).toLowerCase()
  let s = 0
  for (const t of tokens) if (hay.includes(t)) s++
  // recency boost: 1.0 → 0.5 over 7 days
  const ageDays = (Date.now() - entry.timestamp) / 86_400_000
  const recency = Math.max(0.5, 1.0 - ageDays / 7)
  // access frequency boost
  const freq = Math.min(1.0, entry.accessCount / 10)
  return (s + 1) * recency * (1 + freq * 0.5)
}

function _makeId(): string {
  return `ml_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

// ── Class ──────────────────────────────────────────────────────

class MemoryLayers {

  // HOT: in-RAM map, wiped on restart
  private hot = new Map<string, MemoryEntry>()

  // ── Write ─────────────────────────────────────────────────

  /**
   * Write a new entry. Always lands in HOT first.
   * If HOT has grown past HOT_MAX, the oldest HOT_OVERFLOW entries
   * are compressed and flushed to WARM in the background.
   */
  write(content: string, tags: string[]): void {
    const now = Date.now()
    const entry: MemoryEntry = {
      id:           _makeId(),
      content:      content.slice(0, 2000),
      tier:         'hot',
      timestamp:    now,
      tags,
      accessCount:  0,
      lastAccessed: now,
    }
    this.hot.set(entry.id, entry)
    console.log(`[MemoryLayers] 🔥 HOT write (${this.hot.size}) — ${content.slice(0, 60)}`)

    if (this.hot.size > HOT_MAX) {
      setImmediate(() => { this._flushHotOverflow().catch(() => {}) })
    }
  }

  // ── Read ──────────────────────────────────────────────────

  /**
   * HOT first → WARM second → COLD only if fewer than 3 results found.
   * Results sorted by recency + access frequency.
   */
  async read(query: string, maxTokens = 1000): Promise<MemoryEntry[]> {
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
    const charBudget = maxTokens * APPROX_CHARS_PER_TOKEN

    // HOT
    const hotResults = Array.from(this.hot.values())
      .map(e => ({ e, s: _score(e, tokens) }))
      .sort((a, b) => b.s - a.s)
      .map(({ e }) => e)

    hotResults.forEach(e => e.accessCount++)

    if (hotResults.length >= 3) return _trimToCharBudget(hotResults, charBudget)

    // WARM
    let warmResults: MemoryEntry[] = []
    try {
      const db   = await getWarmDb()
      const rows = _queryAll(db,
        `SELECT * FROM warm_memory ORDER BY last_accessed DESC LIMIT 50`
      )
      warmResults = rows.map(_rowToEntry)
        .map(e => ({ e, s: _score(e, tokens) }))
        .sort((a, b) => b.s - a.s)
        .map(({ e }) => e)
    } catch { /* warm unavailable */ }

    const combined = [...hotResults, ...warmResults]
    if (combined.length >= 3) return _trimToCharBudget(combined, charBudget)

    // COLD (only if < 3 results from HOT+WARM)
    const coldEntries = _loadCold()
      .map(e => ({ e, s: _score(e, tokens) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 10)
      .map(({ e }) => e)

    return _trimToCharBudget([...combined, ...coldEntries], charBudget)
  }

  // ── Compress ──────────────────────────────────────────────

  /**
   * Call the LLM to summarise a list of entries into 3 key facts.
   * Falls back to a simple concatenation if the LLM call fails.
   */
  async compress(entries: MemoryEntry[]): Promise<string> {
    if (entries.length === 0) return ''

    const snippets = entries.map((e, i) => `${i + 1}. ${e.content.slice(0, 200)}`).join('\n')
    const prompt   = `Summarise these memory entries into exactly 3 concise key facts (one per line, no numbering):
${snippets}

Output only the 3 facts:`

    try {
      // Lazy import to avoid circular dependency at module load
      const { callOllama } = require('../llm/ollama') as { callOllama: (p: string, s?: string, m?: string) => Promise<string> }
      const raw = await callOllama(prompt)
      return raw.trim().slice(0, 600)
    } catch {
      // Fallback: join content
      return entries.map(e => e.content.slice(0, 100)).join(' | ')
    }
  }

  // ── getContextForPrompt ───────────────────────────────────

  /**
   * Returns a concise string from HOT + WARM tiers for injection
   * into the user turn (NEVER the system prompt). Hard-capped at maxTokens.
   */
  async getContextForPrompt(maxTokens = 500): Promise<string> {
    const charBudget = maxTokens * APPROX_CHARS_PER_TOKEN

    // Most-recently-accessed HOT entries
    const hotEntries = Array.from(this.hot.values())
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, 10)

    // Most-recently-accessed WARM entries
    let warmEntries: MemoryEntry[] = []
    try {
      const db  = await getWarmDb()
      const rows = _queryAll(db,
        `SELECT * FROM warm_memory ORDER BY last_accessed DESC LIMIT 20`
      )
      warmEntries = rows.map(_rowToEntry)
    } catch { /* warm unavailable */ }

    const all = [...hotEntries, ...warmEntries]
    if (all.length === 0) return ''

    const trimmed = _trimToCharBudget(all, charBudget)
    const lines   = trimmed.map(e => `• [${e.tags.join(',')}] ${e.content.slice(0, 200)}`)
    const block   = `=== MEMORY CONTEXT ===\n${lines.join('\n')}\n=== END MEMORY ===`

    return block.length <= charBudget ? block : block.slice(0, charBudget - 3) + '...'
  }

  // ── Stats ─────────────────────────────────────────────────

  async getStats(): Promise<{ hot: number; warm: number; cold: number }> {
    let warmCount = 0
    try {
      const db  = await getWarmDb()
      const row = _queryAll(db, `SELECT COUNT(*) as c FROM warm_memory`)
      warmCount = (row[0]?.['c'] as number) ?? 0
    } catch { /* ignore */ }

    return {
      hot:  this.hot.size,
      warm: warmCount,
      cold: _loadCold().length,
    }
  }

  // ── Internal: HOT overflow flush ──────────────────────────

  private async _flushHotOverflow(): Promise<void> {
    try {
      // Take the oldest HOT_OVERFLOW entries (by timestamp)
      const sorted  = Array.from(this.hot.values()).sort((a, b) => a.timestamp - b.timestamp)
      const toFlush = sorted.slice(0, HOT_OVERFLOW)

      // Compress them into a summary
      const summary = await this.compress(toFlush)

      // Write summary to WARM
      const allTags = [...new Set(toFlush.flatMap(e => e.tags))]
      await this._writeWarm(summary, allTags, Math.min(...toFlush.map(e => e.timestamp)))

      // Remove originals from HOT
      for (const e of toFlush) this.hot.delete(e.id)

      console.log(`[MemoryLayers] 🌡️  Promoted ${toFlush.length} HOT → WARM`)
    } catch (err: any) {
      console.warn(`[MemoryLayers] HOT flush failed: ${err?.message}`)
    }
  }

  // ── Internal: write to WARM ───────────────────────────────

  private async _writeWarm(content: string, tags: string[], timestamp: number): Promise<void> {
    const db  = await getWarmDb()
    const now = Date.now()
    const id  = _makeId()
    db.run(
      `INSERT OR REPLACE INTO warm_memory (id, content, tags, timestamp, access_count, last_accessed)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [id, content.slice(0, 2000), JSON.stringify(tags), timestamp, now],
    )
    _saveWarmDb()

    // Evict WARM entries older than 7 days → COLD
    await this._evictOldWarm()
  }

  // ── Internal: evict old WARM entries to COLD ──────────────

  private async _evictOldWarm(): Promise<void> {
    try {
      const db       = await getWarmDb()
      const cutoffMs = Date.now() - WARM_TTL_MS
      const old      = _queryAll(db,
        `SELECT * FROM warm_memory WHERE timestamp < ? LIMIT 50`,
        [cutoffMs],
      ).map(_rowToEntry)

      if (old.length === 0) return

      // Compress old entries in batches of 5 → append to COLD
      for (let i = 0; i < old.length; i += 5) {
        const batch   = old.slice(i, i + 5)
        const summary = await this.compress(batch)
        const allTags = [...new Set(batch.flatMap(e => e.tags))]
        const cold    = _loadCold()
        cold.push({
          id:           _makeId(),
          content:      summary,
          tier:         'cold',
          timestamp:    Math.min(...batch.map(e => e.timestamp)),
          tags:         allTags,
          accessCount:  0,
          lastAccessed: Date.now(),
        })
        _saveCold(cold)
      }

      // Delete evicted rows from WARM
      const ids = old.map(e => `'${e.id}'`).join(',')
      db.run(`DELETE FROM warm_memory WHERE id IN (${ids})`)
      _saveWarmDb()

      console.log(`[MemoryLayers] 🧊 Evicted ${old.length} WARM → COLD`)
    } catch { /* non-fatal */ }
  }
}

// ── Helpers ────────────────────────────────────────────────────

function _rowToEntry(row: Record<string, any>): MemoryEntry {
  return {
    id:           row['id'] as string,
    content:      row['content'] as string,
    tier:         'warm',
    timestamp:    row['timestamp'] as number,
    tags:         JSON.parse((row['tags'] as string) || '[]') as string[],
    accessCount:  row['access_count'] as number,
    lastAccessed: row['last_accessed'] as number,
  }
}

function _trimToCharBudget(entries: MemoryEntry[], charBudget: number): MemoryEntry[] {
  let used = 0
  const result: MemoryEntry[] = []
  for (const e of entries) {
    used += e.content.length
    if (used > charBudget) break
    result.push(e)
  }
  return result
}

export const memoryLayers = new MemoryLayers()
