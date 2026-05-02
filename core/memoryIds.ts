// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

/**
 * core/memoryIds.ts — Stable mem_NNNNNN IDs + append-only records.jsonl
 *
 * Sits on top of the existing 6-layer memory architecture.
 * Does NOT touch conversationMemory, semanticMemory, knowledgeBase, etc.
 */

import * as fs   from 'fs'
import * as path from 'path'

// ── Paths ──────────────────────────────────────────────────────────────────

const MEM_DIR           = path.join(process.cwd(), 'workspace', 'memory')
const SEQUENCE_FILE     = path.join(MEM_DIR, 'sequence.json')
const RECORDS_FILE      = path.join(MEM_DIR, 'records.jsonl')

// ── Types ──────────────────────────────────────────────────────────────────

export type MemoryType =
  | 'fact'
  | 'decision'
  | 'observation'
  | 'interaction'
  | 'learning'
  | 'correction'

export interface MemoryRecord {
  id:          string        // mem_000001, mem_000002, …
  timestamp:   string        // ISO 8601
  type:        MemoryType
  content:     string        // full body
  summary:     string        // 1-line (auto-generated or provided)
  sessionId?:  string        // source session
  tags?:       string[]
  entityRefs?: string[]      // links to entity graph
}

// ── Sequence counter ────────────────────────────────────────────────────────

function _ensureDir(): void {
  fs.mkdirSync(MEM_DIR, { recursive: true })
}

function _readSeq(): number {
  try {
    if (!fs.existsSync(SEQUENCE_FILE)) return 0
    const d = JSON.parse(fs.readFileSync(SEQUENCE_FILE, 'utf-8'))
    return typeof d.next === 'number' ? d.next : 0
  } catch { return 0 }
}

function _writeSeq(n: number): void {
  _ensureDir()
  fs.writeFileSync(SEQUENCE_FILE, JSON.stringify({ next: n }), 'utf-8')
}

export function nextId(): string {
  const n = _readSeq()
  _writeSeq(n + 1)
  return `mem_${String(n + 1).padStart(6, '0')}`
}

// ── Record persistence ──────────────────────────────────────────────────────

export function appendRecord(record: MemoryRecord): void {
  _ensureDir()
  fs.appendFileSync(RECORDS_FILE, JSON.stringify(record) + '\n', 'utf-8')
}

export function loadAllRecords(): MemoryRecord[] {
  try {
    if (!fs.existsSync(RECORDS_FILE)) return []
    return fs.readFileSync(RECORDS_FILE, 'utf-8')
      .split('\n')
      .filter(l => l.trim())
      .map(l => {
        try { return JSON.parse(l) as MemoryRecord } catch { return null }
      })
      .filter((r): r is MemoryRecord => r !== null)
  } catch { return [] }
}

export function loadRecordById(id: string): MemoryRecord | null {
  const all = loadAllRecords()
  return all.find(r => r.id === id) ?? null
}

/**
 * C11: Remove records matching a predicate from records.jsonl.
 * Rewrites the file with only the non-matching records.
 * Returns the count of removed entries.
 */
export function removeRecords(predicate: (r: MemoryRecord) => boolean): number {
  const all  = loadAllRecords()
  const kept = all.filter(r => !predicate(r))
  const removed = all.length - kept.length
  if (removed > 0) {
    _ensureDir()
    fs.writeFileSync(
      RECORDS_FILE,
      kept.map(r => JSON.stringify(r)).join('\n') + (kept.length ? '\n' : ''),
      'utf-8',
    )
  }
  return removed
}

// ── ID assignment helper ────────────────────────────────────────────────────

export function assignId(
  partial: Omit<MemoryRecord, 'id'> & { id?: string },
): MemoryRecord {
  const record: MemoryRecord = {
    id:         partial.id ?? nextId(),
    timestamp:  partial.timestamp ?? new Date().toISOString(),
    type:       partial.type ?? 'observation',
    content:    partial.content ?? '',
    summary:    partial.summary ?? _autoSummary(partial.content ?? ''),
    sessionId:  partial.sessionId,
    tags:       partial.tags,
    entityRefs: partial.entityRefs,
  }
  appendRecord(record)
  return record
}

function _autoSummary(content: string): string {
  // Take first non-empty line, trim to 100 chars
  const first = content.split('\n').find(l => l.trim()) ?? content
  return first.slice(0, 100).trim()
}

// ── One-time migration ──────────────────────────────────────────────────────

export function runMigrationIfNeeded(): number {
  if (fs.existsSync(RECORDS_FILE)) return 0   // already migrated

  _ensureDir()

  const records: Array<Omit<MemoryRecord, 'id'>> = []

  // Source 1: workspace/memory/memory.json  (task/agent results)
  try {
    const raw   = fs.readFileSync(path.join(MEM_DIR, 'memory.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    const items: any[] = Array.isArray(parsed) ? parsed : (parsed.value ?? [])
    for (const item of items) {
      const v = item.value ?? {}
      const content = [
        v.goal ? `Goal: ${v.goal}` : '',
        v.result ? `Result: ${String(v.result).slice(0, 800)}` : '',
        v.role   ? `Role: ${v.role}` : '',
      ].filter(Boolean).join('\n')
      if (!content) continue
      records.push({
        timestamp: item.createdAt ?? new Date().toISOString(),
        type:      item.tags?.includes('task') ? 'interaction' : 'observation',
        content,
        summary:   _autoSummary(v.goal ?? v.result ?? content),
        tags:      item.tags ?? [],
      })
    }
  } catch { /* non-fatal */ }

  // Source 2: workspace/conversation-memory.json  (conversation messages)
  try {
    const raw    = fs.readFileSync(
      path.join(process.cwd(), 'workspace', 'conversation-memory.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    const msgs: any[] = parsed.messages ?? []
    // Only migrate assistant messages that have meaningful content
    for (const msg of msgs) {
      if (msg.role !== 'assistant') continue
      const content = String(msg.content ?? '').trim()
      if (content.length < 20) continue
      records.push({
        timestamp: msg.timestamp ?? new Date().toISOString(),
        type:      'interaction',
        content:   content.slice(0, 1000),
        summary:   _autoSummary(content),
        sessionId: msg.sessionId,
        tags:      ['conversation'],
      })
    }
  } catch { /* non-fatal */ }

  // Source 3: workspace/memory/MEMORY_INDEX.md  (.md lines as facts)
  try {
    const raw   = fs.readFileSync(path.join(MEM_DIR, 'MEMORY_INDEX.md'), 'utf-8')
    const lines = raw.split('\n').filter(l => l.startsWith('- '))
    for (const line of lines) {
      const cleaned = line.replace(/^-\s*/, '').trim()
      if (cleaned.length < 10) continue
      records.push({
        timestamp: new Date().toISOString(),
        type:      'fact',
        content:   cleaned,
        summary:   cleaned.slice(0, 100),
        tags:      ['index'],
      })
    }
  } catch { /* non-fatal */ }

  // Sort by timestamp ascending, assign IDs, write
  records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  let count = 0
  for (const rec of records) {
    const id     = nextId()
    const record: MemoryRecord = { id, ...rec }
    appendRecord(record)
    count++
  }

  return count
}
