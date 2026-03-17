// ============================================================
// skills/skillLoader.ts — SKILL.md loader
// Scans ./skills/ and ~/.devos/skills/ for SKILL.md folders.
// Compatible with OpenClaw community skill format.
// ============================================================

import * as fs   from 'fs'
import * as path from 'path'
import * as os   from 'os'
import { Skill, SkillMeta } from './types'

const SKILL_DIRS = [
  path.join(process.cwd(), 'skills'),
  path.join(os.homedir(), '.devos', 'skills'),
]

// ── Frontmatter parser (YAML-lite, no dependency) ─────────────

function parseFrontmatter(content: string): { meta: SkillMeta; instructions: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { meta: { name: 'unknown', description: '' }, instructions: content }

  const yamlLines = match[1].split('\n')
  const meta: any = {}

  for (const line of yamlLines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key   = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '')
    // Handle array values like: os: ["win32", "linux"]
    if (value.startsWith('[')) {
      try {
        meta[key] = JSON.parse(value.replace(/'/g, '"'))
      } catch {
        meta[key] = value
      }
    } else {
      meta[key] = value
    }
  }

  return { meta: meta as SkillMeta, instructions: match[2].trim() }
}

// ── Eligibility check (OS + env + bins) ───────────────────────

function isEligible(meta: SkillMeta): boolean {
  // OS filter
  if (meta.os && !meta.os.includes(process.platform as any)) return false

  // Required environment variables
  if (meta.requires?.env) {
    for (const e of meta.requires.env) {
      if (!process.env[e]) return false
    }
  }

  // Required CLI binaries
  if (meta.requires?.bins) {
    for (const bin of meta.requires.bins) {
      try {
        require('child_process').execSync(
          process.platform === 'win32' ? `where ${bin}` : `which ${bin}`,
          { stdio: 'ignore' }
        )
      } catch { return false }
    }
  }

  return true
}

// ── SkillLoader class ─────────────────────────────────────────

class SkillLoader {
  private skills: Map<string, Skill> = new Map()

  load(): void {
    this.skills.clear()

    for (const dir of SKILL_DIRS) {
      if (!fs.existsSync(dir)) continue

      for (const entry of fs.readdirSync(dir)) {
        const skillDir  = path.join(dir, entry)
        const skillFile = path.join(skillDir, 'SKILL.md')

        // Must be a directory containing a SKILL.md
        if (!fs.existsSync(skillFile)) continue

        try {
          const content              = fs.readFileSync(skillFile, 'utf-8')
          const { meta, instructions } = parseFrontmatter(content)

          if (!meta.name) continue

          // First-found wins — workspace dir takes precedence over ~/.devos/skills
          if (this.skills.has(meta.name)) continue

          this.skills.set(meta.name, {
            meta,
            instructions,
            location: skillDir,
            enabled:  isEligible(meta),
          })
        } catch {
          // Silently skip malformed SKILL.md files
        }
      }
    }

    console.log(`[SkillLoader] Loaded ${this.skills.size} skill(s)`)
  }

  getEnabled(): Skill[] {
    return Array.from(this.skills.values()).filter(s => s.enabled)
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values())
  }

  /** Build the <skills> XML block to inject into LLM system prompts */
  buildPromptBlock(): string {
    const enabled = this.getEnabled()
    if (!enabled.length) return ''

    const lines = ['<skills>']
    for (const s of enabled) {
      lines.push(`<skill>`)
      lines.push(`<name>${s.meta.name}</name>`)
      lines.push(`<description>${s.meta.description}</description>`)
      lines.push(`<instructions>${s.instructions}</instructions>`)
      lines.push(`</skill>`)
    }
    lines.push('</skills>')
    return lines.join('\n')
  }

  getStats(): { total: number; enabled: number } {
    return { total: this.skills.size, enabled: this.getEnabled().length }
  }
}

export const skillLoader = new SkillLoader()
skillLoader.load()
