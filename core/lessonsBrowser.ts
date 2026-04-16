// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/lessonsBrowser.ts — Phase 2 of Prompt 11.
//
// Parses workspace/LESSONS.md into structured Lesson records.
// Supports filtering by keyword, category, and date range.

import fs   from 'fs'
import path from 'path'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Lesson {
  id:       number
  date:     string       // e.g. "2026-04-13"
  text:     string
  category: string       // auto-inferred from keywords
  source:   'auto' | 'manual'
}

// ── Paths ─────────────────────────────────────────────────────────────────────

export const LESSONS_PATH = path.join(process.cwd(), 'workspace', 'LESSONS.md')

// ── Category inference ────────────────────────────────────────────────────────

const CATEGORY_RULES: [RegExp, string][] = [
  [/web_search|search|query|url/i,         'web'      ],
  [/shell_exec|run_python|command|bash/i,   'shell'    ],
  [/file|write|read|folder|disk/i,         'files'    ],
  [/plan|replan|loop|retry/i,              'planning' ],
  [/provider|api|rate.limit|429/i,         'provider' ],
  [/memory|KB|knowledge|embed/i,           'memory'   ],
  [/skill|recipe/i,                        'skills'   ],
  [/error|fail|exception|crash/i,          'errors'   ],
]

function inferCategory(text: string): string {
  for (const [re, cat] of CATEGORY_RULES) {
    if (re.test(text)) return cat
  }
  return 'general'
}

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Parse LESSONS.md into an array of Lesson records.
 * Handles two formats:
 *   N. [date] text
 *   N. text           (no date)
 */
export function parseLessons(): Lesson[] {
  let raw = ''
  try { raw = fs.readFileSync(LESSONS_PATH, 'utf-8') } catch { return [] }

  const lessons: Lesson[] = []
  let inRules = false

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()

    // Enter rules section
    if (/^##\s+Rules/i.test(trimmed)) { inRules = true; continue }

    // Skip headers / metadata / empty lines
    if (!inRules) continue
    if (!trimmed || trimmed.startsWith('#')) continue

    // Match numbered list item
    const m = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (!m) continue

    const id  = parseInt(m[1], 10)
    let text  = m[2]

    // Try to extract date [2026-04-13]
    const dateMatch = text.match(/^\[(\d{4}-\d{2}-\d{2})\]\s+(.+)$/)
    const date   = dateMatch ? dateMatch[1] : ''
    const body   = dateMatch ? dateMatch[2] : text

    // Infer source: if date is today or was explicitly added, call it 'manual' if no brackets
    const source: 'auto' | 'manual' = dateMatch ? 'auto' : 'manual'

    lessons.push({
      id,
      date,
      text:     body,
      category: inferCategory(body),
      source,
    })
  }

  return lessons
}

// ── Writer ────────────────────────────────────────────────────────────────────

/**
 * Append a new lesson rule to LESSONS.md.
 * Returns the new lesson id.
 */
export function appendLesson(text: string): Lesson {
  const existing = parseLessons()
  const id       = (existing[existing.length - 1]?.id ?? 0) + 1
  const date     = new Date().toISOString().slice(0, 10)
  const entry    = `${id}. [${date}] ${text}\n`

  try {
    if (!fs.existsSync(LESSONS_PATH)) {
      const header = '# LESSONS.md — Permanent Failure Rules\n# Auto-appended after task failures.\n\n## Rules\n\n'
      fs.mkdirSync(path.dirname(LESSONS_PATH), { recursive: true })
      fs.writeFileSync(LESSONS_PATH, header + entry, 'utf-8')
    } else {
      fs.appendFileSync(LESSONS_PATH, entry, 'utf-8')
    }
  } catch {}

  return { id, date, text, category: inferCategory(text), source: 'manual' }
}

// ── Filter ────────────────────────────────────────────────────────────────────

/** Filter lessons by keyword and/or category. */
export function filterLessons(
  lessons: Lesson[],
  query?:  string,
  cat?:    string,
): Lesson[] {
  let result = lessons
  if (cat)   result = result.filter(l => l.category === cat)
  if (query) {
    const q = query.toLowerCase()
    result  = result.filter(l => l.text.toLowerCase().includes(q))
  }
  return result
}
