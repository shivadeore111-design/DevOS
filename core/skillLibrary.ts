// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/skillLibrary.ts — Browser against the taracodlabs/aiden-skills
// library. Fetches INDEX.json, scores skills by topic relevance,
// and installs selected skills to skills/installed/<id>/.

import https  from 'https'
import http   from 'http'
import { writeSkillDraft } from './skillWriter'

// ── Constants ─────────────────────────────────────────────────

const LIBRARY_BASE_URL =
  process.env.AIDEN_SKILL_LIBRARY_URL ??
  'https://raw.githubusercontent.com/taracodlabs/aiden-skills/main'

const INDEX_CACHE_TTL_MS = 60 * 60 * 1000  // 1 hour

// ── Types ─────────────────────────────────────────────────────

export interface LibrarySkillEntry {
  id:           string
  name:         string
  category:     string
  description:  string
  platform:     string
  version:      string
  tags:         string[]
  env_required: string[]
  path:         string
}

export interface LibraryIndex {
  library_version: string
  generated_at:    string
  skill_count:     number
  skills:          LibrarySkillEntry[]
}

export interface ScoredSkill extends LibrarySkillEntry {
  score: number
}

export interface InstalledSkill {
  id:       string
  filePath: string
  dir:      string
}

// ── In-memory cache ───────────────────────────────────────────

let _indexCache:     LibraryIndex | null = null
let _indexCachedAt:  number = 0

// ── fetchText ─────────────────────────────────────────────────
// Minimal HTTPS/HTTP GET returning text. No external dependencies.

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: 10000 }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchText(res.headers.location!).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)) })
  })
}

// ── fetchIndex ────────────────────────────────────────────────
// GET INDEX.json from library, with 1-hour in-memory cache.

export async function fetchIndex(): Promise<LibraryIndex> {
  const now = Date.now()
  if (_indexCache && now - _indexCachedAt < INDEX_CACHE_TTL_MS) {
    return _indexCache
  }
  const url  = `${LIBRARY_BASE_URL}/INDEX.json`
  const text = await fetchText(url)
  const idx  = JSON.parse(text) as LibraryIndex
  _indexCache    = idx
  _indexCachedAt = now
  return idx
}

// ── fetchSkillMarkdown ─────────────────────────────────────────
// Fetch raw SKILL.md content for a specific skill ID.

export async function fetchSkillMarkdown(skillId: string): Promise<string> {
  const idx   = await fetchIndex()
  const entry = idx.skills.find(s => s.id === skillId)
  if (!entry) throw new Error(`Skill "${skillId}" not found in library index`)
  const url = `${LIBRARY_BASE_URL}/${entry.path}`
  return fetchText(url)
}

// ── scoreSkillsForTopic ────────────────────────────────────────
// Returns library skills scored by relevance to a topic string.
// Scoring: exact id/name match (+10), description word overlap (+3 each),
// category match (+6), tag match (+5 each).

export function scoreSkillsForTopic(topic: string, index: LibraryIndex): ScoredSkill[] {
  const lower = topic.toLowerCase()
  const words = lower.split(/\s+/).filter(w => w.length > 2)

  return index.skills
    .map(entry => {
      let score = 0
      const name = entry.name.toLowerCase()
      const desc = entry.description.toLowerCase()
      const cat  = entry.category.toLowerCase()

      if (name.includes(lower) || lower.includes(name)) score += 10
      if (lower.includes(entry.id.toLowerCase()))       score += 10
      words.forEach(w => { if (desc.includes(w)) score += 3 })
      if (cat.includes(lower) || lower.includes(cat))   score += 6
      entry.tags.forEach(tag => {
        if (lower.includes(tag.toLowerCase()) || tag.toLowerCase().includes(lower)) score += 5
      })
      words.forEach(w => {
        entry.tags.forEach(tag => { if (tag.toLowerCase().includes(w)) score += 2 })
      })

      return { ...entry, score }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
}

// ── installSkill ──────────────────────────────────────────────
// Fetches a skill from the library and writes it to skills/installed/<id>/.
// The skill is written with enabled: false — user must enable explicitly.

export async function installSkill(skillId: string): Promise<InstalledSkill> {
  const idx   = await fetchIndex()
  const entry = idx.skills.find(s => s.id === skillId)
  if (!entry) throw new Error(`Skill "${skillId}" not found in library`)

  const markdown = await fetchSkillMarkdown(skillId)

  // Strip existing frontmatter and let writeSkillDraft rebuild it cleanly
  const bodyMatch = markdown.match(/^---[\s\S]*?---\s*([\s\S]*)$/)
  const body = bodyMatch ? bodyMatch[1].trim() : markdown.trim()

  const written = await writeSkillDraft({
    name:        entry.name,
    description: entry.description,
    category:    entry.category,
    platform:    (entry.platform as 'any' | 'windows' | 'linux' | 'macos') ?? 'any',
    tags:        entry.tags,
    version:     entry.version,
    content:     body,
    source:      'library_install',
    sourceDetails: {
      libraryId:    entry.id,
      libraryUrl:   LIBRARY_BASE_URL,
      installedAt:  new Date().toISOString(),
      envRequired:  entry.env_required,
    },
  }, 'installed')

  return written
}

// ── invalidateCache ───────────────────────────────────────────
// Force-expire the index cache (e.g. after manual refresh).

export function invalidateCache(): void {
  _indexCache    = null
  _indexCachedAt = 0
}
