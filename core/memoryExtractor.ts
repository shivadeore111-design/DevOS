// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/memoryExtractor.ts — Post-conversation durable memory extraction.
// After every conversation ends, scans messages and writes facts to
// workspace/memory/ as typed frontmatter markdown files.
// Maintains workspace/memory/MEMORY_INDEX.md (max 100 entries).

import fs   from 'fs'
import path from 'path'
import { callBgLLM } from './bgLLM'

const MEMORY_DIR   = path.join(process.cwd(), 'workspace', 'memory')
const INDEX_PATH   = path.join(MEMORY_DIR, 'MEMORY_INDEX.md')
const SESSIONS_DIR = path.join(process.cwd(), 'workspace', 'sessions')

// ── Types ─────────────────────────────────────────────────────

type MemoryType = 'user_preference' | 'project_fact' | 'tool_pattern' | 'learned_behavior'

interface MemoryFile {
  filename: string
  title:    string
  type:     MemoryType
  summary:  string
}

// ── Helpers ───────────────────────────────────────────────────

function memoryFilePath(filename: string): string {
  return path.join(MEMORY_DIR, filename)
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function readIndex(): MemoryFile[] {
  try {
    if (!fs.existsSync(INDEX_PATH)) return []
    const content = fs.readFileSync(INDEX_PATH, 'utf-8')
    return content.trim().split('\n')
      .filter(l => l.startsWith('- ['))
      .map(l => {
        const m = l.match(/^- \[(.+?)\]\((.+?)\) — (.+)$/)
        if (!m) return null
        return { filename: m[2], title: m[1], type: 'project_fact' as MemoryType, summary: m[3] }
      })
      .filter((e): e is MemoryFile => e !== null)
  } catch {
    return []
  }
}

function writeIndex(entries: MemoryFile[]): void {
  try {
    const lines = entries.slice(0, 100).map(e =>
      `- [${e.title}](${e.filename}) — ${e.summary}`,
    )
    fs.writeFileSync(INDEX_PATH, lines.join('\n') + '\n', 'utf-8')
  } catch (e: any) {
    console.error('[MemoryExtractor] Index write failed:', e.message)
  }
}

function buildExtractionPrompt(sessionContent: string, existingIndex: string): string {
  return `You are a memory extractor for DevOS. Read the session below and extract durable facts worth remembering.

EXISTING MEMORY INDEX:
${existingIndex || '(empty)'}

SESSION CONTENT:
${sessionContent.slice(0, 3000)}

Extract 1-5 memory items. For each one output JSON in this format:
[
  {
    "type": "user_preference|project_fact|tool_pattern|learned_behavior",
    "filename": "user_name.md or project_architecture.md (use type prefix + snake_case descriptor)",
    "title": "Short descriptive title",
    "content": "Concise actionable fact. 1-4 sentences.",
    "summary": "One-line summary for index"
  }
]

Rules:
- Only extract facts that are genuinely useful in a future conversation
- Skip trivial or already-indexed facts
- learned_behavior: corrections, things to avoid
- tool_pattern: commands that work/fail, file paths
- project_fact: architecture, design decisions
- user_preference: communication style, preferences
- Output ONLY valid JSON array, nothing else`
}

// ── MemoryExtractor ───────────────────────────────────────────

class MemoryExtractor {
  constructor() {
    try { fs.mkdirSync(MEMORY_DIR, { recursive: true }) } catch {}
  }

  // ── Extract from session ───────────────────────────────────

  async extractFromSession(sessionId: string): Promise<void> {
    const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.md`)
    if (!fs.existsSync(sessionFile)) return

    try {
      const sessionContent = fs.readFileSync(sessionFile, 'utf-8')
      if (sessionContent.length < 100) return // too short

      const existingIndex  = fs.existsSync(INDEX_PATH)
        ? fs.readFileSync(INDEX_PATH, 'utf-8').slice(0, 2000)
        : ''

      const prompt = buildExtractionPrompt(sessionContent, existingIndex)
      const raw    = await callBgLLM(prompt, `memory_extract_${sessionId}`)

      if (!raw) return

      // Parse JSON array from response
      const jsonMatch = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').match(/\[[\s\S]*\]/)
      if (!jsonMatch) return

      const items = JSON.parse(jsonMatch[0]) as Array<{
        type:     string
        filename: string
        title:    string
        content:  string
        summary:  string
      }>

      if (!Array.isArray(items) || items.length === 0) return

      const existingEntries = readIndex()

      for (const item of items) {
        if (!item.filename || !item.title || !item.content) continue
        await this.writeMemoryFile(item.filename, item.type as MemoryType, item.title, item.content, existingEntries)
      }

      // Update index
      writeIndex(existingEntries)
      console.log(`[MemoryExtractor] Extracted ${items.length} memory item(s) from session ${sessionId}`)

    } catch (e: any) {
      console.error('[MemoryExtractor] Extraction failed:', e.message)
    }
  }

  // ── Write a single memory file ─────────────────────────────

  private async writeMemoryFile(
    filename:       string,
    type:           MemoryType,
    title:          string,
    content:        string,
    indexEntries:   MemoryFile[],
  ): Promise<void> {
    const filePath = memoryFilePath(filename)
    const now      = today()

    // Check if file already exists — update rather than duplicate
    let created = now
    if (fs.existsSync(filePath)) {
      try {
        const existing = fs.readFileSync(filePath, 'utf-8')
        const m        = existing.match(/^created:\s*(.+)$/m)
        if (m) created = m[1].trim()
      } catch {}
    }

    const frontmatter = `---
title: ${title}
type: ${type}
created: ${created}
updated: ${now}
---

${content.trim()}
`

    try {
      fs.writeFileSync(filePath, frontmatter, 'utf-8')
    } catch (e: any) {
      console.error(`[MemoryExtractor] Write failed for ${filename}:`, e.message)
      return
    }

    // Update or add index entry
    const existing = indexEntries.findIndex(e => e.filename === filename)
    const entry: MemoryFile = { filename, title, type, summary: content.slice(0, 80).replace(/\n/g, ' ') }
    if (existing >= 0) {
      indexEntries[existing] = entry
    } else {
      indexEntries.unshift(entry)
    }
  }

  // ── Load memory index for system prompt injection ──────────

  loadMemoryIndex(): string {
    try {
      if (!fs.existsSync(INDEX_PATH)) return ''
      return fs.readFileSync(INDEX_PATH, 'utf-8')
    } catch {
      return ''
    }
  }

  // ── Load a specific memory file ────────────────────────────

  loadMemoryFile(filename: string): string {
    try {
      const p = memoryFilePath(filename)
      if (!fs.existsSync(p)) return ''
      return fs.readFileSync(p, 'utf-8')
    } catch {
      return ''
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const memoryExtractor = new MemoryExtractor()
