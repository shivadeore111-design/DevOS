// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/modelRouter.ts — Smart model detection, VRAM-aware selection,
// Ollama sync, installed-model assessment, and upgrade recommendations.
// Sprint 25: Full implementation with ModelInfo, AssessmentResult, listCompatible,
// listInstalled, assessInstalledModels, and getHardwareInfo.

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { detectHardware } from './hardwareDetector'

export type TaskType = 'chat' | 'code' | 'vision' | 'reasoning' | 'embedding'

export interface ModelInfo {
  name:        string
  vramGB:      number
  type:        TaskType
  moeEnabled:  boolean
  description: string
  installed:   boolean
  ollamaTag:   string
}

export interface AssessmentResult {
  allGood:           boolean
  goodModels:        Record<TaskType, ModelInfo | null>
  missingModels:     Record<TaskType, ModelInfo | null>
  hasGaps:           boolean
  upgradesAvailable: Record<TaskType, ModelInfo | null>
}

const TASK_TYPES: TaskType[] = ['chat', 'code', 'vision', 'reasoning', 'embedding']

export class ModelRouter {
  private hardware: ReturnType<typeof detectHardware>
  private models:   ModelInfo[]

  constructor() {
    this.hardware = detectHardware()
    this.models   = this.buildRegistry()
    this.syncWithOllama()
  }

  private buildRegistry(): ModelInfo[] {
    return [
      // Chat
      { name: 'phi3:mini',           ollamaTag: 'phi3:mini',            vramGB: 2, type: 'chat',      moeEnabled: false, installed: false, description: 'Lightweight fast chat, fits any GPU' },
      { name: 'llama3.2:3b',         ollamaTag: 'llama3.2:3b',          vramGB: 3, type: 'chat',      moeEnabled: false, installed: false, description: 'Meta Llama 3.2 — fast and capable' },
      { name: 'mistral-nemo:12b',    ollamaTag: 'mistral-nemo:12b',     vramGB: 6, type: 'chat',      moeEnabled: false, installed: false, description: 'Best chat quality at 6GB VRAM' },
      // Code
      { name: 'qwen2.5-coder:1.5b',  ollamaTag: 'qwen2.5-coder:1.5b',  vramGB: 2, type: 'code',      moeEnabled: false, installed: false, description: 'Fast coder for simple tasks' },
      { name: 'deepseek-coder:6.7b', ollamaTag: 'deepseek-coder:6.7b', vramGB: 5, type: 'code',      moeEnabled: false, installed: false, description: 'Efficient coding model' },
      { name: 'qwen2.5-coder:7b',    ollamaTag: 'qwen2.5-coder:7b',    vramGB: 6, type: 'code',      moeEnabled: false, installed: false, description: 'Best local coder at 6GB VRAM' },
      // Vision
      { name: 'moondream',           ollamaTag: 'moondream',            vramGB: 2, type: 'vision',    moeEnabled: false, installed: false, description: 'Tiny vision model, fast screenshots' },
      { name: 'llava:7b',            ollamaTag: 'llava:7b',             vramGB: 5, type: 'vision',    moeEnabled: false, installed: false, description: 'Full quality vision + text' },
      // Reasoning
      { name: 'phi3:medium',         ollamaTag: 'phi3:medium',          vramGB: 5, type: 'reasoning', moeEnabled: false, installed: false, description: 'Strong reasoning, fits 6GB' },
      { name: 'mistral:7b',          ollamaTag: 'mistral:7b',           vramGB: 6, type: 'reasoning', moeEnabled: false, installed: false, description: 'Balanced reasoning model' },
      // Embedding
      { name: 'nomic-embed-text',    ollamaTag: 'nomic-embed-text',     vramGB: 1, type: 'embedding', moeEnabled: false, installed: false, description: 'Fast text embeddings' },
      { name: 'mxbai-embed-large',   ollamaTag: 'mxbai-embed-large',    vramGB: 2, type: 'embedding', moeEnabled: false, installed: false, description: 'Higher quality embeddings' },
    ]
  }

  syncWithOllama(): void {
    try {
      const output = execSync('ollama list', { timeout: 5000 }).toString()
      const installedNames = output.split('\n')
        .slice(1)
        .map(l => l.trim().split(/\s+/)[0])
        .filter(Boolean)
      this.models = this.models.map(m => ({
        ...m,
        installed: installedNames.some(inst =>
          inst.toLowerCase().includes(m.name.split(':')[0].toLowerCase())
        ),
      }))
    } catch { /* Ollama not running — all installed:false */ }
  }

  recommendModel(taskType: TaskType): string {
    const budget     = this.hardware.vramGB
    const candidates = this.models.filter(m => m.type === taskType && m.vramGB <= budget)
    if (!candidates.length) return 'phi3:mini'
    // Prefer installed first, then highest VRAM
    const installed = candidates.filter(m => m.installed)
    const pool      = installed.length ? installed : candidates
    return pool.sort((a, b) => b.vramGB - a.vramGB)[0].name
  }

  // Alias used by index.ts (`devos models recommend`)
  route(task: TaskType): string {
    return this.recommendModel(task)
  }

  assessInstalledModels(): AssessmentResult {
    const budget    = this.hardware.vramGB
    const minVRAM   = budget * 0.6

    const goodModels        = {} as Record<TaskType, ModelInfo | null>
    const missingModels     = {} as Record<TaskType, ModelInfo | null>
    const upgradesAvailable = {} as Record<TaskType, ModelInfo | null>
    let hasGaps = false

    for (const task of TASK_TYPES) {
      const compatible = this.models.filter(m => m.type === task && m.vramGB <= budget)
      const installed  = compatible.filter(m => m.installed)
      const goodEnough = installed
        .filter(m => m.vramGB >= minVRAM)
        .sort((a, b) => b.vramGB - a.vramGB)[0] ?? null
      const best = compatible.sort((a, b) => b.vramGB - a.vramGB)[0] ?? null

      goodModels[task] = goodEnough
      if (!goodEnough) {
        missingModels[task] = best
        hasGaps = true
      } else {
        missingModels[task] = null
      }
      upgradesAvailable[task] =
        (goodEnough && best && best.name !== goodEnough.name) ? best : null
    }

    return { allGood: !hasGaps, goodModels, missingModels, hasGaps, upgradesAvailable }
  }

  listCompatible(): ModelInfo[] {
    return this.models
      .filter(m => m.vramGB <= this.hardware.vramGB)
      .sort((a, b) => b.vramGB - a.vramGB)
  }

  listInstalled(): ModelInfo[] {
    return this.models.filter(m => m.installed)
  }

  listAll(): ModelInfo[] { return [...this.models] }

  // Alias used by existing callers (api/server.ts, index.ts)
  listModels(): ModelInfo[] { return this.listCompatible() }

  getHardwareInfo() { return { ...this.hardware } }

  // Alias used by existing callers (api/server.ts, index.ts)
  getHardware() { return this.hardware }

  fits(modelName: string): boolean {
    const m = this.models.find(mod => mod.name === modelName)
    return m ? m.vramGB <= this.hardware.vramGB : false
  }
}

export const modelRouter = new ModelRouter()
