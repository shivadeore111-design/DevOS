// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// memory/persistentMemory.ts — SQLite-backed persistent memory (sql.js, pure JS)

import * as fs   from 'fs'
import * as path from 'path'
import type { Database, SqlJsStatic } from 'sql.js'

const DB_PATH = path.join(process.cwd(), 'memory', 'devos.db')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

// Lazy-initialized database — avoids top-level await
let _db:  Database | null   = null
let _SQL: SqlJsStatic | null = null

async function getDb(): Promise<Database> {
  if (_db) return _db

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const initSqlJs = require('sql.js') as (opts?: any) => Promise<SqlJsStatic>
  _SQL = await initSqlJs({
    // require.resolve('sql.js') → .../node_modules/sql.js/dist/sql-wasm.js
    // The WASM file lives in the same dist/ directory
    locateFile: (file: string) =>
      path.join(path.dirname(require.resolve('sql.js')), file),
  })

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH)
    _db = new _SQL.Database(buf)
  } else {
    _db = new _SQL.Database()
  }

  initSchema(_db)
  return _db
}

function saveDb(): void {
  if (!_db) return
  const data = _db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

function initSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      source TEXT DEFAULT 'system',
      created_at INTEGER DEFAULT (strftime('%s','now')),
      updated_at INTEGER DEFAULT (strftime('%s','now')),
      UNIQUE(category, key)
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      intent TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS goals_history (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      tasks_total INTEGER DEFAULT 0,
      tasks_done INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      completed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_facts_category ON facts(category);
    CREATE INDEX IF NOT EXISTS idx_conv_created ON conversations(created_at);
  `)
  saveDb()
}

// ── Helper to execute a parameterised SELECT and return objects ────────────
function queryAll(db: Database, sql: string, params: any[] = []): Record<string, any>[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: Record<string, any>[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function queryOne(db: Database, sql: string, params: any[] = []): Record<string, any> | null {
  const rows = queryAll(db, sql, params)
  return rows[0] ?? null
}

export interface Fact {
  id: string; category: string; key: string
  value: string; source: string
  created_at: number; updated_at: number
}

class PersistentMemory {

  // ── Internal ──────────────────────────────────────────────────────────────

  private async db(): Promise<Database> {
    return getDb()
  }

  // Seeds run once; UPSERT means repeated starts are safe
  private async seed(): Promise<void> {
    const pairs: [string, string, string][] = [
      ['user',        'name',        'Shiva'],
      ['user',        'os',          'Windows 11'],
      ['user',        'gpu',         'GTX 1060 6GB'],
      ['user',        'desktop',     'C:\\Users\\shiva\\Desktop'],
      ['user',        'home',        'C:\\Users\\shiva'],
      ['projects',    'DevOS',       'autonomous AI OS — main project'],
      ['projects',    'CoachOS',     'fitness coaching SaaS on Vercel'],
      ['projects',    'BacktestPro', 'trading backtesting platform'],
      ['preferences', 'language',    'TypeScript'],
      ['preferences', 'llm_runtime', 'Ollama local'],
    ]
    for (const [cat, key, val] of pairs) await this.setFact(cat, key, val, 'system')
  }

  // ── Public API ────────────────────────────────────────────────────────────

  async setFact(category: string, key: string, value: string, source = 'system'): Promise<void> {
    const db = await this.db()
    const id = `${category}:${key}`
    db.run(
      `INSERT INTO facts (id, category, key, value, source, updated_at)
       VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
       ON CONFLICT(category, key) DO UPDATE SET
         value      = excluded.value,
         source     = excluded.source,
         updated_at = strftime('%s','now')`,
      [id, category, key, value, source]
    )
    saveDb()
  }

  async getFact(category: string, key: string): Promise<string | null> {
    const db  = await this.db()
    const row = queryOne(db, 'SELECT value FROM facts WHERE category=? AND key=?', [category, key])
    return (row?.value as string) ?? null
  }

  async getCategory(category: string): Promise<Record<string, string>> {
    const db   = await this.db()
    const rows = queryAll(db, 'SELECT key, value FROM facts WHERE category=?', [category])
    return Object.fromEntries(rows.map(r => [r['key'] as string, r['value'] as string]))
  }

  async addMessage(role: 'user' | 'assistant', content: string, intent?: string): Promise<void> {
    const db = await this.db()
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    db.run(
      `INSERT INTO conversations (id, role, content, intent) VALUES (?,?,?,?)`,
      [id, role, content, intent ?? null]
    )
    saveDb()
  }

  async getRecentMessages(limit = 20): Promise<{ role: string; content: string; intent?: string }[]> {
    const db   = await this.db()
    const rows = queryAll(db, 'SELECT role, content, intent FROM conversations ORDER BY created_at DESC LIMIT ?', [limit])
    return rows as { role: string; content: string; intent?: string }[]
  }

  async recordGoal(id: string, title: string, description: string, status: string, tasksTotal: number, tasksDone: number): Promise<void> {
    const db = await this.db()
    db.run(
      `INSERT INTO goals_history (id, title, description, status, tasks_total, tasks_done, completed_at)
       VALUES (?,?,?,?,?,?,strftime('%s','now'))
       ON CONFLICT(id) DO UPDATE SET
         status       = excluded.status,
         tasks_done   = excluded.tasks_done,
         completed_at = strftime('%s','now')`,
      [id, title, description, status, tasksTotal, tasksDone]
    )
    saveDb()
  }

  async getUserProfile(): Promise<Record<string, string>> {
    return this.getCategory('user')
  }

  async getRecentGoals(limit = 10): Promise<any[]> {
    const db   = await this.db()
    const rows = queryAll(db, 'SELECT * FROM goals_history ORDER BY created_at DESC LIMIT ?', [limit])
    return rows
  }

  async buildContext(): Promise<string> {
    const [user, projects, prefs, recentGoals] = await Promise.all([
      this.getCategory('user'),
      this.getCategory('projects'),
      this.getCategory('preferences'),
      this.getRecentGoals(5),
    ])

    const lines: string[] = ['--- Persistent Memory ---']
    if (Object.keys(user).length) {
      lines.push('User:')
      for (const [k, v] of Object.entries(user)) lines.push(`  ${k}: ${v}`)
    }
    if (Object.keys(projects).length) {
      lines.push('Projects:')
      for (const [k, v] of Object.entries(projects)) lines.push(`  ${k}: ${v}`)
    }
    if (Object.keys(prefs).length) {
      lines.push('Preferences:')
      for (const [k, v] of Object.entries(prefs)) lines.push(`  ${k}: ${v}`)
    }
    if (recentGoals.length) {
      lines.push('Recent goals:')
      for (const g of recentGoals) lines.push(`  [${g['status']}] ${g['title']} (${g['tasks_done']}/${g['tasks_total']} tasks)`)
    }
    return lines.join('\n')
  }

  async learnFromConversation(messages: { role: string; content: string }[]): Promise<void> {
    for (const msg of messages) {
      if (msg.role !== 'user') continue
      const text = msg.content

      const nameMatch = text.match(/(?:i'm|i am|call me|my name is)\s+([a-z]+)/i)
      if (nameMatch) await this.setFact('user', 'name', nameMatch[1], 'conversation')

      const lc = text.toLowerCase()
      if (lc.includes('coachos'))     await this.setFact('projects', 'CoachOS',     'fitness coaching SaaS, live on Vercel',               'conversation')
      if (lc.includes('backtestpro')) await this.setFact('projects', 'BacktestPro', 'trading backtesting platform, Python+TypeScript',      'conversation')
      if (lc.includes('devos'))       await this.setFact('projects', 'DevOS',       'autonomous AI OS, current main project',               'conversation')
      if (lc.includes('typescript'))  await this.setFact('preferences', 'language', 'TypeScript',                                          'conversation')
      if (lc.includes('windows'))     await this.setFact('preferences', 'os',       'Windows',                                             'conversation')
    }
  }

  async getStats(): Promise<{ totalFacts: number; totalMessages: number; totalGoals: number }> {
    const db     = await this.db()
    const facts  = (queryOne(db, 'SELECT COUNT(*) as c FROM facts')?.['c'] as number)  ?? 0
    const msgs   = (queryOne(db, 'SELECT COUNT(*) as c FROM conversations')?.['c'] as number) ?? 0
    const goals  = (queryOne(db, 'SELECT COUNT(*) as c FROM goals_history')?.['c'] as number) ?? 0
    return { totalFacts: facts, totalMessages: msgs, totalGoals: goals }
  }
}

export const persistentMemory = new PersistentMemory()

// Seed known facts on first import — fire-and-forget, safe to repeat
persistentMemory['seed']().catch(() => {})
