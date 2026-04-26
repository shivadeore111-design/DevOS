// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/skillWriter.ts — Writes auto-generated skill drafts to disk.
// Used by A2 (/learn), A3 (passiveSkillObserver), and A4 (skillLibrary install).

import fs   from 'fs'
import path from 'path'

// ── Types ──────────────────────────────────────────────────────

export interface SkillDraft {
  name:          string
  description:   string
  category?:     string
  platform?:     'any' | 'windows' | 'linux' | 'macos'
  tags?:         string[]
  version?:      string
  content:       string
  source:        'user_learn' | 'passive_observer' | 'library_install'
  sourceDetails?: Record<string, unknown>
}

export interface WrittenSkill {
  id:       string   // sanitized dir name
  filePath: string
  dir:      string
}

export interface SkillMeta {
  name:        string
  description: string
  category?:   string
  platform?:   string
  version?:    string
  tags?:       string[]
  origin?:     string
  enabled?:    boolean
  source?:     string
  [key: string]: unknown
}

// ── sanitizeSkillId ────────────────────────────────────────────
// Converts an arbitrary skill name to a safe directory/id slug.

export function sanitizeSkillId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'unnamed-skill'
}

// ── validateFrontmatter ────────────────────────────────────────
// Validates YAML frontmatter (between --- markers).

export function validateFrontmatter(content: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const match = content.match(/^---\s*([\s\S]*?)\s*---/)
  if (!match) { errors.push('Missing frontmatter (--- block)'); return { valid: false, errors } }
  const fm = match[1]
  if (!fm.match(/^name:\s*.+$/m))        errors.push('Missing required field: name')
  if (!fm.match(/^description:\s*.+$/m)) errors.push('Missing required field: description')
  return { valid: errors.length === 0, errors }
}

// ── buildFrontmatter ───────────────────────────────────────────
// Renders a frontmatter YAML block from a SkillMeta object.

export function buildFrontmatter(meta: SkillMeta): string {
  const lines: string[] = ['---']
  lines.push(`name: ${meta.name}`)
  lines.push(`description: ${meta.description}`)
  if (meta.category)         lines.push(`category: ${meta.category}`)
  if (meta.platform)         lines.push(`platform: ${meta.platform ?? 'any'}`)
  lines.push(`version: ${meta.version ?? '1.0.0'}`)
  const tags = (meta.tags ?? []).join(', ')
  lines.push(`tags: [${tags}]`)
  if (meta.origin)           lines.push(`origin: ${meta.origin}`)
  lines.push(`enabled: ${meta.enabled ?? false}`)
  if (meta.source)           lines.push(`source: ${meta.source}`)
  lines.push('---')
  return lines.join('\n')
}

// ── writeSkillDraft ────────────────────────────────────────────
// Writes a SkillDraft to `skills/learned/pending/<id>/SKILL.md`
// or `skills/installed/<id>/SKILL.md`.
// Throws if the directory already exists (no silent overwrite).

export async function writeSkillDraft(
  draft: SkillDraft,
  targetDir: 'pending' | 'installed',
): Promise<WrittenSkill> {
  const cwd = process.cwd()
  const id  = sanitizeSkillId(draft.name)

  const baseDir = targetDir === 'installed'
    ? path.join(cwd, 'skills', 'installed')
    : path.join(cwd, 'skills', 'learned', 'pending')

  const dir = path.join(baseDir, id)

  if (fs.existsSync(dir)) {
    throw new Error(`Skill "${id}" already exists at ${dir}. Use a different name or delete the existing draft.`)
  }

  fs.mkdirSync(dir, { recursive: true })

  const frontmatter = buildFrontmatter({
    name:        draft.name,
    description: draft.description,
    category:    draft.category,
    platform:    draft.platform ?? 'any',
    version:     draft.version  ?? '1.0.0',
    tags:        draft.tags     ?? [],
    origin:      draft.source === 'library_install' ? 'community' : 'local',
    enabled:     false,
    source:      draft.source,
  })

  const timestamp = new Date().toISOString()
  const header    = `<!-- auto-generated: ${timestamp} -->\n`
  const body      = draft.content.trim()
  const fileContent = `${frontmatter}\n\n${header}${body}\n`

  const filePath = path.join(dir, 'SKILL.md')
  fs.writeFileSync(filePath, fileContent, 'utf-8')

  // Write metadata sidecar (for review UI)
  const meta = {
    id,
    name:          draft.name,
    description:   draft.description,
    source:        draft.source,
    sourceDetails: draft.sourceDetails ?? {},
    createdAt:     timestamp,
    enabled:       false,
  }
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf-8')

  return { id, filePath, dir }
}

// ── approveDraft ──────────────────────────────────────────────
// Moves a pending skill to skills/learned/approved/ and sets enabled:true.

export function approveDraft(id: string): string {
  const cwd      = process.cwd()
  const pendDir  = path.join(cwd, 'skills', 'learned', 'pending',  id)
  const approDir = path.join(cwd, 'skills', 'learned', 'approved', id)

  if (!fs.existsSync(pendDir)) throw new Error(`Pending skill "${id}" not found`)
  if (fs.existsSync(approDir)) throw new Error(`Approved skill "${id}" already exists`)

  // Enable in SKILL.md before moving
  const skillFile = path.join(pendDir, 'SKILL.md')
  if (fs.existsSync(skillFile)) {
    let content = fs.readFileSync(skillFile, 'utf-8')
    content = content.replace(/^enabled:\s*false/m, 'enabled: true')
    fs.writeFileSync(skillFile, content, 'utf-8')
  }

  fs.mkdirSync(path.join(cwd, 'skills', 'learned', 'approved'), { recursive: true })
  fs.renameSync(pendDir, approDir)
  return approDir
}

// ── rejectDraft ───────────────────────────────────────────────
// Deletes a pending skill and records it in .rejected.json.

export function rejectDraft(id: string): void {
  const cwd     = process.cwd()
  const pendDir = path.join(cwd, 'skills', 'learned', 'pending', id)
  if (!fs.existsSync(pendDir)) throw new Error(`Pending skill "${id}" not found`)

  // Read meta for logging
  let meta: Record<string, unknown> = { id }
  try {
    meta = JSON.parse(fs.readFileSync(path.join(pendDir, 'meta.json'), 'utf-8'))
  } catch {}

  // Remove directory
  fs.rmSync(pendDir, { recursive: true, force: true })

  // Append to .rejected.json
  const rejLog = path.join(cwd, 'skills', 'learned', '.rejected.json')
  let log: unknown[] = []
  try { log = JSON.parse(fs.readFileSync(rejLog, 'utf-8')) } catch {}
  log.push({ ...meta, rejectedAt: new Date().toISOString() })
  fs.writeFileSync(rejLog, JSON.stringify(log, null, 2) + '\n', 'utf-8')
}

// ── setSkillEnabled ───────────────────────────────────────────
// Flips the enabled: flag in a skill's SKILL.md and returns the new state.

export function setSkillEnabled(filePath: string, enabled: boolean): void {
  if (!fs.existsSync(filePath)) throw new Error(`Skill file not found: ${filePath}`)
  let content = fs.readFileSync(filePath, 'utf-8')
  if (/^enabled:/m.test(content)) {
    content = content.replace(/^enabled:\s*(true|false)/m, `enabled: ${enabled}`)
  } else {
    // Insert after version line or before closing ---
    content = content.replace(/^(version:.+)$/m, `$1\nenabled: ${enabled}`)
  }
  fs.writeFileSync(filePath, content, 'utf-8')
}

// ── writeSkillFromTask ────────────────────────────────────────
// GEPA-lite: after any successful multi-tool exchange, distil what
// happened into a reusable skill folder in workspace/skills/learned/.
//
// Rules:
//  • Skip if toolsUsed < 2 or success is false
//  • Skip if a skill with >80% token-overlap already exists
//  • Writes directly to learned/ (not pending/) — low friction
//  • Never throws; all errors are swallowed and logged

export interface TaskSkillArgs {
  userMessage: string
  aiReply:     string
  toolsUsed:   string[]
  sessionId?:  string
  success:     boolean
}

export interface TaskSkillResult {
  skillName: string
  path:      string
}

// Simple Dice-coefficient token similarity (BM25-lite, good enough for dedup)
function tokenSimilarity(a: string, b: string): number {
  const tok = (s: string) => new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean),
  )
  const sa = tok(a)
  const sb = tok(b)
  let intersect = 0
  sa.forEach(t => { if (sb.has(t)) intersect++ })
  return (2 * intersect) / (sa.size + sb.size + 0.001)
}

const STOP_WORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could',
  'should','may','might','can','to','for','of','in','on','at',
  'by','with','and','or','but','not','this','that','it','i',
  'you','me','my','your','we','our','they','their','what',
  'how','where','when','why','which','please','just','get',
  'make','let','go','run','show','tell','find','open',
])

function skillNameFromMessage(msg: string): string {
  const words = msg
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 5)
  return (words.join('_') || 'task').slice(0, 48)
}

function toTitleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export async function writeSkillFromTask(args: TaskSkillArgs): Promise<TaskSkillResult | null> {
  const { userMessage, aiReply, toolsUsed, success } = args

  // Gate: skip trivial or failed exchanges
  if (!success || toolsUsed.length < 2) return null

  try {
    const cwd       = process.cwd()
    const learnedDir = path.join(cwd, 'workspace', 'skills', 'learned')
    fs.mkdirSync(learnedDir, { recursive: true })

    const skillName = skillNameFromMessage(userMessage)

    // Dedup: skip if a very similar skill already exists (Dice > 0.80)
    if (fs.existsSync(learnedDir)) {
      for (const entry of fs.readdirSync(learnedDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const existingName = entry.name.replace(/_/g, ' ')
        if (tokenSimilarity(skillName.replace(/_/g, ' '), existingName) > 0.80) {
          // Skill already exists — bump success count instead
          const metaPath = path.join(learnedDir, entry.name, 'meta.json')
          if (fs.existsSync(metaPath)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
              meta.successCount = (meta.successCount || 1) + 1
              meta.lastUsed     = Date.now()
              meta.confidence   = Math.min(0.99, (meta.successCount) / (meta.successCount + (meta.failCount || 0) + 1))
              fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8')
            } catch {}
          }
          return null
        }
      }
    }

    const skillDir  = path.join(learnedDir, skillName)

    // If exact dir exists, just bump meta
    if (fs.existsSync(skillDir)) {
      const metaPath = path.join(skillDir, 'meta.json')
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          meta.successCount = (meta.successCount || 1) + 1
          meta.lastUsed     = Date.now()
          meta.confidence   = Math.min(0.99, (meta.successCount) / (meta.successCount + (meta.failCount || 0) + 1))
          fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8')
        } catch {}
      }
      return null
    }

    fs.mkdirSync(skillDir, { recursive: true })

    const title       = toTitleCase(skillName)
    const descSnippet = userMessage.slice(0, 100).replace(/\n/g, ' ')
    const toolList    = toolsUsed.join(', ')
    const exampleQ    = userMessage.slice(0, 200).replace(/\n/g, ' ')
    const exampleA    = aiReply.slice(0, 200).replace(/\n/g, ' ')

    // Build numbered steps from tool sequence
    const stepsBlock = toolsUsed
      .map((t, i) => `${i + 1}. [${t}] — execute ${t} step`)
      .join('\n')

    const skillMd = [
      '---',
      `name: ${skillName}`,
      `description: ${descSnippet}`,
      `version: 1.0.0`,
      `origin: local`,
      `confidence: medium`,
      `trigger_phrase: "${userMessage.slice(0, 80).replace(/"/g, "'")}"`,
      `tools_used: [${toolList}]`,
      '---',
      '',
      `# ${title}`,
      '',
      '## When to use this skill',
      `Use this when the user asks to ${descSnippet.toLowerCase().slice(0, 80)}.`,
      '',
      '## Steps',
      stepsBlock,
      '',
      '## Example',
      `User: "${exampleQ}"`,
      `Result: "${exampleA}"`,
      '',
    ].join('\n')

    const metaJson = {
      name:         skillName,
      taskPattern:  userMessage.slice(0, 200),
      toolSequence: toolsUsed,
      successCount: 1,
      failCount:    0,
      confidence:   0.5,
      promoted:     false,
      createdAt:    Date.now(),
      lastUsed:     Date.now(),
      avgDuration:  0,
    }

    fs.writeFileSync(path.join(skillDir, 'SKILL.md'),  skillMd,                              'utf-8')
    fs.writeFileSync(path.join(skillDir, 'meta.json'), JSON.stringify(metaJson, null, 2) + '\n', 'utf-8')

    console.log(`[SkillWriter] Wrote skill "${skillName}" → ${skillDir}`)
    return { skillName, path: skillDir }

  } catch (err: any) {
    console.warn('[SkillWriter] writeSkillFromTask failed (non-fatal):', err?.message)
    return null
  }
}

// ── listPending ───────────────────────────────────────────────
// Returns all pending skill IDs with their metadata.

export function listPending(): Array<{ id: string; name: string; description: string; source: string; createdAt: string }> {
  const cwd     = process.cwd()
  const pendDir = path.join(cwd, 'skills', 'learned', 'pending')
  if (!fs.existsSync(pendDir)) return []
  return fs.readdirSync(pendDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(pendDir, e.name, 'meta.json'), 'utf-8'))
        return { id: e.name, name: meta.name || e.name, description: meta.description || '', source: meta.source || '', createdAt: meta.createdAt || '' }
      } catch {
        return { id: e.name, name: e.name, description: '', source: 'unknown', createdAt: '' }
      }
    })
}
