// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// skills/skillIndex.ts — Scans the skills/ directory, tracks tier + success
//                         metrics, and persists to skills/skill-index.json.

import fs   from "fs"
import path from "path"

const SKILLS_ROOT  = path.join(process.cwd(), "skills")
const INDEX_FILE   = path.join(SKILLS_ROOT, "skill-index.json")

// Order tiers so "core" floats to the top
const TIER_PRIORITY: Record<string, number> = { core: 0, domain: 1, generated: 2 }

// Directories / file names that are definitely not skills
const EXCLUDED_NAMES = new Set([
  "skill-index.json", "skillIndex.ts", "skillIndex.js",
  "skillMemory.ts", "skillMemory.js",
  "loader.ts", "loader.js",
  "registry.ts", "registry.js",
  "index.ts", "index.js",
  "node_modules",
])

export interface SkillEntry {
  name:        string
  path:        string
  tier:        "core" | "domain" | "generated"
  description: string
  usageCount:  number
  successRate: number  // 0.0 – 1.0
}

export class SkillIndex {

  private index: Map<string, SkillEntry> = new Map()

  constructor() {
    this._loadFromDisk()
    this._scan()
    this._persist()
  }

  /** Returns all entries sorted by tier then successRate desc. */
  getAll(): SkillEntry[] {
    return this._sorted(Array.from(this.index.values()))
  }

  /**
   * Returns the best entries for the planner — up to `limit` (default 20),
   * sorted by tier priority then descending successRate.
   */
  getForPlanner(limit: number = 20): SkillEntry[] {
    return this._sorted(Array.from(this.index.values())).slice(0, limit)
  }

  /**
   * Register a new skill or update an existing one.
   * Persists immediately.
   */
  register(name: string, skillPath: string, tier: string): void {
    const existing = this.index.get(name)
    const entry: SkillEntry = {
      name,
      path:        skillPath,
      tier:        this._normaliseTier(tier),
      description: existing?.description ?? "",
      usageCount:  existing?.usageCount  ?? 0,
      successRate: existing?.successRate ?? 1.0,
    }
    this.index.set(name, entry)
    this._persist()
  }

  /** Update usage stats for a skill after it runs. */
  recordRun(name: string, success: boolean): void {
    const entry = this.index.get(name)
    if (!entry) return

    const newUsage   = entry.usageCount + 1
    const prevTotal  = Math.max(entry.usageCount, 1)
    const prevSuccess = Math.round(entry.successRate * prevTotal)
    const newSuccess  = prevSuccess + (success ? 1 : 0)

    entry.usageCount  = newUsage
    entry.successRate = newSuccess / newUsage
    this._persist()
  }

  // ── Private ───────────────────────────────────────────────

  private _scan(): void {
    if (!fs.existsSync(SKILLS_ROOT)) return

    const entries = fs.readdirSync(SKILLS_ROOT)
    for (const entry of entries) {
      if (EXCLUDED_NAMES.has(entry)) continue

      const full = path.join(SKILLS_ROOT, entry)
      let stat: fs.Stats
      try { stat = fs.statSync(full) } catch { continue }

      if (stat.isDirectory()) {
        // Each subdirectory is a skill category; scan its children
        this._scanSubdir(full, entry)
      } else if ((entry.endsWith(".ts") || entry.endsWith(".js")) && !entry.endsWith(".d.ts")) {
        const name = entry.replace(/\.(ts|js)$/, "")
        if (EXCLUDED_NAMES.has(name)) continue
        this._upsert(name, full, this._inferTier(full))
      }
    }
  }

  private _scanSubdir(dir: string, category: string): void {
    let children: string[]
    try { children = fs.readdirSync(dir) } catch { return }

    const tier = this._inferTier(dir)

    for (const child of children) {
      if (EXCLUDED_NAMES.has(child)) continue
      const full = path.join(dir, child)

      try {
        const stat = fs.statSync(full)
        if (stat.isDirectory()) {
          // nested sub-skill (e.g. skills/coding/react/)
          const name = `${category}/${child}`
          this._upsert(name, full, tier)
        } else if ((child.endsWith(".ts") || child.endsWith(".js")) && !child.endsWith(".d.ts")) {
          const name = `${category}/${child.replace(/\.(ts|js)$/, "")}`
          this._upsert(name, full, tier)
        }
      } catch {
        // skip
      }
    }
  }

  private _upsert(name: string, skillPath: string, tier: "core" | "domain" | "generated"): void {
    if (this.index.has(name)) {
      // Keep existing metrics, just refresh path + tier
      const e = this.index.get(name)!
      e.path = skillPath
      e.tier = tier
    } else {
      this.index.set(name, {
        name,
        path:        skillPath,
        tier,
        description: "",
        usageCount:  0,
        successRate: 1.0,
      })
    }
  }

  private _inferTier(skillPath: string): "core" | "domain" | "generated" {
    const lower = skillPath.toLowerCase()
    if (lower.includes(`${path.sep}generated`)) return "generated"
    if (lower.includes(`${path.sep}coding`)    ||
        lower.includes(`${path.sep}planning`)  ||
        lower.includes(`${path.sep}browser`)   ||
        lower.includes(`${path.sep}docs`)      ||
        lower.includes(`${path.sep}debug`)     ||
        lower.includes(`${path.sep}devops`)    ||
        lower.includes(`${path.sep}system`)    ||
        lower.includes(`${path.sep}utils`)     ||
        lower.includes(`${path.sep}performance`) ||
        lower.includes(`${path.sep}security`)  ||
        lower.includes(`${path.sep}architecture`)) return "domain"
    return "core"
  }

  private _normaliseTier(tier: string): "core" | "domain" | "generated" {
    if (tier === "core" || tier === "domain" || tier === "generated") return tier
    return "domain"
  }

  private _sorted(entries: SkillEntry[]): SkillEntry[] {
    return entries.sort((a, b) => {
      const tierDiff = (TIER_PRIORITY[a.tier] ?? 9) - (TIER_PRIORITY[b.tier] ?? 9)
      if (tierDiff !== 0) return tierDiff
      return b.successRate - a.successRate
    })
  }

  private _loadFromDisk(): void {
    try {
      if (!fs.existsSync(INDEX_FILE)) return
      const raw  = fs.readFileSync(INDEX_FILE, "utf-8")
      const data = JSON.parse(raw) as SkillEntry[]
      for (const e of data) {
        this.index.set(e.name, e)
      }
    } catch {
      // corrupt index — start fresh, scan will rebuild
    }
  }

  private _persist(): void {
    try {
      fs.mkdirSync(path.dirname(INDEX_FILE), { recursive: true })
      fs.writeFileSync(INDEX_FILE, JSON.stringify(Array.from(this.index.values()), null, 2), "utf-8")
    } catch (err: any) {
      console.warn(`[SkillIndex] Could not persist index: ${err.message}`)
    }
  }
}

export const skillIndex = new SkillIndex()
