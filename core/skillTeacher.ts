// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/skillTeacher.ts — Self-learning skill generation.
// After every successful plan execution, records the tool sequence,
// generates a SKILL.md using the LLM, and promotes to "approved"
// after PROMOTE_THRESHOLD successes.

import fs   from 'fs'
import path from 'path'

// ── Types ──────────────────────────────────────────────────────

export interface LearnedSkillMeta {
  name:         string
  taskPattern:  string       // normalized task description
  toolSequence: string[]     // tools used in order
  successCount: number
  failCount:    number
  confidence:   number       // 0–1, increases with successes
  promoted:     boolean      // moved to approved/
  createdAt:    number
  lastUsed:     number
  avgDuration:  number
}

// ── Paths ──────────────────────────────────────────────────────

const LEARNED_DIR       = path.join(process.cwd(), 'workspace', 'skills', 'learned')
const APPROVED_DIR      = path.join(process.cwd(), 'workspace', 'skills', 'approved')
const PROMOTE_THRESHOLD = 3   // successes needed to promote to approved/

// ── LLM caller type — matches callLLM signature ───────────────

type LLMCaller = (prompt: string, apiKey: string, model: string, provider: string) => Promise<string>

// ── Skill name extractor ───────────────────────────────────────
// "research the top AI agents of 2025" → "research_ai_agents"

function extractSkillName(task: string, tools: string[]): string {
  // Use tool sequence to name the skill when pattern is recognisable
  if (tools.includes('deep_research') && tools.includes('file_write')) return 'research_and_save'
  if (tools.includes('web_search')    && tools.includes('file_write')) return 'search_and_save'
  if (tools.includes('get_stocks'))                                     return 'stock_research'
  if (tools.includes('run_python'))                                     return 'python_execution'
  if (tools.includes('run_node'))                                       return 'node_execution'
  if (tools.includes('shell_exec')    && tools.includes('file_write')) return 'shell_and_save'

  // Extract key nouns from task — first 3 meaningful words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on',
    'for', 'of', 'with', 'my', 'your', 'about', 'from',
    'save', 'get', 'find', 'make', 'show', 'tell',
  ])
  const words = task
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 3)

  return words.join('_') || 'general_task'
}

// ── SKILL.md generator ─────────────────────────────────────────

async function generateSkillContent(
  skillName: string,
  task:      string,
  tools:     string[],
  duration:  number,
  llmCaller: LLMCaller,
  apiKey:    string,
  model:     string,
  provider:  string,
): Promise<string> {
  const prompt = `Generate a SKILL.md file for DevOS based on this successful task execution.

Task: "${task}"
Tools used in order: ${tools.join(' → ')}
Duration: ${Math.round(duration / 1000)}s

Write a SKILL.md with this EXACT format:
---
name: ${skillName}
description: [one line description of what this skill does]
version: 1.0.0
confidence: low
tags: [comma separated tags relevant to this task]
---

[2-5 bullet points of key instructions for doing this type of task well]
[Include specific tips learned from this execution]
[Keep it concise — under 200 words total]

Output ONLY the SKILL.md content. No explanation.`

  try {
    const content = await llmCaller(prompt, apiKey, model, provider)
    // Validate it has valid frontmatter
    if (content.includes('---') && content.includes('name:')) {
      return content.trim()
    }
    // Fallback — minimal valid SKILL.md
    return buildFallbackSkill(skillName, task, tools, duration)
  } catch {
    return buildFallbackSkill(skillName, task, tools, duration)
  }
}

function buildFallbackSkill(
  skillName: string,
  task:      string,
  tools:     string[],
  duration:  number,
): string {
  return `---
name: ${skillName}
description: ${task.slice(0, 80)}
version: 1.0.0
confidence: low
tags: ${tools.join(', ')}
---

When performing this type of task:
1. Use tools in this order: ${tools.join(' → ')}
2. Task completed in ~${Math.round(duration / 1000)}s
3. Verify each step output before proceeding to the next
`
}

// ── SkillTeacher ───────────────────────────────────────────────

export class SkillTeacher {
  private static instance: SkillTeacher

  private constructor() {
    try { fs.mkdirSync(LEARNED_DIR,  { recursive: true }) } catch {}
    try { fs.mkdirSync(APPROVED_DIR, { recursive: true }) } catch {}
  }

  static getInstance(): SkillTeacher {
    if (!SkillTeacher.instance) {
      SkillTeacher.instance = new SkillTeacher()
    }
    return SkillTeacher.instance
  }

  // ── Check if a matching skill already exists ──────────────

  hasMatchingSkill(task: string, tools: string[]): boolean {
    const skillName = extractSkillName(task, tools)

    const dirsToCheck = [
      path.join(process.cwd(), 'skills'),
      LEARNED_DIR,
      APPROVED_DIR,
    ]

    for (const dir of dirsToCheck) {
      try {
        if (fs.existsSync(dir) && fs.existsSync(path.join(dir, skillName))) return true
      } catch {}
    }
    return false
  }

  // ── Record a successful task ───────────────────────────────

  async recordSuccess(
    task:      string,
    tools:     string[],
    duration:  number,
    llmCaller: LLMCaller,
    apiKey:    string,
    model:     string,
    provider:  string,
  ): Promise<void> {
    if (tools.length === 0) return

    const skillName = extractSkillName(task, tools)
    const metaPath  = path.join(LEARNED_DIR, skillName, 'meta.json')
    const skillPath = path.join(LEARNED_DIR, skillName, 'SKILL.md')

    // ── If skill exists — update usage count ─────────────────
    if (fs.existsSync(metaPath)) {
      try {
        const meta: LearnedSkillMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        meta.successCount++
        meta.lastUsed    = Date.now()
        meta.avgDuration = Math.round((meta.avgDuration + duration) / 2)
        meta.confidence  = Math.min(meta.successCount / PROMOTE_THRESHOLD, 1)

        if (meta.successCount >= PROMOTE_THRESHOLD && !meta.promoted) {
          this.promoteSkill(skillName)
          meta.promoted = true
          console.log(`[SkillTeacher] Promoted "${skillName}" → approved/ (${meta.successCount} successes)`)
        }

        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
        console.log(`[SkillTeacher] Updated "${skillName}" — ${meta.successCount} successes, confidence: ${(meta.confidence * 100).toFixed(0)}%`)
      } catch (e: any) {
        console.warn(`[SkillTeacher] Meta update failed for "${skillName}": ${e.message}`)
      }
      return
    }

    // ── Quality gate — reject low-signal skill names ──────────
    const isLowQuality = (
      skillName.length < 5 ||
      skillName.split('_').length < 2 ||
      task.split(/\s+/).length < 3
    )
    if (isLowQuality) {
      console.log(`[SkillTeacher] Rejected low-quality skill: "${skillName}"`)
      return
    }

    // ── Deduplication — reject names already in approved/ ─────
    const approvedNames = fs.existsSync(APPROVED_DIR)
      ? fs.readdirSync(APPROVED_DIR).filter(d => {
          try { return fs.statSync(path.join(APPROVED_DIR, d)).isDirectory() } catch { return false }
        })
      : []
    if (approvedNames.includes(skillName)) {
      console.log(`[SkillTeacher] Skipping duplicate (already approved): "${skillName}"`)
      return
    }

    // ── New skill — generate SKILL.md and write meta ──────────
    console.log(`[SkillTeacher] Learning new skill: "${skillName}" from task: "${task.slice(0, 60)}"`)

    try {
      const content = await generateSkillContent(
        skillName, task, tools, duration,
        llmCaller, apiKey, model, provider,
      )

      fs.mkdirSync(path.join(LEARNED_DIR, skillName), { recursive: true })
      fs.writeFileSync(skillPath, content, 'utf-8')

      const meta: LearnedSkillMeta = {
        name:         skillName,
        taskPattern:  task.slice(0, 100),
        toolSequence: tools,
        successCount: 1,
        failCount:    0,
        confidence:   1 / PROMOTE_THRESHOLD,
        promoted:     false,
        createdAt:    Date.now(),
        lastUsed:     Date.now(),
        avgDuration:  duration,
      }

      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
      console.log(`[SkillTeacher] Saved new skill: "${skillName}"`)

      // Invalidate skillLoader cache so new skill is picked up immediately
      try {
        const { skillLoader } = await import('./skillLoader')
        skillLoader.refresh()
      } catch {}

    } catch (e: any) {
      console.warn(`[SkillTeacher] Failed to generate skill "${skillName}": ${e.message}`)
    }
  }

  // ── Record a failed task ───────────────────────────────────

  recordFailure(task: string, tools: string[]): void {
    if (tools.length === 0) return
    const skillName = extractSkillName(task, tools)
    const metaPath  = path.join(LEARNED_DIR, skillName, 'meta.json')
    if (!fs.existsSync(metaPath)) return
    try {
      const meta: LearnedSkillMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      meta.failCount++
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
    } catch {}
  }

  // ── Promote skill from learned/ to approved/ ───────────────

  private promoteSkill(skillName: string): void {
    const src  = path.join(LEARNED_DIR,  skillName)
    const dest = path.join(APPROVED_DIR, skillName)
    try {
      fs.mkdirSync(dest, { recursive: true })
      for (const file of fs.readdirSync(src)) {
        fs.copyFileSync(path.join(src, file), path.join(dest, file))
      }
      // Invalidate cache after promotion
      import('./skillLoader').then(m => m.skillLoader.refresh()).catch(() => {})
    } catch (e: any) {
      console.warn(`[SkillTeacher] Promotion failed for "${skillName}": ${e.message}`)
    }
  }

  // ── List helpers ───────────────────────────────────────────

  private readDir(dir: string): LearnedSkillMeta[] {
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(d => {
        try { return fs.statSync(path.join(dir, d)).isDirectory() } catch { return false }
      })
      .map(name => {
        try {
          const metaPath = path.join(dir, name, 'meta.json')
          if (fs.existsSync(metaPath)) {
            return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as LearnedSkillMeta
          }
          return { name, successCount: 0, failCount: 0, confidence: 0 } as LearnedSkillMeta
        } catch {
          return { name, successCount: 0, failCount: 0, confidence: 0 } as LearnedSkillMeta
        }
      })
  }

  listLearned(): LearnedSkillMeta[] {
    return this.readDir(LEARNED_DIR)
  }

  listApproved(): LearnedSkillMeta[] {
    return this.readDir(APPROVED_DIR)
  }

  getStats(): { learned: number; approved: number; totalSuccesses: number } {
    const learned         = this.listLearned()
    const approved        = this.listApproved()
    const totalSuccesses  = learned.reduce((s, m) => s + (m.successCount || 0), 0)
    return { learned: learned.length, approved: approved.length, totalSuccesses }
  }
}

export const skillTeacher = SkillTeacher.getInstance()
