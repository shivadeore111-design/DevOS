// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/learningMemory.ts — Self-learning from task outcomes.
// Records every plan execution (success or failure) and surfaces
// similar past experiences to guide the planner on future tasks.

import fs   from 'fs'
import path from 'path'
import { semanticMemory } from './semanticMemory'

export interface Experience {
  id:               string
  task:             string
  taskEmbeddingKey: string   // first 50 chars normalized — used for fast keyword overlap
  success:          boolean
  steps:            string[] // ordered list of tools used
  duration:         number   // total ms across all steps
  tokenUsage:       number
  filesCreated:     string[]
  errorMessage?:    string
  timestamp:        number
}

const LEARNING_PATH = path.join(process.cwd(), 'workspace', 'learning.json')

// ── LearningMemory ─────────────────────────────────────────────

export class LearningMemory {
  private data: Experience[] = []

  constructor() {
    this.load()
  }

  // ── Persistence ───────────────────────────────────────────────

  private load(): void {
    try {
      if (fs.existsSync(LEARNING_PATH)) {
        this.data = JSON.parse(fs.readFileSync(LEARNING_PATH, 'utf-8')) as Experience[]
      }
    } catch {}
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(LEARNING_PATH), { recursive: true })
      fs.writeFileSync(LEARNING_PATH, JSON.stringify(this.data, null, 2))
    } catch {}
  }

  // ── Key normalization ─────────────────────────────────────────

  private normalize(task: string): string {
    return task
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .slice(0, 50)
      .trim()
  }

  // ── Record experience ─────────────────────────────────────────

  record(exp: Omit<Experience, 'id' | 'taskEmbeddingKey' | 'timestamp'>): void {
    const experience: Experience = {
      ...exp,
      id:               `exp_${Date.now()}`,
      taskEmbeddingKey: this.normalize(exp.task),
      timestamp:        Date.now(),
    }

    this.data.push(experience)

    // Keep last 200 experiences
    if (this.data.length > 200) {
      this.data = this.data.slice(-200)
    }

    // Index successful patterns into semantic memory for fuzzy matching
    if (exp.success) {
      semanticMemory.add(
        `Successful task: ${exp.task}. Steps: ${exp.steps.join(' → ')}`,
        'result',
        ['success', 'pattern'],
      )
    }

    this.save()
  }

  // ── Similarity search ─────────────────────────────────────────
  // Uses word-level Jaccard overlap — fast, no vectors required.

  findSimilar(task: string, topK = 3): Experience[] {
    const normalized  = this.normalize(task)
    const queryWords  = new Set(normalized.split(/\s+/).filter(w => w.length > 3))
    if (queryWords.size === 0) return []

    const scored = this.data.map(exp => {
      const expWords = new Set(exp.taskEmbeddingKey.split(/\s+/))
      let overlap    = 0
      queryWords.forEach(w => { if (expWords.has(w)) overlap++ })
      const score = overlap / Math.max(queryWords.size, expWords.size, 1)
      return { exp, score }
    })

    return scored
      .filter(s => s.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.exp)
  }

  // ── Context string for planner ────────────────────────────────

  buildLearningContext(task: string): string {
    const similar = this.findSimilar(task)
    if (similar.length === 0) return ''

    const lines = ['PAST EXPERIENCE (use to choose better steps and avoid known failures):']

    similar.forEach(exp => {
      const status = exp.success ? '✓' : '✗'
      lines.push(`${status} "${exp.task.slice(0, 60)}"`)
      lines.push(`  Steps used: ${exp.steps.join(' → ')}`)
      if (!exp.success && exp.errorMessage) {
        lines.push(`  Failed because: ${exp.errorMessage.slice(0, 100)}`)
      }
      if (exp.filesCreated.length > 0) {
        lines.push(`  Files created: ${exp.filesCreated.join(', ')}`)
      }
    })

    return lines.join('\n')
  }

  // ── Stats ─────────────────────────────────────────────────────

  getStats(): { total: number; successRate: number; avgDuration: number } {
    if (this.data.length === 0) return { total: 0, successRate: 0, avgDuration: 0 }
    const successful   = this.data.filter(e => e.success).length
    const avgDuration  = this.data.reduce((s, e) => s + e.duration, 0) / this.data.length
    return {
      total:       this.data.length,
      successRate: Math.round((successful / this.data.length) * 100),
      avgDuration: Math.round(avgDuration),
    }
  }
}

export const learningMemory = new LearningMemory()
