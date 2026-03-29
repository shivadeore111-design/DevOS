// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/morningBriefing.ts — Daily morning briefing: weather, markets, news,
// unfinished tasks, and a proactive automation suggestion.

import path from 'path'
import fs   from 'fs'

const BRIEFING_CONFIG_PATH = path.join(process.cwd(), 'workspace', 'morning-briefing.json')

// ── Types ─────────────────────────────────────────────────────

export interface BriefingConfig {
  enabled:    boolean
  time:       string    // "08:00"
  channels:   string[]  // ['dashboard']
  sections: {
    unfinishedTasks: boolean
    calendar:        boolean
    marketData:      boolean
    weather:         boolean
    news:            boolean
  }
  marketSymbols:      string[]  // ['NIFTY', 'SENSEX'] — learned from memory
  city:               string    // 'Mumbai'
  proactiveSuggestion: boolean
}

const DEFAULT_CONFIG: BriefingConfig = {
  enabled:  false,         // user must opt in
  time:     '08:00',
  channels: ['dashboard'],
  sections: {
    unfinishedTasks: true,
    calendar:        true,
    marketData:      true,
    weather:         true,
    news:            true,
  },
  marketSymbols:       ['NIFTY', 'SENSEX'],
  city:                'Mumbai',
  proactiveSuggestion: true,
}

// ── Config I/O ────────────────────────────────────────────────

export function loadBriefingConfig(): BriefingConfig {
  try {
    if (fs.existsSync(BRIEFING_CONFIG_PATH)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(BRIEFING_CONFIG_PATH, 'utf-8')) }
    }
  } catch {}
  return { ...DEFAULT_CONFIG }
}

export function saveBriefingConfig(config: BriefingConfig): void {
  fs.mkdirSync(path.dirname(BRIEFING_CONFIG_PATH), { recursive: true })
  fs.writeFileSync(BRIEFING_CONFIG_PATH, JSON.stringify(config, null, 2))
}

// ── Briefing generator ────────────────────────────────────────

export async function generateBriefing(config: BriefingConfig): Promise<string> {
  const parts: string[] = []
  const now     = new Date()
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })

  parts.push(`Good morning. It is ${timeStr} on ${dateStr}.`)
  parts.push('')

  // ── Section 1: Unfinished tasks from yesterday ────────────
  if (config.sections.unfinishedTasks) {
    try {
      const { auditTrail } = await import('./auditTrail')
      const entries = auditTrail.getToday()
      const failed  = entries.filter((e: any) => !e.success)
      if (failed.length > 0) {
        const names = failed.map((e: any) => e.tool || e.action).filter(Boolean).slice(0, 3).join(', ')
        parts.push(`**Unfinished from yesterday:** ${failed.length} task${failed.length > 1 ? 's' : ''} did not complete${names ? ' — ' + names : ''}.`)
      } else {
        parts.push(`**Yesterday:** All tasks completed successfully.`)
      }
    } catch {
      parts.push(`**Tasks:** No data from yesterday.`)
    }
  }

  // ── Section 2: Market data — personalised ────────────────
  if (config.sections.marketData && config.marketSymbols.length > 0) {
    try {
      const { executeTool } = await import('./toolRegistry')
      const result = await executeTool('get_market_data', { symbol: config.marketSymbols[0] })
      if (result.success) {
        parts.push(`**Markets:** ${result.output.slice(0, 120)}`)
      }
    } catch {}
  }

  // ── Section 3: Weather — one line ────────────────────────
  if (config.sections.weather) {
    try {
      const { executeTool } = await import('./toolRegistry')
      const result = await executeTool('web_search', { query: `${config.city} weather today` })
      if (result.success) {
        const match = result.output.match(/(\d+).*?\xb0[CF].*?(rain|sun|cloud|clear|humid|hot|warm|cold)/i)
        parts.push(`**Weather:** ${config.city} — ${match ? match[0].slice(0, 60) : result.output.slice(0, 80)}`)
      }
    } catch {}
  }

  // ── Section 4: News — filtered by UserCognition interests ─
  if (config.sections.news) {
    try {
      const { executeTool }       = await import('./toolRegistry')
      const { userCognitionProfile } = await import('./userCognitionProfile')
      const profile = userCognitionProfile.getProfile()
      const topic   = (profile as any)?.interests?.[0] || 'technology India'
      const result  = await executeTool('web_search', { query: `${topic} news today` })
      if (result.success) {
        parts.push(`**News:** ${result.output.slice(0, 150)}`)
      }
    } catch {}
  }

  // ── Section 5: Proactive suggestion from pattern detection ─
  if (config.proactiveSuggestion) {
    try {
      const { userCognitionProfile } = await import('./userCognitionProfile')
      const patterns = userCognitionProfile.detectRepetitivePatterns()
      if (patterns.length > 0) {
        parts.push(`**Suggestion:** ${patterns[0].suggestion}`)
      }
    } catch {}
  }

  return parts.join('\n')
}

// ── Briefing delivery ─────────────────────────────────────────

export async function deliverBriefing(config: BriefingConfig): Promise<void> {
  const briefing = await generateBriefing(config)
  const date     = new Date().toLocaleDateString('en-IN', { month: 'long', day: 'numeric' })

  // Deliver to dashboard — POST as a special briefing event
  try {
    await fetch('http://localhost:4200/api/briefing', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        content:   briefing,
        label:     `Morning Briefing \u00b7 ${date}`,
        type:      'briefing',
      }),
    })
  } catch {}

  // Desktop notification — short punchy hook
  try {
    const { executeTool } = await import('./toolRegistry')
    const firstLine = briefing
      .split('\n')
      .filter(l => l.trim() && !l.startsWith('Good morning'))
      .slice(0, 2)
      .join(' \u00b7 ')
      .slice(0, 100)
    await executeTool('notify', {
      title:   `Good morning — Aiden briefing`,
      message: firstLine,
    })
  } catch {}
}
