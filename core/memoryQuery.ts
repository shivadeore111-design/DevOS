// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

/**
 * core/memoryQuery.ts — 3-layer progressive disclosure memory query
 *
 * Layer 1  memsearch()   — [{id, summary, type, date, score}]   ~50 tok/hit
 * Layer 2  memtimeline() — chronological ±window around a record ~200 tok
 * Layer 3  memget()      — full record bodies for selected IDs   ~500-1000 tok each
 */

import { loadAllRecords, loadRecordById, MemoryRecord, MemoryType } from './memoryIds'

// ── Citation tracking (session-scoped, in-process) ────────────────────────

interface Citation {
  id:      string
  summary: string
  refs:    number
}

const _sessionCitations = new Map<string, Citation>()

export function trackCitation(id: string, summary: string): void {
  const c = _sessionCitations.get(id)
  if (c) { c.refs++ } else { _sessionCitations.set(id, { id, summary, refs: 1 }) }
}

export function getSessionCitations(): Citation[] {
  return Array.from(_sessionCitations.values())
}

export function clearSessionCitations(): void {
  _sessionCitations.clear()
}

// ── Layer 1 — memsearch ───────────────────────────────────────────────────

export interface SearchHit {
  id:      string
  summary: string
  type:    string
  date:    string   // YYYY-MM-DD
  score:   number   // relevance 0-1
}

export interface SearchOptions {
  limit?:  number
  type?:   string
  since?:  string   // ISO date string
}

export async function memsearch(
  query: string,
  opts: SearchOptions = {},
): Promise<SearchHit[]> {
  const limit   = opts.limit ?? 10
  const records = loadAllRecords()

  const words  = query.toLowerCase().split(/\s+/).filter(w => w.length > 1)
  if (words.length === 0) {
    // No query words — return most recent
    return records
      .slice(-limit)
      .reverse()
      .map(r => _toHit(r, 0))
  }

  // Filter by type
  let filtered = opts.type
    ? records.filter(r => r.type === opts.type)
    : records

  // Filter by since
  if (opts.since) {
    const sinceMs = new Date(opts.since).getTime()
    filtered = filtered.filter(r => new Date(r.timestamp).getTime() >= sinceMs)
  }

  // Score each record
  const scored = filtered.map(r => {
    const hay   = (r.summary + ' ' + r.content).toLowerCase()
    const hits  = words.filter(w => hay.includes(w)).length
    const score = hits / words.length
    return { record: r, score }
  })

  // Filter zero-score, sort desc by score then recency
  const hits = scored
    .filter(x => x.score > 0)
    .sort((a, b) => {
      if (Math.abs(a.score - b.score) > 0.01) return b.score - a.score
      return new Date(b.record.timestamp).getTime() - new Date(a.record.timestamp).getTime()
    })
    .slice(0, limit)
    .map(x => _toHit(x.record, x.score))

  // Track citations for pulse
  for (const h of hits) trackCitation(h.id, h.summary)

  return hits
}

function _toHit(r: MemoryRecord, score: number): SearchHit {
  return {
    id:      r.id,
    summary: r.summary.slice(0, 120),
    type:    r.type,
    date:    r.timestamp.slice(0, 10),
    score:   Math.round(score * 100) / 100,
  }
}

// ── Layer 2 — memtimeline ─────────────────────────────────────────────────

export interface TimelineSlim {
  id:        string
  summary:   string
  type:      string
  timestamp: string
}

export interface TimelineResult {
  center:          MemoryRecord
  before:          TimelineSlim[]
  after:           TimelineSlim[]
  sessionContext?: string
}

export interface TimelineOptions {
  windowHours?: number   // default 6
}

export async function memtimeline(
  centerId: string,
  opts: TimelineOptions = {},
): Promise<TimelineResult | null> {
  const center = loadRecordById(centerId)
  if (!center) return null

  const windowMs  = (opts.windowHours ?? 6) * 60 * 60 * 1000
  const centerMs  = new Date(center.timestamp).getTime()
  const allRecords = loadAllRecords()

  const before: TimelineSlim[] = []
  const after:  TimelineSlim[] = []

  for (const r of allRecords) {
    if (r.id === centerId) continue
    const t = new Date(r.timestamp).getTime()
    const delta = t - centerMs
    if (Math.abs(delta) > windowMs) continue
    const slim: TimelineSlim = {
      id:        r.id,
      summary:   r.summary.slice(0, 100),
      type:      r.type,
      timestamp: r.timestamp,
    }
    if (delta < 0) before.push(slim)
    else           after.push(slim)
  }

  // Keep at most 5 before (most recent 5) and 5 after (earliest 5)
  before.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  after.sort((a, b)  => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // Track citation
  trackCitation(center.id, center.summary)

  return {
    center,
    before: before.slice(0, 5),
    after:  after.slice(0, 5),
    sessionContext: center.sessionId,
  }
}

// ── Layer 3 — memget ──────────────────────────────────────────────────────

export interface MemGetResult {
  id:      string
  record:  MemoryRecord | null
  found:   boolean
}

export async function memget(ids: string[]): Promise<MemGetResult[]> {
  const allRecords = loadAllRecords()
  const byId = new Map(allRecords.map(r => [r.id, r]))

  return ids.map(id => {
    const record = byId.get(id) ?? null
    if (record) trackCitation(id, record.summary)
    return { id, record, found: record !== null }
  })
}
