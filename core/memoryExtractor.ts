// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/memoryExtractor.ts — Post-conversation memory extraction.
// After every conversation ends, scans messages and writes structured
// memory files to workspace/memory/ with frontmatter metadata.
// Maintains workspace/memory/MEMORY_INDEX.md (max 100 entries).
// Loaded into system prompt at session start via getMemoryContext().
//
// LLM usage: system cost only (Cerebras first, Ollama fallback).

import fs   from 'fs'
import path from 'path'
import { costTracker } from './costTracker'

// ── Paths ──────────────────────────────────────────────────────

const MEMORY_DIR   = path.join(process.cwd(), 'workspace', 'memory')
const MEMORY_INDEX = path.join(MEMORY_DIR, 'MEMORY_INDEX.md')
const MAX_INDEX_ENTRIES = 100

// ── Types ──────────────────────────────────────────────────────

export type MemoryType = 'user_preference' | 'project_fact' | 'tool_pattern' | 'learned_behavior'

export interface MemoryEntry {
  filename:  string
  type:      MemoryType
  title:     string
  created:   string    // YYYY-MM-DD
  updated:   string    // YYYY-MM-DD
  content:   string
}

// ── Cheapest-provider LLM caller (same pattern as sessionMemory) ─

async function callCheapLLM(prompt: string, maxTokens = 1200): Promise<string> {
  try {
    const { loadConfig } = await import('../providers/index')
    const config  = loadConfig()
    const cerebras = config.providers.apis.find(
      a => a.provider === 'cerebras' && a.enabled && !a.rateLimited,
    )
    if (cerebras) {
      const key = cerebras.key.startsWith('env:')
        ? (process.env[cerebras.key.replace('env:', '')] || '')
        : cerebras.key
      if (key) {
        const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body:    JSON.stringify({ model: cerebras.model || 'llama3.1-8b', messages: [{ role: 'user', content: prompt }], stream: false, max_tokens: maxTokens }),
          signal:  AbortSignal.timeout(25000),
        })
        if (r.ok) {
          const d = await r.json() as any
          costTracker.record({ provider: 'cerebras', model: cerebras.model, rawResponse: d, taskType: 'system' })
          return d?.choices?.[0]?.message?.content || ''
        }
      }
    }
  } catch {}

  // Ollama fallback
  try {
    const { loadConfig } = await import('../providers/index')
    const config = loadConfig()
    const ollamaModel = config.model?.activeModel || 'mistral:7b'
    const r = await fetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: ollamaModel, stream: false, messages: [{ role: 'user', content: prompt }] }),
      signal:  AbortSignal.timeout(40000),
    })
    if (r.ok) {
      const d = await r.json() as any
      costTracker.record({ provider: 'ollama', model: ollamaModel, rawResponse: d, taskType: 'system' })
      return d?.message?.content || ''
    }
  } catch {}

  return ''
}

// ── Parse frontmatter from a memory file ───────────────────────

function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: content }
  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const [k, ...v] = line.split(':')
    if (k && v.length) meta[k.trim()] = v.join(':').trim()
  }
  return { meta, body: match[2] }
}

// ── Build frontmatter string ────────────────────────────────────

function buildFrontmatter(entry: Omit<MemoryEntry, 'content'>): string {
  return `---\ntitle: ${entry.title}\ntype: ${entry.type}\ncreated: ${entry.created}\nupdated: ${entry.updated}\n---\n`
}

// ── Load existing memory index ─────────────────────────────────

function loadIndex(): Array<{ filename: string; title: string; type: string }> {
  try {
    if (!fs.existsSync(MEMORY_INDEX)) return []
    const raw = fs.readFileSync(MEMORY_INDEX, 'utf-8')
    const entries: Array<{ filename: string; title: string; type: string }> = []
    for (const line of raw.split('\n')) {
      const m = line.match(/^- \[(.+?)\]\((.+?)\) — (.+)$/)
      if (m) entries.push({ title: m[1], filename: m[2], type: m[3] })
    }
    return entries
  } catch {
    return []
  }
}

// ── Save memory index ──────────────────────────────────────────

function saveIndex(entries: Array<{ filename: string; title: string; type: string }>): void {
  const unique = entries.filter((e, i, arr) => arr.findIndex(x => x.filename === e.filename) === i)
  const trimmed = unique.slice(-MAX_INDEX_ENTRIES)   // keep most recent 100
  const header  = `# DevOS Memory Index\n_Auto-maintained. Last updated: ${new Date().toISOString().slice(0, 10)}_\n\n`
  const lines   = trimmed.map(e => `- [${e.title}](${e.filename}) — ${e.type}`)
  fs.mkdirSync(MEMORY_DIR, { recursive: true })
  fs.writeFileSync(MEMORY_INDEX, header + lines.join('\n') + '\n')
}

// ── Write or update a memory file ─────────────────────────────

function writeMemoryFile(entry: MemoryEntry): void {
  fs.mkdirSync(MEMORY_DIR, { recursive: true })
  const filePath = path.join(MEMORY_DIR, entry.filename)
  const fm       = buildFrontmatter(entry)
  fs.writeFileSync(filePath, fm + entry.content, 'utf-8')
}

// ── Find existing file for a given type/title ─────────────────

function findExistingFile(type: MemoryType, titleKeyword: string): string | null {
  try {
    if (!fs.existsSync(MEMORY_DIR)) return null
    const files = fs.readdirSync(MEMORY_DIR).filter(f => f.startsWith(type.split('_')[0]) && f.endsWith('.md'))
    for (const f of files) {
      const raw = fs.readFileSync(path.join(MEMORY_DIR, f), 'utf-8')
      const { meta } = parseFrontmatter(raw)
      if (meta.title && meta.title.toLowerCase().includes(titleKeyword.toLowerCase().slice(0, 15))) {
        return f
      }
    }
  } catch {}
  return null
}

// ── Memory extraction prompt ────────────────────────────────────

function buildExtractionPrompt(messages: { role: string; content: string }[]): string {
  const history = messages
    .slice(-20)
    .map(m => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 400)}`)
    .join('\n\n')

  return `You are a memory extraction agent for DevOS. Analyse this conversation and extract 3–6 significant, reusable pieces of information.

For each piece, output a JSON object on its own line (JSONL format):
{"type": "user_preference|project_fact|tool_pattern|learned_behavior", "title": "Short title (5-10 words)", "content": "Concise, actionable content. 1-3 sentences max.", "keywords": ["keyword1", "keyword2"]}

Types:
- user_preference: How the user likes things done (communication style, output format, workflow preferences)
- project_fact: Architecture decisions, file locations, tech stack facts, project-specific context
- tool_pattern: Commands that work/fail, tool sequences that solve problems, environment facts
- learned_behavior: Corrections made, mistakes to avoid, things that don't work

Rules:
- Extract only genuinely useful, persistent knowledge — not ephemeral task outputs
- Keep content concise and actionable (not "user asked about X" — but "user prefers Y when doing X")
- Output ONLY the JSONL lines, nothing else

CONVERSATION:
${history}

Extract memories:`
}

// ── MemoryExtractor class ──────────────────────────────────────

export class MemoryExtractor {

  // ── Run extraction after conversation ends ────────────

  async extractFromConversation(
    messages: { role: string; content: string }[],
  ): Promise<number> {
    if (messages.length < 2) return 0

    try {
      const prompt = buildExtractionPrompt(messages)
      const raw    = await callCheapLLM(prompt, 1500)
      if (!raw || raw.trim().length === 0) return 0

      const lines = raw.trim().split('\n').filter(l => l.trim().startsWith('{'))
      let written = 0

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as {
            type: MemoryType
            title: string
            content: string
            keywords?: string[]
          }
          if (!parsed.type || !parsed.title || !parsed.content) continue
          if (!['user_preference', 'project_fact', 'tool_pattern', 'learned_behavior'].includes(parsed.type)) continue

          await this.upsertMemory(parsed.type, parsed.title, parsed.content)
          written++
        } catch {}
      }

      return written
    } catch (e: any) {
      console.warn('[MemoryExtractor] Extraction failed:', e.message)
      return 0
    }
  }

  // ── Upsert a memory file (update if similar exists) ───

  async upsertMemory(type: MemoryType, title: string, content: string): Promise<void> {
    const today    = new Date().toISOString().slice(0, 10)
    const prefix   = type.split('_')[0]   // 'user', 'project', 'tool', 'learned'
    const existing = findExistingFile(type, title)

    if (existing) {
      // Update existing
      const raw        = fs.readFileSync(path.join(MEMORY_DIR, existing), 'utf-8')
      const { meta }   = parseFrontmatter(raw)
      const entry: MemoryEntry = {
        filename: existing,
        type,
        title:   meta.title || title,
        created: meta.created || today,
        updated: today,
        content: content + '\n',
      }
      writeMemoryFile(entry)
      this.updateIndex(entry)
    } else {
      // Create new
      const slug     = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)
      const filename = `${prefix}_${slug}_${Date.now().toString(36)}.md`
      const entry: MemoryEntry = {
        filename, type, title,
        created: today, updated: today,
        content: content + '\n',
      }
      writeMemoryFile(entry)
      this.updateIndex(entry)
    }
  }

  // ── Get all memory content for system prompt injection ─

  getMemoryContext(): string {
    try {
      if (!fs.existsSync(MEMORY_INDEX)) return ''
      const index = fs.readFileSync(MEMORY_INDEX, 'utf-8')
      return `## Persistent Memory\n${index.slice(0, 2000)}`
    } catch {
      return ''
    }
  }

  // ── Get full memory content for injection at session start ─

  getMemoryInjection(maxChars = 3000): string {
    try {
      if (!fs.existsSync(MEMORY_DIR)) return ''
      const files = fs.readdirSync(MEMORY_DIR)
        .filter(f => f.endsWith('.md') && f !== 'MEMORY_INDEX.md')
        .map(f => ({ name: f, mtime: fs.statSync(path.join(MEMORY_DIR, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 20)  // most recent 20 files

      const chunks: string[] = []
      let total = 0
      for (const { name } of files) {
        const raw     = fs.readFileSync(path.join(MEMORY_DIR, name), 'utf-8')
        const { meta, body } = parseFrontmatter(raw)
        const snippet = `**${meta.title || name}** (${meta.type}): ${body.trim().slice(0, 150)}`
        if (total + snippet.length > maxChars) break
        chunks.push(snippet)
        total += snippet.length
      }
      return chunks.length ? `## What I Know About You\n${chunks.join('\n')}\n` : ''
    } catch {
      return ''
    }
  }

  // ── Internal: update the memory index ─────────────────

  private updateIndex(entry: MemoryEntry): void {
    const existing = loadIndex()
    const filtered = existing.filter(e => e.filename !== entry.filename)
    filtered.push({ filename: entry.filename, title: entry.title, type: entry.type })
    saveIndex(filtered)
  }
}

// ── Singleton ──────────────────────────────────────────────────
export const memoryExtractor = new MemoryExtractor()
