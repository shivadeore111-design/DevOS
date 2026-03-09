// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// executor/skillWarmup.ts — Pre-loads top skills into Node module cache so
//                            the first real invocation is near-instant.

import path from "path"
import fs   from "fs"

const SKILLS_DIR      = path.join(process.cwd(), "skills")
const TOP_N_BY_USAGE  = 5

// Expected minimal interface for a loaded skill module
interface SkillModule {
  run?: (...args: any[]) => any
  execute?: (...args: any[]) => any
  [key: string]: any
}

export class SkillWarmup {

  /**
   * Warm up skills by pre-importing their modules.
   * @param skillNames  Explicit list of skill names (directory names under skills/).
   *                    If omitted, auto-selects top 5 by usage from taskPatterns.
   */
  async warmup(skillNames?: string[]): Promise<void> {
    const start  = Date.now()
    const names  = skillNames ?? this._resolveTopSkills()
    let   loaded = 0

    for (const name of names) {
      const modPath = this._resolveSkillPath(name)
      if (!modPath) {
        console.warn(`[SkillWarmup] Skill not found: ${name}`)
        continue
      }

      try {
        const mod = require(modPath) as SkillModule
        const hasInterface = typeof mod.run === "function"
                          || typeof mod.execute === "function"
                          || Object.keys(mod).length > 0

        if (hasInterface) {
          loaded++
        } else {
          console.warn(`[SkillWarmup] Skill "${name}" exports nothing useful`)
        }
      } catch (err: any) {
        console.warn(`[SkillWarmup] Failed to load "${name}": ${err.message}`)
      }
    }

    const elapsed = Date.now() - start
    console.log(`[SkillWarmup] Warmed up ${loaded} skills in ${elapsed}ms`)
  }

  /**
   * Called on `devos serve` — warms up top skills before the dashboard starts.
   */
  async preloadOnServe(): Promise<void> {
    console.log("[SkillWarmup] Pre-loading skills for serve mode...")
    await this.warmup()
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * Reads taskPatterns.json and returns the top-N skill names by usageCount.
   * Falls back to listing the skills/ directory when the file is absent.
   */
  private _resolveTopSkills(): string[] {
    const patternsFile = path.join(
      process.cwd(), "workspace", "memory", "taskPatterns.json"
    )

    try {
      if (fs.existsSync(patternsFile)) {
        const raw      = fs.readFileSync(patternsFile, "utf-8")
        const patterns = JSON.parse(raw) as Array<{ tags?: string[]; usageCount?: number }>

        // Extract skill names from tags, sort by usageCount
        const counts: Record<string, number> = {}
        for (const p of patterns) {
          for (const tag of p.tags ?? []) {
            counts[tag] = (counts[tag] ?? 0) + (p.usageCount ?? 1)
          }
        }

        return Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, TOP_N_BY_USAGE)
          .map(([name]) => name)
      }
    } catch {
      // fall through
    }

    // Fallback: first N subdirectories in skills/
    try {
      return fs.readdirSync(SKILLS_DIR)
        .filter(e => {
          try { return fs.statSync(path.join(SKILLS_DIR, e)).isDirectory() } catch { return false }
        })
        .slice(0, TOP_N_BY_USAGE)
    } catch {
      return []
    }
  }

  /**
   * Resolves the require()-able path for a skill name.
   * Tries: skills/<name>.ts, skills/<name>/index.ts, skills/<name>.js
   */
  private _resolveSkillPath(name: string): string | null {
    const candidates = [
      path.join(SKILLS_DIR, `${name}.ts`),
      path.join(SKILLS_DIR, name, "index.ts"),
      path.join(SKILLS_DIR, `${name}.js`),
      path.join(SKILLS_DIR, name, "index.js"),
    ]

    for (const c of candidates) {
      if (fs.existsSync(c)) return c
    }

    return null
  }
}

export const skillWarmup = new SkillWarmup()
