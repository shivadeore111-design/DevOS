// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/patternDetector.ts — Feature 21: detect recurring usage patterns
// from session history to surface insights to the user.

import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

// ── Types ──────────────────────────────────────────────────────

export interface DetectedPattern {
  type:        'recurring_query' | 'time_based' | 'workflow'
  description: string
  frequency:   string
  lastSeen:    string
  confidence:  number
}

// ── Stop words — filtered from topic detection ─────────────────

const STOP_WORDS = new Set([
  'what', 'that', 'this', 'with', 'from', 'have',
  'been', 'will', 'they', 'your', 'about', 'would',
  'there', 'their', 'which', 'could', 'other', 'just',
  'more', 'some', 'into', 'than', 'then', 'when',
])

// ── Helpers ────────────────────────────────────────────────────

function findCommonTopic(texts: string[]): string | null {
  const words = new Map<string, number>()
  for (const text of texts) {
    const unique = new Set(
      text.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    )
    for (const word of unique) {
      words.set(word, (words.get(word) || 0) + 1)
    }
  }

  const sorted = [...words.entries()].sort((a, b) => b[1] - a[1])
  for (const [word, count] of sorted) {
    if (!STOP_WORDS.has(word) && count >= 3) return word
  }
  return null
}

// ── Main detector ──────────────────────────────────────────────

export async function detectPatterns(): Promise<DetectedPattern[]> {
  const sessionDir = join(process.cwd(), 'workspace', 'sessions')
  if (!existsSync(sessionDir)) return []

  const files = readdirSync(sessionDir)
    .filter(f => f.endsWith('.json') || f.endsWith('.md'))
    .slice(-30)

  const messages: Array<{ text: string; time: string }> = []

  for (const file of files) {
    try {
      const filePath = join(sessionDir, file)
      const content  = readFileSync(filePath, 'utf-8')

      if (file.endsWith('.json')) {
        const session = JSON.parse(content)
        if (session.messages) {
          session.messages
            .filter((m: any) => m.role === 'user')
            .forEach((m: any) => messages.push({
              text: m.content || '',
              time: session.createdAt || file,
            }))
        }
      } else {
        // Extract user lines from markdown sessions
        const userLines = content
          .split('\n')
          .filter(l => l.startsWith('User:') || l.startsWith('**User:**'))
          .map(l => l.replace(/^\*?\*?User:\*?\*?\s*/, ''))
        userLines.forEach(text => messages.push({ text, time: file }))
      }
    } catch { /* skip unreadable files */ }
  }

  if (messages.length === 0) return []

  const patterns: DetectedPattern[] = []

  // ── Detect recurring queries ─────────────────────────────────
  const queryMap = new Map<string, number>()
  for (const msg of messages) {
    const normalized = msg.text.toLowerCase()
      .replace(/\d+/g, 'N')
      .replace(/\b(today|yesterday|tomorrow)\b/g, 'DAY')
      .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g, 'WEEKDAY')
      .trim()
      .slice(0, 80)

    if (normalized.length > 5) {
      queryMap.set(normalized, (queryMap.get(normalized) || 0) + 1)
    }
  }

  for (const [query, count] of queryMap) {
    if (count >= 3) {
      patterns.push({
        type:        'recurring_query',
        description: `Frequently asked: "${query}"`,
        frequency:   `${count} times in last 30 sessions`,
        lastSeen:    messages[messages.length - 1]?.time || '',
        confidence:  Math.min(count / 10, 1.0),
      })
    }
  }

  // ── Detect time-based patterns ───────────────────────────────
  const hourBuckets = new Map<number, string[]>()
  for (const msg of messages) {
    try {
      const hour = new Date(msg.time).getHours()
      if (isNaN(hour)) continue
      if (!hourBuckets.has(hour)) hourBuckets.set(hour, [])
      hourBuckets.get(hour)!.push(msg.text)
    } catch { /* unparseable timestamp */ }
  }

  for (const [hour, texts] of hourBuckets) {
    if (texts.length >= 5) {
      const topic = findCommonTopic(texts)
      if (topic) {
        patterns.push({
          type:        'time_based',
          description: `Often asks about "${topic}" around ${hour}:00`,
          frequency:   `${texts.length} messages at this hour`,
          lastSeen:    messages[messages.length - 1]?.time || '',
          confidence:  Math.min(texts.length / 15, 1.0),
        })
      }
    }
  }

  return patterns.sort((a, b) => b.confidence - a.confidence)
}

export function getPatternSummary(patterns: DetectedPattern[]): string {
  if (patterns.length === 0) return ''
  return 'Detected patterns:\n' +
    patterns.slice(0, 3).map(p =>
      `- ${p.description} (${p.frequency})`
    ).join('\n')
}
