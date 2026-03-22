// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personal/dawnReport.ts — Daily morning briefing (v3, Dawn)
//
// Pulls overnight pilot results, active goal progress, monitor alerts.
// Calls LLM → plain English, conversational, no bullet lists.
// Format: "Good morning [name]. Here's what happened: [2-3 sentences].
//          [One recommendation]."
//
// Exposed via: GET /api/personal/dawn

import * as fs   from 'fs'
import * as path from 'path'
import * as http from 'http'
import { userProfile }     from '../personality/userProfile'
import { goalStore }       from '../goals/goalStore'
import { alwaysOn }        from './alwaysOn'
import { wrapWithPersona } from '../personality/devosPersonality'

const REPORTS_DIR = path.join(process.cwd(), 'workspace', 'reports')
const CACHE_FILE  = path.join(process.cwd(), 'workspace', 'dawn-cache.json')

interface DawnCache {
  date:      string   // YYYY-MM-DD
  briefing:  string
}

// ── Disk helpers ──────────────────────────────────────────────────────────

function loadCache(): DawnCache | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) as DawnCache
    }
  } catch { /* corrupt */ }
  return null
}

function saveCache(briefing: string): void {
  const dir = path.dirname(CACHE_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const cache: DawnCache = {
    date:     new Date().toISOString().slice(0, 10),
    briefing,
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
}

// ── Report reader ─────────────────────────────────────────────────────────

function readOvernightReports(): string {
  if (!fs.existsSync(REPORTS_DIR)) return ''
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const dateStr = yesterday.toISOString().slice(0, 10)  // YYYY-MM-DD

  const files = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.md') && f.includes(dateStr))
    .sort()

  if (files.length === 0) {
    // Fall back to most recent reports (any date)
    const allMd = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.md')).sort().slice(-4)
    if (allMd.length === 0) return ''
    return allMd.map(f => {
      const content = fs.readFileSync(path.join(REPORTS_DIR, f), 'utf-8')
      return `[${f}]\n${content.slice(0, 600)}`
    }).join('\n\n---\n\n').slice(0, 2000)
  }

  return files.map(f => {
    const content = fs.readFileSync(path.join(REPORTS_DIR, f), 'utf-8')
    return `[${f}]\n${content.slice(0, 600)}`
  }).join('\n\n---\n\n').slice(0, 2000)
}

// ── LLM call ──────────────────────────────────────────────────────────────

function callOllamaSync(system: string, user: string): Promise<string> {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model:   'mistral-nemo:12b',
      prompt:  user,
      system,
      stream:  false,
      options: { num_predict: 180, temperature: 0.4 },
    })

    const req = http.request(
      { hostname: 'localhost', port: 11434, path: '/api/generate', method: 'POST' },
      (res) => {
        let data = ''
        res.on('data', (c) => data += c)
        res.on('end', () => {
          try   { resolve(JSON.parse(data).response || '') }
          catch { resolve('') }
        })
      },
    )
    req.on('error', () => resolve(''))
    req.setTimeout(15_000, () => { req.destroy(); resolve('') })
    req.write(body)
    req.end()
  })
}

// ── DawnReport class ──────────────────────────────────────────────────────

class DawnReport {

  /**
   * Generate the morning briefing.
   * Returns cached version if already generated today.
   */
  async generate(force = false): Promise<string> {
    const today = new Date().toISOString().slice(0, 10)

    // Return cached if same calendar day and not forced
    if (!force) {
      const cache = loadCache()
      if (cache && cache.date === today) return cache.briefing
    }

    const profile      = userProfile.loadProfile()
    const name         = profile.name || 'there'
    const activeGoals  = goalStore.listGoals('active')
    const pendingGoals = goalStore.listGoals('pending')
    const agentSummary = alwaysOn.summary()
    const reports      = readOvernightReports()

    // Build context for LLM
    const goalContext = activeGoals.length > 0
      ? `Currently running: ${activeGoals.map(g => g.title).slice(0, 3).join(', ')}.`
      : pendingGoals.length > 0
      ? `${pendingGoals.length} goal(s) pending.`
      : 'No active goals.'

    const agentContext = agentSummary
      .filter(a => a.status !== 'disabled')
      .map(a => `${a.name} (${a.status})`)
      .join(', ')

    const reportContext = reports
      ? `\nOvernight pilot reports:\n${reports}`
      : '\nNo overnight pilot reports yet.'

    const prompt = `Write a morning briefing for ${name}.
${goalContext}
Background agents: ${agentContext || 'none configured'}.${reportContext}

Format: Start with "Good morning, ${name}." Then 2-3 sentences describing what happened or is notable. End with one concrete recommendation for today — something specific, not generic.
No bullet points. No headers. Conversational tone. Keep it under 120 words.`

    const { system, user } = wrapWithPersona(prompt)
    const llmResponse      = await callOllamaSync(system, user)

    const briefing = llmResponse.trim() || this.fallback(name, activeGoals.length)
    saveCache(briefing)
    return briefing
  }

  private fallback(name: string, activeCount: number): string {
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    return `${greeting}, ${name}. DevOS is online. ` +
      (activeCount > 0
        ? `You have ${activeCount} active goal${activeCount !== 1 ? 's' : ''} running in the background. `
        : 'No goals are running right now. ') +
      'What are we building today?'
  }

  /** Clear the daily cache — forces fresh generation next call */
  clearCache(): void {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE)
  }

  /** True if a briefing was already generated today */
  isGeneratedToday(): boolean {
    const cache = loadCache()
    return cache?.date === new Date().toISOString().slice(0, 10)
  }
}

export const dawnReport = new DawnReport()
