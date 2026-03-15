// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/autoModelSelector.ts — Detects hardware, scans available Ollama models,
//                             picks the best one for each task type on startup.

import * as fs   from 'fs'
import * as path from 'path'
import * as http from 'http'

export interface ModelSelection {
  chat:        string
  coding:      string
  planning:    string
  embedding:   string
  detectedAt:  string
  gpuName?:    string
  gpuVramGB?:  number
  reason:      string
}

const SELECTION_FILE = path.join(process.cwd(), 'config/model-selection.json')

// Model performance tiers by VRAM requirement (descending quality)
const MODEL_TIERS = [
  { name: 'qwen2.5-coder:14b',      vramGB: 10, quality: 10, goodFor: ['coding', 'planning'] },
  { name: 'mistral-nemo:12b',        vramGB: 8,  quality: 9,  goodFor: ['chat', 'planning']   },
  { name: 'llama3:8b',               vramGB: 6,  quality: 8,  goodFor: ['chat', 'coding']      },
  { name: 'qwen2.5-coder:7b',        vramGB: 5,  quality: 8,  goodFor: ['coding']              },
  { name: 'qwen2.5:7b-instruct',     vramGB: 5,  quality: 7,  goodFor: ['chat', 'planning']    },
  { name: 'llama3.2:latest',         vramGB: 3,  quality: 7,  goodFor: ['chat']                },
  { name: 'mistral:7b-instruct',     vramGB: 5,  quality: 7,  goodFor: ['chat', 'planning']    },
  { name: 'qwen2.5:7b-16k',         vramGB: 5,  quality: 7,  goodFor: ['chat', 'planning']    },
  { name: 'llama3:latest',           vramGB: 6,  quality: 7,  goodFor: ['chat']                },
]

async function getAvailableModels(): Promise<string[]> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port: 11434, path: '/api/tags', method: 'GET' },
      (res) => {
        let data = ''
        res.on('data', c => data += c)
        res.on('end', () => {
          try {
            const tags = JSON.parse(data)
            resolve((tags.models || []).map((m: any) => m.name))
          } catch { resolve([]) }
        })
      }
    )
    req.on('error', () => resolve([]))
    req.setTimeout(5000, () => { req.destroy(); resolve([]) })
    req.end()
  })
}

function getGpuVram(): { vramGB: number; gpuName?: string } {
  try {
    const hwPath = path.join(process.cwd(), 'config/hardware.json')
    if (fs.existsSync(hwPath)) {
      const hw = JSON.parse(fs.readFileSync(hwPath, 'utf-8'))
      // Support both vramGB and vramGb field names
      const vramGB = hw.gpu?.vramGB ?? hw.gpu?.vramGb ?? hw.vramGB ?? 0
      return { vramGB, gpuName: hw.gpu?.name }
    }
  } catch {}
  return { vramGB: 0 }
}

export async function detectAndSelectModels(): Promise<ModelSelection> {
  const available = await getAvailableModels()
  const { vramGB, gpuName } = getGpuVram()

  console.log(`[AutoModelSelector] Available models: ${available.length}`)
  console.log(`[AutoModelSelector] VRAM: ${vramGB}GB${gpuName ? ` (${gpuName})` : ''}`)

  // If VRAM unknown (0), use conservative 4GB limit
  const effectiveVram = vramGB > 0 ? vramGB : 4

  // Filter to models that are both available AND fit in VRAM
  const usable = MODEL_TIERS.filter(m =>
    available.some(a => a.toLowerCase().includes(m.name.split(':')[0].toLowerCase())) &&
    m.vramGB <= effectiveVram
  )

  // Pick the best available model for a given task type
  const pickBest = (task: string): string => {
    const candidates = usable
      .filter(m => m.goodFor.includes(task))
      .sort((a, b) => b.quality - a.quality)
    if (candidates.length > 0) {
      const baseModel = candidates[0].name.split(':')[0].toLowerCase()
      const match = available.find(a => a.toLowerCase().includes(baseModel))
      return match || candidates[0].name
    }
    // Fallback to first available model
    return available[0] || 'llama3.2:latest'
  }

  const selection: ModelSelection = {
    chat:       pickBest('chat'),
    coding:     pickBest('coding'),
    planning:   pickBest('planning'),
    embedding:  available.find(a => a.includes('nomic-embed')) || available[0] || '',
    detectedAt: new Date().toISOString(),
    gpuVramGB:  vramGB,
    gpuName,
    reason:     `Auto-selected for ${effectiveVram}GB VRAM from ${available.length} available models`
  }

  // Ensure config/ directory exists
  fs.mkdirSync(path.join(process.cwd(), 'config'), { recursive: true })
  fs.writeFileSync(SELECTION_FILE, JSON.stringify(selection, null, 2))

  console.log(`[AutoModelSelector] ✅ Chat:     ${selection.chat}`)
  console.log(`[AutoModelSelector] ✅ Coding:   ${selection.coding}`)
  console.log(`[AutoModelSelector] ✅ Planning: ${selection.planning}`)

  return selection
}

export function loadModelSelection(): ModelSelection | null {
  if (!fs.existsSync(SELECTION_FILE)) return null
  try { return JSON.parse(fs.readFileSync(SELECTION_FILE, 'utf-8')) } catch { return null }
}

export function getChatModel(): string {
  return loadModelSelection()?.chat || 'llama3.2:latest'
}

export function getCodingModel(): string {
  return loadModelSelection()?.coding || 'qwen2.5-coder:7b'
}

export function getPlanningModel(): string {
  return loadModelSelection()?.planning || 'llama3.2:latest'
}
