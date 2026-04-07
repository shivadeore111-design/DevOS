// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/patternDetector.ts — Scans session history to surface
// recurring queries and usage patterns.

import { existsSync, readdirSync, readFileSync } from 'fs'
import { join }                                  from 'path'

const SESSION_DIR = join(process.cwd(), 'workspace', 'sessions')

// ── Types ─────────────────────────────────────────────────────

export interface DetectedPattern {
  type:        'recurring_query' | 'time_based'
  description: string
  frequency:   string
  confidence:  number
}

// ── Stop words ────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'what', 'that', 'this', 'with', 'from', 'have',
  'been', 'will', 'they', 'your', 'about', 'would',
  'there', 'their', 'which', 'could', 'other', 'just',
])

// ── Helpers ───────────────────────────────────────────────────

function findCommonTopic(texts: string[]): string | null {
  const words = new Map<string, number>()
  for (const text of texts) {
    new Set(
      text.toLowerCase().split(/\W+/).filter(w => w.length > 3),
    ).forEach(w => words.set(w, (words.get(w) || 0) + 1))
  }
  for (const [word, count] of [...words.entries()].sort((a, b) => b[1] - a[1])) {
    if (!STOP_WORDS.has(word) && count >= 3) return word
  }
  return null
}

// ── Main detector ─────────────────────────────────────────────

export async function detectPatterns(): Promise<DetectedPattern[]> {
  if (!existsSync(SESSION_DIR)) return []

  const messages: { text: string; time: string }[] = []

  for (const file of readdirSync(SESSION_DIR).slice(-30)) {
    try {
      const content = readFileSync(join(SESSION_DIR, file), 'utf8')
      if (file.endsWith('.json')) {
        const session = JSON.parse(content) as any
        ;(session.messages ?? [])
          .filter((m: any) => m.role === 'user')
          .forEach((m: any) => messages.push({
            text: m.content || '',
            time: session.createdAt || file,
          }))
      }
    } catch {}
  }

  if (messages.length === 0) return []

  const patterns:  DetectedPattern[]       = []
  const queryMap:  Map<string, number>     = new Map()

  for (const msg of messages) {
    const norm = msg.text.toLowerCase()
      .replace(/\d+/g, 'N')
      .replace(/\b(today|yesterday|tomorrow)\b/g, 'DAY')
      .trim()
      .slice(0, 80)
    if (norm.length > 5) {
      queryMap.set(norm, (queryMap.get(norm) || 0) + 1)
    }
  }

  for (const [query, count] of queryMap) {
    if (count >= 3) {
      patterns.push({
        type:        'recurring_query',
        description: `Frequently asked: "${query}"`,
        frequency:   `${count} times`,
        confidence:  Math.min(count / 10, 1.0),
      })
    }
  }

  return patterns.sort((a, b) => b.confidence - a.confidence)
}

export function getPatternSummary(patterns: DetectedPattern[]): string {
  if (patterns.length === 0) return ''
  return 'Detected usage patterns:\n' +
    patterns.slice(0, 3).map(p => `- ${p.description} (${p.frequency})`).join('\n')
}
