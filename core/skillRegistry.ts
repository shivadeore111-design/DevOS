// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/skillRegistry.ts — Client for the public Aiden skill registry.
//
// Registry API: https://skills.taracod.com  (Cloudflare Worker)
// Override:     AIDEN_SKILL_REGISTRY_URL env var
//
// Installed skills are written to workspace/skills/installed/<name>/
// and are automatically picked up by lookup_skill in toolRegistry.ts.

import fs   from 'fs'
import path from 'path'

// ── Config ────────────────────────────────────────────────────

const BASE          = (process.env.AIDEN_SKILL_REGISTRY_URL ?? 'https://skills.taracod.com').replace(/\/$/, '')
const INSTALLED_DIR = path.join(process.cwd(), 'workspace', 'skills', 'installed')

// ── Types ─────────────────────────────────────────────────────

export interface SkillSummary {
  name:        string
  version:     string
  author:      string
  description: string
  tools_used:  string[]
  downloads:   number
  created:     string
}

export interface SkillManifest extends SkillSummary {
  content: string                  // full SKILL.md text
  files:   Record<string, string>  // extra files: filename → content
}

// ── searchRegistry ────────────────────────────────────────────

export async function searchRegistry(query: string): Promise<SkillSummary[]> {
  const res = await fetch(`${BASE}/skills/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`Registry search failed: ${res.status}`)
  return res.json() as Promise<SkillSummary[]>
}

// ── getRegistrySkill ──────────────────────────────────────────

export async function getRegistrySkill(name: string): Promise<SkillManifest> {
  const res = await fetch(`${BASE}/skills/${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`Skill "${name}" not found in registry (${res.status})`)
  return res.json() as Promise<SkillManifest>
}

// ── installSkill ──────────────────────────────────────────────
// Fetches skill from registry, writes to workspace/skills/installed/<name>/

export async function installSkill(name: string): Promise<{ path: string }> {
  const manifest = await getRegistrySkill(name)
  const skillDir = path.join(INSTALLED_DIR, manifest.name)
  fs.mkdirSync(skillDir, { recursive: true })

  // Write SKILL.md
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), manifest.content, 'utf-8')

  // Write meta.json
  const meta = {
    name:        manifest.name,
    version:     manifest.version,
    author:      manifest.author,
    description: manifest.description,
    tools_used:  manifest.tools_used,
    source:      'registry',
    installedAt: new Date().toISOString(),
  }
  fs.writeFileSync(path.join(skillDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf-8')

  // Write any bundled extra files
  for (const [filename, content] of Object.entries(manifest.files ?? {})) {
    const safe = path.basename(filename)  // no path traversal
    fs.writeFileSync(path.join(skillDir, safe), content as string, 'utf-8')
  }

  console.log(`[skillRegistry] installed "${manifest.name}" → ${skillDir}`)
  return { path: skillDir }
}

// ── publishSkill ──────────────────────────────────────────────
// Reads skill from learned/, approved/, or installed/ and uploads to registry.
// Pro feature — requires a valid license key.

export async function publishSkill(
  skillName: string,
  license?: string,
): Promise<{ url: string }> {
  if (!license) {
    throw new Error('License key required to publish skills (Pro feature). Pass via --key or AIDEN_LICENSE env var.')
  }

  const cwd        = process.cwd()
  const candidates = [
    path.join(cwd, 'workspace', 'skills', 'learned',   skillName),
    path.join(cwd, 'workspace', 'skills', 'approved',  skillName),
    path.join(cwd, 'workspace', 'skills', 'installed', skillName),
  ]

  const skillDir = candidates.find(d => fs.existsSync(path.join(d, 'SKILL.md')))
  if (!skillDir) {
    throw new Error(`Skill "${skillName}" not found in learned/, approved/, or installed/`)
  }

  const content = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8')
  let meta: Record<string, any> = {}
  try { meta = JSON.parse(fs.readFileSync(path.join(skillDir, 'meta.json'), 'utf-8')) } catch {}

  const body = {
    name:        skillName,
    version:     meta.version     ?? '1.0.0',
    author:      meta.author      ?? 'anonymous',
    description: meta.description ?? meta.taskPattern ?? skillName,
    tools_used:  meta.tools_used  ?? [],
    content,
    files:       {} as Record<string, string>,
  }

  const res = await fetch(`${BASE}/skills`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-License-Key': license },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err: any = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `Publish failed: ${res.status}`)
  }

  const data: any = await res.json()
  console.log(`[skillRegistry] published "${skillName}" → ${data.url}`)
  return { url: data.url }
}

// ── listInstalled ─────────────────────────────────────────────
// Returns metadata for all skills in workspace/skills/installed/.

export function listInstalled(): SkillSummary[] {
  if (!fs.existsSync(INSTALLED_DIR)) return []
  const out: SkillSummary[] = []
  for (const entry of fs.readdirSync(INSTALLED_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    try {
      const meta = JSON.parse(
        fs.readFileSync(path.join(INSTALLED_DIR, entry.name, 'meta.json'), 'utf-8')
      )
      out.push({
        name:        meta.name        ?? entry.name,
        version:     meta.version     ?? '?',
        author:      meta.author      ?? '?',
        description: meta.description ?? meta.taskPattern ?? '',
        tools_used:  meta.tools_used  ?? [],
        downloads:   meta.downloads   ?? 0,
        created:     meta.installedAt ?? '',
      })
    } catch {}
  }
  return out
}
