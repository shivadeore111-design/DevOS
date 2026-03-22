// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// intelligence/impactMap.ts — Pre-edit blast radius (static import) analysis

import * as fs   from 'fs'
import * as path from 'path'

// ── Types ──────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high'

export interface ImpactReport {
  targetFile:         string
  directDependents:   string[]
  indirectDependents: string[]
  exportedSymbols:    string[]
  riskLevel:          RiskLevel
  warning:            string
}

interface CacheEntry {
  mtime:  number
  report: ImpactReport
}

// ── Constants ──────────────────────────────────────────────────

const CACHE_FILE = path.join(process.cwd(), 'workspace', '.impact-cache.json')

/** Source root directories to walk when building the import graph. */
const SOURCE_ROOTS = [
  'core', 'agents', 'coordination', 'goals', 'llm',
  'executor', 'intelligence', 'skills',
]

/** File extensions treated as source files. */
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])

/** Directories always skipped during walk. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'templates', 'ui', 'dashboard-next'])

// Risk thresholds
const HIGH_THRESHOLD   = 6
const MEDIUM_THRESHOLD = 3

// ── Class ──────────────────────────────────────────────────────

class ImpactMap {

  private cache: Map<string, CacheEntry> = new Map()

  constructor() {
    this.loadCache()
  }

  // ── Cache ────────────────────────────────────────────────

  private loadCache(): void {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) as Record<string, CacheEntry>
        for (const [k, v] of Object.entries(raw)) this.cache.set(k, v)
      }
    } catch { /* start fresh */ }
  }

  private saveCache(): void {
    try {
      fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
      const obj: Record<string, CacheEntry> = {}
      for (const [k, v] of this.cache) obj[k] = v
      fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2))
    } catch { /* non-fatal */ }
  }

  private getMtime(filePath: string): number {
    try { return fs.statSync(filePath).mtimeMs } catch { return 0 }
  }

  // ── File collection ───────────────────────────────────────

  private collectSources(): string[] {
    const root  = process.cwd()
    const files: string[] = []

    const walk = (dir: string): void => {
      if (!fs.existsSync(dir)) return
      let entries: fs.Dirent[]
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }

      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (SOURCE_EXTS.has(path.extname(entry.name).toLowerCase())) {
          files.push(full)
        }
      }
    }

    for (const src of SOURCE_ROOTS) walk(path.join(root, src))

    // Include root index.ts
    const rootIndex = path.join(root, 'index.ts')
    if (fs.existsSync(rootIndex)) files.push(rootIndex)

    return files
  }

  // ── Import parsing ────────────────────────────────────────

  private parseImports(filePath: string): string[] {
    try {
      const content  = fs.readFileSync(filePath, 'utf-8')
      const resolved: string[] = []
      const RE_IMPORT  = /from\s+['"]([^'"]+)['"]/g
      const RE_REQUIRE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g

      for (const re of [RE_IMPORT, RE_REQUIRE]) {
        let m: RegExpExecArray | null
        while ((m = re.exec(content)) !== null) {
          const r = this.resolveImport(filePath, m[1])
          if (r) resolved.push(r)
        }
      }
      return resolved
    } catch {
      return []
    }
  }

  private resolveImport(fromFile: string, importPath: string): string | null {
    // Ignore package imports
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) return null
    const dir  = path.dirname(fromFile)
    const base = path.resolve(dir, importPath)

    for (const suffix of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
      const c = base + suffix
      if (fs.existsSync(c)) return c
    }
    if (fs.existsSync(base)) return base
    return null
  }

  // ── Export parsing ────────────────────────────────────────

  private parseExports(filePath: string): string[] {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const symbols: string[] = []

      // export const/let/function/class/interface/type/enum Name
      const RE_NAMED = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g
      let m: RegExpExecArray | null
      while ((m = RE_NAMED.exec(content)) !== null) symbols.push(m[1])

      // export { Foo, Bar as Baz }
      const RE_BRACE = /export\s+\{([^}]+)\}/g
      while ((m = RE_BRACE.exec(content)) !== null) {
        for (const part of m[1].split(',')) {
          const name = part.trim().split(/\s+as\s+/)[0].trim()
          if (name) symbols.push(name)
        }
      }

      return [...new Set(symbols)]
    } catch {
      return []
    }
  }

  // ── Main analysis ─────────────────────────────────────────

  /**
   * Analyse the blast radius of editing `filePath`.
   *
   * Returns an ImpactReport with:
   *   - directDependents:   files that directly `import` / `require` the target
   *   - indirectDependents: files that import the direct dependents (one more hop)
   *   - riskLevel:          low (0-2), medium (3-5), high (6+) total dependents
   *   - warning:            human-readable string for LLM injection / logging
   *
   * Results are cached by file mtime; stale entries are evicted automatically.
   */
  analyze(filePath: string): ImpactReport {
    const absPath = path.resolve(filePath)
    const mtime   = this.getMtime(absPath)

    // Cache hit
    const cached = this.cache.get(absPath)
    if (cached && cached.mtime === mtime && mtime !== 0) {
      return cached.report
    }

    const allSources = this.collectSources()

    // Build reverse-dependency map: resolvedFile → Set<files that import it>
    const reverseMap = new Map<string, Set<string>>()
    for (const src of allSources) {
      if (src === absPath) continue
      for (const imp of this.parseImports(src)) {
        const set = reverseMap.get(imp) ?? new Set<string>()
        set.add(src)
        reverseMap.set(imp, set)
      }
    }

    // Direct dependents
    const directSet = reverseMap.get(absPath) ?? new Set<string>()
    const direct    = [...directSet]

    // Indirect dependents (one hop beyond direct)
    const indirectSet = new Set<string>()
    for (const d of directSet) {
      for (const s of reverseMap.get(d) ?? new Set<string>()) {
        if (!directSet.has(s) && s !== absPath) indirectSet.add(s)
      }
    }
    const indirect = [...indirectSet]

    const exportedSymbols = this.parseExports(absPath)
    const totalDeps       = direct.length + indirect.length

    const riskLevel: RiskLevel =
      totalDeps >= HIGH_THRESHOLD   ? 'high'   :
      totalDeps >= MEDIUM_THRESHOLD ? 'medium' : 'low'

    const relPath = path.relative(process.cwd(), absPath)

    const warning =
      riskLevel === 'high'
        ? `⚠️  HIGH IMPACT: ${relPath} has ${direct.length} direct + ${indirect.length} indirect dependents. Edits here will ripple widely — verify with tsc --noEmit after every change.`
      : riskLevel === 'medium'
        ? `⚠️  MEDIUM IMPACT: ${relPath} has ${direct.length} direct dependents. Review downstream effects before editing.`
      : `✅ LOW IMPACT: ${relPath} has ${direct.length} direct dependent(s). Safe to edit.`

    const report: ImpactReport = {
      targetFile:         relPath,
      directDependents:   direct.map(d => path.relative(process.cwd(), d)),
      indirectDependents: indirect.map(d => path.relative(process.cwd(), d)),
      exportedSymbols,
      riskLevel,
      warning,
    }

    this.cache.set(absPath, { mtime, report })
    this.saveCache()

    console.log(`[ImpactMap] ${warning}`)
    return report
  }
}

export const impactMap = new ImpactMap()
