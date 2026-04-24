// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/skillImporter.ts — agentskills.io-compatible skill importer.
//
// Supports importing skills from:
//   - GitHub repos:  importFromGitHub('owner/repo', [subpath])
//   - HTTPS URLs:    importFromUrl('https://...')
//   - Local paths:   importFromLocal('/path/to/skill-dir')
//
// Security gates (enforced unconditionally):
//   1. HTTPS only for remote imports (http:// blocked)
//   2. SKILL.md ≤ 100 KB
//   3. Total skill dir ≤ 10 MB
//   4. Scripts must live in scripts/ subdir
//   5. Script extensions: .py .sh .js .ts .mjs only
//   6. enabled: false always set on freshly imported skills
//   7. No existing skill overwrite without { force: true }

import fs   from 'fs'
import path from 'path'
import { skillLoader } from './skillLoader'
import { validateSkillDir } from './skillValidator'

// ── Types ──────────────────────────────────────────────────────

export interface ImportOptions {
  /** Destination dir — defaults to skills/installed/<name> */
  destDir?:   string
  /** Allow overwriting an existing skill */
  force?:     boolean
  /** Source hint stored in frontmatter */
  source?:    string
}

export interface ImportResult {
  success:      boolean
  skillId?:     string
  destPath?:    string
  validation?:  import('./skillValidator').ValidationResult
  error?:       string
}

// ── Constants ──────────────────────────────────────────────────

const MAX_SKILL_MD_BYTES = 100 * 1024       // 100 KB
const MAX_TOTAL_BYTES    = 10 * 1024 * 1024 // 10 MB
const ALLOWED_EXTS       = new Set(['.py', '.sh', '.js', '.ts', '.mjs'])
const GITHUB_API_BASE    = 'https://api.github.com'

// ── Security helpers ───────────────────────────────────────────

function assertHttps(url: string): void {
  if (!url.startsWith('https://')) {
    throw new Error(`Security: only HTTPS imports are allowed (got: ${url.slice(0, 40)})`)
  }
}

function assertSize(buf: Buffer | string, max: number, label: string): void {
  const size = Buffer.isBuffer(buf) ? buf.length : Buffer.byteLength(buf, 'utf-8')
  if (size > max) {
    throw new Error(`Security: ${label} exceeds limit (${size} bytes > ${max} bytes)`)
  }
}

function assertScriptExt(filename: string): void {
  const ext = path.extname(filename).toLowerCase()
  if (ext && !ALLOWED_EXTS.has(ext)) {
    throw new Error(`Security: script extension "${ext}" not allowed (permitted: .py .sh .js .ts .mjs)`)
  }
}

// ── Fetch helper (Node 18 built-in fetch) ──────────────────────

async function fetchText(url: string, headers?: Record<string, string>): Promise<string> {
  assertHttps(url)
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Aiden/3.8.1 (agentskills-importer)', ...headers },
    signal:  AbortSignal.timeout(15_000),
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`)
  const text = await resp.text()
  assertSize(text, MAX_SKILL_MD_BYTES, `response from ${url}`)
  return text
}

// ── Determine install destination ─────────────────────────────

function resolveDestDir(skillId: string, opts: ImportOptions): string {
  if (opts.destDir) return opts.destDir
  return path.join(process.cwd(), 'skills', 'installed', skillId)
}

// ── Inject/update import metadata in SKILL.md frontmatter ─────

function injectImportMeta(raw: string, source: string, importedFrom: string): string {
  // Always set enabled: false, source, imported-from in the frontmatter
  const fmMatch = raw.match(/^(---\s*\n)([\s\S]*?)(\n---\s*\n)/)
  if (!fmMatch) {
    // No frontmatter — prepend one
    return `---\nenabled: false\nsource: ${source}\nimported-from: ${importedFrom}\n---\n\n${raw}`
  }
  let fm = fmMatch[2]

  // Remove any existing enabled / source / imported-from lines
  fm = fm.replace(/^enabled:.*$/m, '').replace(/^source:.*$/m, '').replace(/^imported-from:.*$/m, '')

  // Add controlled fields
  fm = fm.trimEnd()
  fm += `\nenabled: false\nsource: ${source}\nimported-from: ${importedFrom}`

  return `${fmMatch[1]}${fm}${fmMatch[3]}${raw.slice(fmMatch[0].length)}`
}

// ── Extract skill name from SKILL.md frontmatter ──────────────

function extractSkillName(raw: string, fallback: string): string {
  const m = raw.match(/^name:\s*(.+)$/m)
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : fallback
}

// ── Write skill directory ──────────────────────────────────────

function writeSkillFiles(
  destDir:     string,
  skillMdContent: string,
  extraFiles:  Array<{ relPath: string; content: Buffer | string }> = [],
): void {
  // Check total size
  let totalSize = Buffer.byteLength(skillMdContent, 'utf-8')
  for (const f of extraFiles) {
    totalSize += Buffer.isBuffer(f.content) ? f.content.length : Buffer.byteLength(f.content, 'utf-8')
  }
  assertSize(Buffer.alloc(totalSize), MAX_TOTAL_BYTES, 'total skill package')

  // Validate script extensions in extra files
  for (const f of extraFiles) {
    const parts  = f.relPath.split('/')
    const inSub  = parts.length > 1
    const subdir = parts[0]
    if (!inSub) continue
    if (subdir === 'scripts') assertScriptExt(parts[parts.length - 1])
    // Files in non-standard subdirs are fine (references/, assets/, etc.)
  }

  fs.mkdirSync(destDir, { recursive: true })
  fs.writeFileSync(path.join(destDir, 'SKILL.md'), skillMdContent, 'utf-8')

  for (const f of extraFiles) {
    const fullPath = path.join(destDir, f.relPath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    if (Buffer.isBuffer(f.content)) {
      fs.writeFileSync(fullPath, f.content)
    } else {
      fs.writeFileSync(fullPath, f.content, 'utf-8')
    }
  }
}

// ── Import from HTTPS URL (single SKILL.md file) ──────────────

export async function importFromUrl(
  url: string,
  opts: ImportOptions = {},
): Promise<ImportResult> {
  try {
    assertHttps(url)
    const raw        = await fetchText(url)
    const fallbackId = url.split('/').pop()?.replace(/[^a-z0-9-]/gi, '-').toLowerCase() ?? 'imported'
    const skillId    = extractSkillName(raw, fallbackId)
    const destDir    = resolveDestDir(skillId, opts)

    if (!opts.force && fs.existsSync(destDir)) {
      return { success: false, error: `Skill "${skillId}" already exists. Use force:true to overwrite.` }
    }

    const patched = injectImportMeta(raw, opts.source ?? url, url)
    writeSkillFiles(destDir, patched)
    skillLoader.refresh()

    const validation = validateSkillDir(destDir)
    return { success: true, skillId, destPath: destDir, validation }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ── Import from GitHub repo ────────────────────────────────────
// Fetches SKILL.md (and optionally scripts/, references/, assets/) via GitHub API.

export async function importFromGitHub(
  ownerRepo:   string,   // "owner/repo"
  opts:        ImportOptions & { subpath?: string; branch?: string } = {},
): Promise<ImportResult> {
  try {
    const [owner, repo] = ownerRepo.split('/')
    if (!owner || !repo) throw new Error(`Invalid owner/repo format: "${ownerRepo}"`)

    const branch  = opts.branch  ?? 'main'
    const subpath = opts.subpath ?? ''

    // Try raw.githubusercontent.com first (no rate limit header required)
    const basePath    = subpath ? `${subpath}/` : ''
    const rawBase     = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${basePath}`
    const skillMdUrl  = `${rawBase}SKILL.md`

    assertHttps(skillMdUrl)
    let raw: string
    try {
      raw = await fetchText(skillMdUrl)
    } catch {
      // Try GitHub API as fallback (needed for non-default branch / private repos with token)
      const apiUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${basePath}SKILL.md?ref=${branch}`
      const apiRaw = await fetchText(apiUrl)
      const parsed = JSON.parse(apiRaw) as { content?: string; encoding?: string }
      if (parsed.encoding === 'base64' && parsed.content) {
        raw = Buffer.from(parsed.content.replace(/\n/g, ''), 'base64').toString('utf-8')
      } else {
        throw new Error('Could not decode SKILL.md from GitHub API response')
      }
    }

    const fallbackId = repo.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const skillId    = extractSkillName(raw, fallbackId)
    const destDir    = resolveDestDir(skillId, opts)

    if (!opts.force && fs.existsSync(destDir)) {
      return { success: false, error: `Skill "${skillId}" already exists. Use force:true to overwrite.` }
    }

    // Also try to fetch scripts/  (best-effort — non-fatal if absent)
    const extraFiles: Array<{ relPath: string; content: Buffer | string }> = []
    const EXTRA_SUBDIRS = ['scripts', 'references', 'assets']

    for (const subDir of EXTRA_SUBDIRS) {
      const treeUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
      try {
        const treeRaw  = await fetchText(treeUrl)
        const tree     = JSON.parse(treeRaw) as { tree: Array<{ path: string; type: string; size?: number }> }
        const prefix   = basePath + subDir + '/'
        const entries  = tree.tree.filter(e => e.type === 'blob' && e.path.startsWith(prefix))

        for (const entry of entries) {
          const relPath = entry.path.replace(basePath, '')   // e.g. "scripts/main.py"
          const fileUrl = `${rawBase}${relPath}`

          // Security: enforce extension for scripts/
          if (relPath.startsWith('scripts/')) assertScriptExt(path.basename(relPath))

          // Security: per-file size check (from tree metadata)
          if ((entry.size ?? 0) > MAX_SKILL_MD_BYTES) continue  // skip huge files silently

          try {
            const fileContent = await fetchText(fileUrl)
            extraFiles.push({ relPath, content: fileContent })
          } catch {
            // Non-fatal — skip this file
          }
        }
        break  // Only need one tree fetch
      } catch {
        // Tree API unavailable or repo private — skip extra files
        break
      }
    }

    const sourceRef = `github:${ownerRepo}`
    const patched   = injectImportMeta(raw, opts.source ?? sourceRef, sourceRef)
    writeSkillFiles(destDir, patched, extraFiles)
    skillLoader.refresh()

    const validation = validateSkillDir(destDir)
    return { success: true, skillId, destPath: destDir, validation }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ── Import from local directory ────────────────────────────────

export async function importFromLocal(
  srcDir:  string,
  opts:    ImportOptions = {},
): Promise<ImportResult> {
  try {
    if (!fs.existsSync(srcDir)) {
      return { success: false, error: `Source directory not found: ${srcDir}` }
    }

    const skillMdPath = path.join(srcDir, 'SKILL.md')
    if (!fs.existsSync(skillMdPath)) {
      return { success: false, error: `No SKILL.md found in ${srcDir}` }
    }

    const raw     = fs.readFileSync(skillMdPath, 'utf-8')
    assertSize(raw, MAX_SKILL_MD_BYTES, 'SKILL.md')

    const skillId = extractSkillName(raw, path.basename(srcDir))
    const destDir = resolveDestDir(skillId, opts)

    if (!opts.force && fs.existsSync(destDir)) {
      return { success: false, error: `Skill "${skillId}" already exists. Use force:true to overwrite.` }
    }

    // Collect extra files (scripts/, references/, assets/)
    const extraFiles: Array<{ relPath: string; content: Buffer | string }> = []
    let totalSize = Buffer.byteLength(raw, 'utf-8')

    for (const subdir of ['scripts', 'references', 'assets']) {
      const subdirPath = path.join(srcDir, subdir)
      if (!fs.existsSync(subdirPath)) continue
      const files = fs.readdirSync(subdirPath)
      for (const f of files) {
        if (subdir === 'scripts') assertScriptExt(f)
        const fullPath = path.join(subdirPath, f)
        const stat     = fs.statSync(fullPath)
        if (!stat.isFile()) continue
        totalSize += stat.size
        assertSize(Buffer.alloc(totalSize), MAX_TOTAL_BYTES, 'total skill package')
        const content = fs.readFileSync(fullPath)
        extraFiles.push({ relPath: `${subdir}/${f}`, content })
      }
    }

    const patched = injectImportMeta(raw, opts.source ?? 'local', srcDir)
    writeSkillFiles(destDir, patched, extraFiles)
    skillLoader.refresh()

    const validation = validateSkillDir(destDir)
    return { success: true, skillId, destPath: destDir, validation }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ── Smart import — detects type from source string ─────────────

export async function importSkill(source: string, opts: ImportOptions = {}): Promise<ImportResult> {
  source = source.trim()

  // Strip explicit github: prefix (e.g. "github:owner/repo")
  if (source.startsWith('github:')) {
    source = source.slice(7)
  }

  // GitHub shorthand: "owner/repo" or "owner/repo/subpath"
  if (/^[a-z0-9_.-]+\/[a-z0-9_.-]+(\/.*)?$/i.test(source) && !source.startsWith('http')) {
    const parts    = source.split('/')
    const ownerRepo = `${parts[0]}/${parts[1]}`
    const subpath   = parts.slice(2).join('/')
    return importFromGitHub(ownerRepo, { ...opts, subpath: subpath || undefined })
  }

  // HTTPS URL
  if (source.startsWith('https://')) {
    return importFromUrl(source, opts)
  }

  // http:// — blocked
  if (source.startsWith('http://')) {
    return { success: false, error: 'Security: only HTTPS imports are allowed (http:// blocked)' }
  }

  // Local path
  return importFromLocal(source, opts)
}
