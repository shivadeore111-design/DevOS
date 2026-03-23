// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/modelRouter.ts — Routes task types to the best available local model.
//
// Sprint 24: Hardware is always auto-detected; removed hardcoded constructor
// assignment and configPath parameter.
//
// NOTE: The full implementation (full model registry, scoring, fallback chains)
// lives at C:\Users\shiva\DevOS\core\modelRouter.ts and will be merged on the
// host machine. This stub satisfies all Sprint 24 imports and is type-safe.

import { detectHardware, HardwareProfile } from './hardwareDetector'
import * as fs   from 'fs'
import * as path from 'path'

type TaskType = 'chat' | 'code' | 'vision' | 'reasoning' | 'embedding'

interface ModelEntry {
  name:    string
  vramGB:  number
  type:    TaskType
}

const MODEL_CONFIG = path.join(process.cwd(), 'config', 'model-selection.json')

class ModelRouter {
  private hardware: HardwareProfile
  private models:   ModelEntry[]

  constructor() {
    this.hardware = detectHardware() // auto-detects any user's machine
    this.models   = this.buildRegistry()
  }

  private buildRegistry(): ModelEntry[] {
    // Load user-selected models from setupWizard output if available
    if (fs.existsSync(MODEL_CONFIG)) {
      try {
        const selection = JSON.parse(fs.readFileSync(MODEL_CONFIG, 'utf-8'))
        return Object.entries(selection).map(([type, name]) => ({
          name:   name as string,
          vramGB: this.hardware.vramGB,
          type:   type as TaskType,
        }))
      } catch {}
    }

    // Fallback defaults based on detected VRAM
    const vram = this.hardware.vramGB
    return [
      { name: vram >= 6 ? 'mistral-nemo:12b'    : 'llama3.2:3b',         vramGB: vram, type: 'chat'      },
      { name: vram >= 6 ? 'qwen2.5-coder:7b'    : 'qwen2.5-coder:1.5b',  vramGB: vram, type: 'code'      },
      { name: vram >= 5 ? 'llava:7b'             : 'moondream',           vramGB: vram, type: 'vision'    },
      { name: vram >= 6 ? 'mistral:7b'           : 'phi3:medium',         vramGB: vram, type: 'reasoning' },
      { name: vram >= 2 ? 'mxbai-embed-large'    : 'nomic-embed-text',    vramGB: vram, type: 'embedding' },
    ]
  }

  route(task: TaskType): string {
    const match = this.models.find(m => m.type === task)
    return match?.name ?? 'phi3:mini'
  }

  getHardware(): HardwareProfile {
    return this.hardware
  }

  listModels(): ModelEntry[] {
    return this.models
  }
}

export const modelRouter = new ModelRouter()
