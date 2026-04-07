// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/instinctSystem.ts — Micro-pattern instinct layer.
// Sits BELOW skills. Instincts are atomic "when X do Y" patterns
// with confidence scores. When 3+ related instincts cluster with
// enough total confidence, they evolve into a full SKILL.md.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

// ── Types ──────────────────────────────────────────────────────

interface Instinct {
  id:             string
  action:         string        // "When X, do Y"
  words:          string[]      // pre-tokenized words for findSimilar() — not persisted
  evidence:       string[]      // session IDs where observed
  confidence:     number        // 0.0 to 1.0
  category:       'user_preference' | 'tool_pattern' | 'error_fix'
  created:        string
  lastSeen:       string
  contradictions: number
  status:         'active' | 'deprecated' | 'evolved_into'
  evolvedInto?:   string        // skill name if evolved
}

// ── Thresholds ─────────────────────────────────────────────────

const CONFIDENCE_GAIN         = 0.1
const CONFIDENCE_LOSS         = 0.2
const DEPRECATION_THRESHOLD   = 0.2
const EVOLUTION_MIN_COUNT     = 3
const EVOLUTION_MIN_CONFIDENCE = 2.0   // sum of confidences across group

// ── InstinctSystem ─────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(w => w.length > 3)
}

class InstinctSystem {
  private instincts:   Instinct[] = []
  private savePath:    string
  private learnedDir:  string
  private _saveTimer:  ReturnType<typeof setTimeout> | null = null

  constructor(workspaceDir: string) {
    // CRITICAL: instincts are workspace-scoped.
    // Trading instincts don't leak into DevOS work.
    this.savePath   = join(workspaceDir, 'instincts.json')
    this.learnedDir = join(workspaceDir, 'skills', 'learned')
    this.load()
  }

  // ── Observe a tool call ───────────────────────────────────────

  observe(
    toolName:  string,
    args:      Record<string, any>,
    success:   boolean,
    sessionId: string,
  ): void {
    const argSnippet = JSON.stringify(args).slice(0, 80)
    const action     = success
      ? `Use ${toolName} with args like ${argSnippet}`
      : `Avoid ${toolName} when args like ${argSnippet} — fails`

    const words    = tokenize(action)
    const existing = this.findSimilar(words)

    if (existing) {
      if (success) {
        existing.confidence = Math.min(0.95, existing.confidence + CONFIDENCE_GAIN)
        if (!existing.evidence.includes(sessionId)) {
          existing.evidence.push(sessionId)
        }
      } else {
        existing.confidence -= CONFIDENCE_LOSS
        existing.contradictions++
        if (existing.confidence < DEPRECATION_THRESHOLD) {
          existing.status = 'deprecated'
          console.log(`[Instinct] Deprecated: "${existing.action.slice(0, 60)}"`)
        }
      }
      existing.lastSeen = new Date().toISOString()
    } else if (success) {
      this.instincts.push({
        id:             `inst_${Date.now()}`,
        action,
        words,
        evidence:       [sessionId],
        confidence:     0.3,
        category:       'tool_pattern',
        created:        new Date().toISOString(),
        lastSeen:       new Date().toISOString(),
        contradictions: 0,
        status:         'active',
      })
    }

    this.checkEvolution()
    this.save()
  }

  // ── Word-overlap similarity — 3+ shared words = same instinct ─
  // Accepts pre-tokenized words to avoid re-tokenizing the incoming action.
  // Uses inst.words cache so each stored instinct is tokenized only once.

  private findSimilar(incomingWords: string[]): Instinct | undefined {
    const wordSet = new Set(incomingWords)
    return this.instincts.find(inst => {
      if (inst.status !== 'active') return false
      // inst.words may be absent on instincts loaded from disk before this field existed
      const instWords = inst.words ?? (inst.words = tokenize(inst.action))
      return instWords.filter(w => wordSet.has(w)).length >= 3
    })
  }

  // ── Evolution check — cluster 3+ high-confidence instincts ────

  private checkEvolution(): void {
    // Skip when too few active instincts to possibly meet EVOLUTION_MIN_COUNT
    const activeCount = this.instincts.filter(i => i.status === 'active').length
    if (activeCount < EVOLUTION_MIN_COUNT) return

    const byCategory = new Map<string, Instinct[]>()
    for (const inst of this.instincts) {
      if (inst.status !== 'active') continue
      const group = byCategory.get(inst.category) ?? []
      group.push(inst)
      byCategory.set(inst.category, group)
    }

    for (const [, group] of byCategory) {
      if (group.length < EVOLUTION_MIN_COUNT) continue

      const totalConfidence = group.reduce((sum, i) => sum + i.confidence, 0)
      if (totalConfidence < EVOLUTION_MIN_CONFIDENCE) continue

      const skillName = `evolved_${group[0].category}_${Date.now()}`
      console.log(
        `[Instinct] Evolving ${group.length} instincts into skill: ${skillName}`,
      )

      for (const inst of group) {
        inst.status     = 'evolved_into'
        inst.evolvedInto = skillName
      }

      this.notifyEvolution(skillName, group)
    }
  }

  // ── Write a SKILL.md directory for SkillLoader to pick up ─────
  // SkillLoader expects: skills/learned/{name}/SKILL.md
  // A flat .md file would be skipped (isDirectory() check).

  private notifyEvolution(skillName: string, instincts: Instinct[]): void {
    const skillDir  = join(this.learnedDir, skillName)
    const skillFile = join(skillDir, 'SKILL.md')

    const content = [
      `---`,
      `name: ${skillName}`,
      `description: Evolved from ${instincts.length} observed tool patterns`,
      `version: 1.0.0`,
      `confidence: low`,
      `tags: ${instincts[0].category}, evolved, auto-generated`,
      `---`,
      ``,
      `## Source Instincts`,
      ...instincts.map(i =>
        `- ${i.action} (confidence: ${(i.confidence * 100).toFixed(0)}%)`,
      ),
      ``,
      `## Summary`,
      `This skill evolved from ${instincts.length} observed patterns in category "${instincts[0].category}".`,
    ].join('\n')

    try {
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(skillFile, content)
      console.log(`[Instinct] Wrote evolved skill: ${skillFile}`)
      // Invalidate skillLoader cache so new skill is picked up
      import('./skillLoader').then(m => m.skillLoader.refresh()).catch(() => {})
    } catch (e: any) {
      console.warn(`[Instinct] Failed to write evolved skill: ${e.message}`)
    }
  }

  // ── Retrieve top instincts relevant to current context ────────

  getRelevantInstincts(context: string): string {
    const active = this.instincts
      .filter(i => i.status === 'active' && i.confidence > 0.5)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)

    if (active.length === 0) return ''

    return (
      'Learned patterns:\n' +
      active
        .map(i => `- ${i.action} (confidence: ${(i.confidence * 100).toFixed(0)}%)`)
        .join('\n')
    )
  }

  // ── Persistence ───────────────────────────────────────────────

  private load(): void {
    try {
      this.instincts = JSON.parse(readFileSync(this.savePath, 'utf8'))
    } catch {
      this.instincts = []
    }
  }

  // Debounced — coalesces rapid bursts of tool calls into one disk write
  private save(): void {
    if (this._saveTimer) return
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null
      try {
        mkdirSync(dirname(this.savePath), { recursive: true })
        writeFileSync(this.savePath, JSON.stringify(this.instincts, null, 2))
      } catch {}
    }, 2000)
  }
}

// ── Singleton — initialized at startup via initInstinctSystem ──

export let instinctSystem: InstinctSystem | undefined

export function initInstinctSystem(workspaceDir: string): void {
  instinctSystem = new InstinctSystem(workspaceDir)
  console.log('[Instinct] System initialized')
}
