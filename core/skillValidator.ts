// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/skillValidator.ts — agentskills.io spec compliance validator.
//
// Validates a skill directory (or all loaded skills) against the
// Open Agent Skills specification at https://agentskills.io
//
// Spec summary:
//   - SKILL.md with YAML frontmatter
//   - Required: name (^[a-z0-9]+(-[a-z0-9]+)*$), description
//   - Recommended: license (SPDX), version (semver)
//   - Optional subdirs: scripts/, references/, assets/
//   - Script extensions: .py .sh .js .ts .mjs only
//   - allowed-tools: list of tool names skill may invoke

import fs   from 'fs'
import path from 'path'
import { skillLoader, Skill } from './skillLoader'

// ── Types ──────────────────────────────────────────────────────

export interface ValidationError {
  code:    string
  message: string
  field?:  string
}

export interface ValidationWarning {
  code:    string
  message: string
  field?:  string
}

export interface ValidationResult {
  skillId:   string
  skillPath: string
  valid:     boolean
  errors:    ValidationError[]
  warnings:  ValidationWarning[]
  specScore: number   // 0–100 rough compliance score
}

// ── Constants ─────────────────────────────────────────────────

const NAME_REGEX   = /^[a-z0-9]+(-[a-z0-9]+)*$/
const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[\w.]+)?$/
const SPDX_COMMON  = new Set([
  'Apache-2.0', 'MIT', 'GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0',
  'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0', 'AGPL-3.0', 'CC0-1.0',
  'CC-BY-4.0', 'CC-BY-SA-4.0', 'Unlicense', 'WTFPL', 'Proprietary',
])
const ALLOWED_SCRIPT_EXTS = new Set(['.py', '.sh', '.js', '.ts', '.mjs'])

// ── Core validator ─────────────────────────────────────────────

export function validateSkillDir(skillDir: string): ValidationResult {
  const skillId   = path.basename(skillDir)
  const skillPath = path.join(skillDir, 'SKILL.md')

  const errors:   ValidationError[]   = []
  const warnings: ValidationWarning[] = []

  // ── E1: SKILL.md must exist ────────────────────────────────
  if (!fs.existsSync(skillPath)) {
    errors.push({ code: 'E_NO_SKILL_MD', message: 'SKILL.md not found in skill directory' })
    return { skillId, skillPath, valid: false, errors, warnings, specScore: 0 }
  }

  const raw = (() => {
    try { return fs.readFileSync(skillPath, 'utf-8') } catch { return '' }
  })()

  if (!raw.trim()) {
    errors.push({ code: 'E_EMPTY', message: 'SKILL.md is empty' })
    return { skillId, skillPath, valid: false, errors, warnings, specScore: 0 }
  }

  // ── E2: Must have YAML frontmatter ─────────────────────────
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
  if (!fmMatch) {
    errors.push({ code: 'E_NO_FRONTMATTER', message: 'SKILL.md must begin with --- YAML frontmatter ---' })
  }

  const frontmatter = fmMatch ? fmMatch[1] : ''
  const content     = fmMatch ? raw.slice(fmMatch[0].length).trim() : raw.trim()

  const get = (key: string): string => {
    const m = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
    return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : ''
  }

  // ── E3: name — required, must match spec regex ─────────────
  const name = get('name')
  if (!name) {
    errors.push({ code: 'E_NAME_MISSING', message: 'frontmatter "name:" is required', field: 'name' })
  } else if (!NAME_REGEX.test(name)) {
    errors.push({
      code:    'E_NAME_FORMAT',
      message: `name "${name}" must match ^[a-z0-9]+(-[a-z0-9]+)*$ (lowercase, hyphens only, no underscores)`,
      field:   'name',
    })
  } else if (name !== skillId && !skillId.startsWith('generated') && !skillId.startsWith('learned')) {
    warnings.push({
      code:    'W_NAME_MISMATCH',
      message: `name "${name}" does not match directory "${skillId}"`,
      field:   'name',
    })
  }

  // ── E4: description — required ─────────────────────────────
  const description = get('description')
  if (!description) {
    errors.push({ code: 'E_DESC_MISSING', message: 'frontmatter "description:" is required', field: 'description' })
  } else {
    if (description.length < 10) {
      warnings.push({ code: 'W_DESC_SHORT', message: `description too short (${description.length} chars, recommend ≥20)`, field: 'description' })
    }
    if (description.length > 300) {
      warnings.push({ code: 'W_DESC_LONG', message: `description very long (${description.length} chars, recommend ≤200)`, field: 'description' })
    }
  }

  // ── W1: version — recommended, should be semver ────────────
  const version = get('version')
  if (!version) {
    warnings.push({ code: 'W_VERSION_MISSING', message: 'frontmatter "version:" is recommended (e.g. "1.0.0")', field: 'version' })
  } else if (!SEMVER_REGEX.test(version)) {
    warnings.push({ code: 'W_VERSION_FORMAT', message: `version "${version}" does not look like semver (x.y.z)`, field: 'version' })
  }

  // ── W2: license — recommended ──────────────────────────────
  const license = get('license')
  if (!license) {
    warnings.push({ code: 'W_LICENSE_MISSING', message: 'frontmatter "license:" is recommended (e.g. "Apache-2.0")', field: 'license' })
  } else if (!SPDX_COMMON.has(license)) {
    warnings.push({ code: 'W_LICENSE_UNKNOWN', message: `license "${license}" is not a common SPDX identifier`, field: 'license' })
  }

  // ── E5: Body content must exist ────────────────────────────
  if (!content) {
    errors.push({ code: 'E_NO_BODY', message: 'SKILL.md has frontmatter but no body content' })
  }

  // ── W3: Body should have at least one markdown heading ─────
  if (content && !content.includes('#')) {
    warnings.push({ code: 'W_NO_HEADINGS', message: 'body content has no markdown headings — consider adding structure' })
  }

  // ── Scripts subdir checks ───────────────────────────────────
  const scriptsDir = path.join(skillDir, 'scripts')
  if (fs.existsSync(scriptsDir)) {
    try {
      const scriptFiles = fs.readdirSync(scriptsDir)
      for (const f of scriptFiles) {
        const ext = path.extname(f).toLowerCase()
        if (!ALLOWED_SCRIPT_EXTS.has(ext) && ext !== '') {
          errors.push({
            code:    'E_SCRIPT_EXT',
            message: `scripts/${f}: extension "${ext}" not allowed (permitted: .py .sh .js .ts .mjs)`,
            field:   'scripts',
          })
        }
      }
    } catch {}
  }

  // ── allowed-tools: validate list format ────────────────────
  const allowedToolsRaw = get('allowed-tools')
  if (allowedToolsRaw) {
    const tools = allowedToolsRaw.split(',').map(t => t.trim()).filter(Boolean)
    if (tools.length === 0) {
      warnings.push({ code: 'W_ALLOWED_TOOLS_EMPTY', message: 'allowed-tools is set but empty', field: 'allowed-tools' })
    }
  }

  // ── Score calculation ───────────────────────────────────────
  // Start at 100, subtract per issue
  let score = 100
  score -= errors.length   * 15   // each error: -15
  score -= warnings.length * 5    // each warning: -5
  score  = Math.max(0, Math.min(100, score))

  const valid = errors.length === 0

  return { skillId, skillPath, valid, errors, warnings, specScore: score }
}

// ── Validate a single loaded skill by name ─────────────────────

export function validateSkillByName(name: string): ValidationResult | null {
  const skills = skillLoader.loadAllRaw()
  const skill  = skills.find(s => s.name === name)
  if (!skill) return null
  return validateSkillDir(path.dirname(skill.filePath))
}

// ── Validate all skills in a skills directory ──────────────────

export function validateAllSkills(skillsDir?: string): ValidationResult[] {
  const dir = skillsDir ?? path.join(process.cwd(), 'skills')
  if (!fs.existsSync(dir)) return []
  const results: ValidationResult[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillMdPath = path.join(dir, entry.name, 'SKILL.md')
      if (!fs.existsSync(skillMdPath)) continue
      results.push(validateSkillDir(path.join(dir, entry.name)))
    }
  } catch {}
  return results
}

// ── Summarise a list of results ────────────────────────────────

export interface ValidationSummary {
  total:        number
  valid:        number
  invalid:      number
  avgScore:     number
  errorCounts:  Record<string, number>
  warnCounts:   Record<string, number>
}

export function summariseResults(results: ValidationResult[]): ValidationSummary {
  const errorCounts:  Record<string, number> = {}
  const warnCounts:   Record<string, number> = {}
  let totalScore = 0

  for (const r of results) {
    totalScore += r.specScore
    for (const e of r.errors)   errorCounts[e.code] = (errorCounts[e.code] ?? 0) + 1
    for (const w of r.warnings) warnCounts[w.code]  = (warnCounts[w.code]  ?? 0) + 1
  }

  return {
    total:       results.length,
    valid:       results.filter(r => r.valid).length,
    invalid:     results.filter(r => !r.valid).length,
    avgScore:    results.length ? Math.round(totalScore / results.length) : 0,
    errorCounts,
    warnCounts,
  }
}
