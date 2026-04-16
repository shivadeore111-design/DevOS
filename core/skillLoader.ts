// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/skillLoader.ts — Loads SKILL.md files and injects relevant
// skill context into the planner and responder prompts.

import fs   from 'fs'
import path from 'path'

// ── Skill injection guard ─────────────────────────────────────

const SKILL_INJECTION_PATTERNS: RegExp[] = [
  // ── Original patterns ──────────────────────────────────────
  /ignore\s+(all\s+)?(previous|above|prior)/i,
  /disregard\s+(all\s+)?(previous|above)/i,
  /you\s+are\s+now\s+/i,
  /new\s+instructions\s*:/i,
  /override\s+system/i,
  /curl\s+.*\|\s*bash/i,
  /ANTHROPIC_BASE_URL/i,
  /\]\s*\(\s*javascript:/i,

  // ── Role hijacking ─────────────────────────────────────────
  /act\s+as\s+(if\s+you\s+are|a|an)\s/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /roleplay\s+as/i,
  /you\s+must\s+obey/i,
  /your\s+new\s+(role|instruction|directive)/i,

  // ── Indirect injection (model-control tokens) ──────────────
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
  /<\|system\|>/i,
  /<<\s*SYS\s*>>/i,
  /###\s*instruction/i,

  // ── Encoded / obfuscated payloads ──────────────────────────
  /base64\s*decode/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /import\s+os/i,
  /subprocess/i,
  /\\x[0-9a-f]{2}/i,

  // ── Data exfiltration ──────────────────────────────────────
  /send\s+(to|via)\s+(http|email|webhook|api)/i,
  /upload\s+(to|file|data)/i,
  /curl\s+.*-d\s/i,
  /fetch\s*\(\s*['"]http/i,

  // ── Privilege escalation ───────────────────────────────────
  /admin\s*(mode|access|privilege)/i,
  /sudo\s/i,
  /run\s+as\s+administrator/i,
  /elevation\s+prompt/i,
]

function sanitizeSkill(content: string, filename: string): string | null {
  for (const pattern of SKILL_INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      console.warn(`[Security] BLOCKED skill "${filename}": contains injection pattern`)
      return null
    }
  }
  return content
}

function validateSkillStructure(content: string): { valid: boolean; reason?: string } {
  // Must have at least one markdown header if the file is substantial
  if (!content.includes('#') && content.length > 500) {
    return { valid: false, reason: 'No markdown headers — suspicious format' }
  }

  // Suspiciously long single paragraph (likely injection payload)
  const lines       = content.split('\n')
  const longLines   = lines.filter(l => l.length > 500)
  if (longLines.length > 3) {
    return { valid: false, reason: 'Multiple very long lines — possible injection' }
  }

  // Too much code relative to documentation
  const codeBlocks = (content.match(/```/g) || []).length / 2
  const totalLines = lines.length
  if (codeBlocks > 0 && codeBlocks * 10 > totalLines) {
    return { valid: false, reason: 'More code than documentation — suspicious skill' }
  }

  // Must be under 10 KB (skills should be concise)
  if (content.length > 10240) {
    return { valid: false, reason: 'Skill too large (>10KB) — possible payload' }
  }

  return { valid: true }
}

const BLOCKED_LOG = path.join(process.cwd(), 'workspace', 'blocked-skills.log')

function logBlockedSkill(filename: string, reason: string): void {
  try {
    fs.mkdirSync(path.dirname(BLOCKED_LOG), { recursive: true })
    fs.appendFileSync(
      BLOCKED_LOG,
      `${new Date().toISOString()} | BLOCKED: ${filename} | ${reason}\n`,
    )
  } catch {}
}

// ── Types ──────────────────────────────────────────────────────

export interface Skill {
  name:        string
  description: string
  version:     string
  tags:        string[]
  content:     string
  filePath:    string
  origin:      'aiden' | 'community' | 'local'
}

// Keywords that map skills to task categories
const KEYWORD_MAP: Record<string, string[]> = {
  web:      ['search', 'browse', 'fetch', 'scrape', 'website', 'url', 'internet', 'online', 'news', 'weather'],
  file:     ['create', 'write', 'read', 'save', 'file', 'document', 'report', 'desktop', 'folder'],
  code:     ['code', 'script', 'python', 'node', 'javascript', 'typescript', 'program', 'build', 'run', 'execute'],
  research: ['research', 'analyze', 'compare', 'study', 'investigate', 'find', 'gather', 'information'],
  deploy:   ['deploy', 'vercel', 'github', 'push', 'publish', 'release', 'launch'],
  system:   ['system', 'computer', 'machine', 'disk', 'cpu', 'memory', 'process'],
}

// ── SkillLoader ────────────────────────────────────────────────

export class SkillLoader {
  private skillsDirs: string[]
  private cache: Skill[] | null = null

  constructor() {
    // Check built-in skills, workspace skills, and self-learned/promoted skills
    this.skillsDirs = [
      path.join(process.cwd(), 'skills'),
      path.join(process.cwd(), 'workspace', 'skills'),
      path.join(process.cwd(), 'workspace', 'skills', 'learned'),
      path.join(process.cwd(), 'workspace', 'skills', 'approved'),
    ].filter(d => {
      try { return fs.existsSync(d) } catch { return false }
    })
  }

  // loadAllRaw — bypasses the disabled-skills filter
  // Used by GET /api/skills so the UI can show disabled skills too
  loadAllRaw(): Skill[] {
    return this.loadAll(/* includeDisabled */ true)
  }

  loadAll(includeDisabled = false): Skill[] {
    if (!includeDisabled && this.cache) return this.cache

    const skills: Skill[] = []

    for (const dir of this.skillsDirs) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          const skillPath = path.join(dir, entry.name, 'SKILL.md')
          if (!fs.existsSync(skillPath)) continue
          try {
            const fileContent = fs.readFileSync(skillPath, 'utf-8')
            const sanitized   = sanitizeSkill(fileContent, entry.name)
            if (!sanitized) {
              logBlockedSkill(entry.name, 'injection pattern detected')
              continue
            }
            const structure = validateSkillStructure(sanitized)
            if (!structure.valid) {
              console.log(`[Skills] BLOCKED (structure): ${entry.name} — ${structure.reason}`)
              logBlockedSkill(entry.name, structure.reason ?? 'structure check failed')
              continue
            }
            const parsed = this.parse(sanitized, skillPath)
            if (parsed) skills.push(parsed)
          } catch {}
        }
      } catch {}
    }

    // Deduplicate by name — later directories (approved > learned) take precedence.
    // skillsDirs order: built-in → workspace → learned → approved.
    // Since we iterate in that order, the last entry for a given name wins (approved beats learned).
    const seen = new Map<string, Skill>()
    for (const skill of skills) {
      seen.set(skill.name, skill)
    }
    const deduped = Array.from(seen.values())

    if (deduped.length < skills.length) {
      console.log(`[SkillLoader] Deduplicated ${skills.length} → ${deduped.length} skills (removed ${skills.length - deduped.length} duplicates)`)
    }

    // Filter out disabled skills (unless caller wants all)
    const DISABLED_PATH = path.join(process.cwd(), 'workspace', 'disabled-skills.json')
    let disabled: Set<string> = new Set()
    if (!includeDisabled) {
      try {
        const raw = fs.readFileSync(DISABLED_PATH, 'utf-8')
        disabled  = new Set(JSON.parse(raw) as string[])
      } catch {}
    }

    const filtered = includeDisabled ? deduped : deduped.filter(s => !disabled.has(s.name))

    if (!includeDisabled) {
      this.cache = filtered
      if (filtered.length > 0) {
        console.log(`[SkillLoader] Loaded ${filtered.length} skills: ${filtered.map(s => s.name).join(', ')}`)
      }
    }

    return filtered
  }

  private parse(raw: string, filePath: string): Skill | null {
    try {
      const match = raw.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/)

      const origin: 'aiden' | 'community' | 'local' =
        filePath.includes(path.sep + 'workspace' + path.sep) ? 'local' : 'aiden'

      if (!match) {
        // No frontmatter — use directory name as skill name
        const name = path.basename(path.dirname(filePath))
        return { name, description: name, version: '1.0.0', tags: [name], content: raw.trim(), filePath, origin }
      }

      const frontmatter = match[1]
      const content     = match[2].trim()

      const get = (key: string): string => {
        const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
        return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : ''
      }

      const tagsRaw = get('tags')
      const tags    = tagsRaw
        ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
        : []

      const name = get('name') || path.basename(path.dirname(filePath))

      return {
        name,
        description: get('description'),
        version:     get('version') || '1.0.0',
        tags,
        content,
        filePath,
        origin,
      }
    } catch { return null }
  }

  findRelevant(message: string, maxSkills = 3): Skill[] {
    const skills = this.loadAll()
    if (skills.length === 0) return []

    const lower = message.toLowerCase()
    const words = lower.split(/\s+/)

    // Detect categories from message text
    const matchedCategories = new Set<string>()
    for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
      if (keywords.some(kw => lower.includes(kw))) {
        matchedCategories.add(category)
      }
    }

    // Score each skill by relevance
    const scored = skills.map(skill => {
      let score = 0

      // Exact name match in message
      if (lower.includes(skill.name.toLowerCase())) score += 10

      // Description word overlap
      const descWords = skill.description.toLowerCase().split(/\s+/)
      words.forEach(w => { if (w.length > 3 && descWords.includes(w)) score += 3 })

      // Direct tag match
      skill.tags.forEach(tag => {
        if (lower.includes(tag)) score += 5
        if (matchedCategories.has(tag)) score += 4
      })

      // Category match
      matchedCategories.forEach(cat => {
        if (skill.tags.includes(cat)) score += 6
      })

      return { skill, score }
    })

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSkills)
      .map(s => s.skill)
  }

  formatForPrompt(skills: Skill[]): string {
    if (skills.length === 0) return ''

    const formatted = skills.map(s =>
      `[SKILL: ${s.name}]\nDescription: ${s.description}\n${s.content.slice(0, 500)}`,
    ).join('\n\n---\n\n')

    return `\n\nRELEVANT SKILLS FOR THIS TASK:\n${formatted}\n\nUse these skill instructions to guide your planning.\n`
  }

  // Invalidate cache — call after new skills are added at runtime
  refresh(): void {
    this.cache = null
  }
}

export const skillLoader = new SkillLoader()
