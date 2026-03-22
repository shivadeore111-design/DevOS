// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/hardwareConfig.ts — Reads config/hardware.json and gates model selection
//                          by available VRAM / param count.

import fs   from "fs"
import path from "path"

const CONFIG_PATH = path.join(process.cwd(), "config", "hardware.json")

interface HardwareConfigData {
  gpu: {
    name:   string
    vramGb: number
    cuda:   boolean
  }
  cpu: {
    cores: number
    name:  string
  }
  ramGb:               number
  maxModelSizeB:       number
  recommendedModels:   Record<string, string>
  blockedModels:       string[]
  maxConcurrentModels: number
}

/** Maps common size suffixes in model names to approximate parameter counts. */
const SIZE_MAP: Record<string, number> = {
  "0.5b":  500_000_000,
  "1b":  1_000_000_000,
  "1.5b": 1_500_000_000,
  "2b":  2_000_000_000,
  "3b":  3_000_000_000,
  "4b":  4_000_000_000,
  "6b":  6_000_000_000,
  "7b":  7_000_000_000,
  "8b":  8_000_000_000,
  "9b":  9_000_000_000,
  "11b": 11_000_000_000,
  "12b": 12_000_000_000,
  "13b": 13_000_000_000,
  "14b": 14_000_000_000,
  "30b": 30_000_000_000,
  "34b": 34_000_000_000,
  "70b": 70_000_000_000,
  "72b": 72_000_000_000,
}

export class HardwareConfig {

  private data: HardwareConfigData

  constructor() {
    this.data = this._load()
  }

  /** Re-read the JSON file from disk (useful after edits at runtime). */
  reload(): void {
    this.data = this._load()
    console.log(`[HardwareConfig] Reloaded — maxModelSizeB: ${this.data.maxModelSizeB.toLocaleString()}`)
  }

  /** Returns the configured maximum model parameter count. */
  getMaxModelSize(): number {
    return this.data.maxModelSizeB
  }

  /**
   * Returns true if a model is allowed to run given:
   *  1. It is not in blockedModels
   *  2. Its inferred parameter count does not exceed maxModelSizeB
   */
  isModelAllowed(modelName: string): boolean {
    const name = modelName.toLowerCase()

    // Check explicit block list first
    if (this.data.blockedModels.some(b => name.includes(b.toLowerCase()))) {
      return false
    }

    // Infer size from model name suffix
    const size = this._inferModelSize(name)
    if (size === null) return true   // unknown size — allow by default

    return size <= this.data.maxModelSizeB
  }

  /**
   * Returns the recommended model for a given task key.
   * Falls back to the "default" key, then to the env model.
   */
  getRecommendedModel(task: string): string {
    const key     = task.toLowerCase()
    const models  = this.data.recommendedModels
    return models[key] ?? models["default"] ?? process.env.OLLAMA_MODEL ?? "llama3"
  }

  /** Expose raw config in case callers need it. */
  getConfig(): HardwareConfigData {
    return this.data
  }

  // ── Private ───────────────────────────────────────────────

  private _load(): HardwareConfigData {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8")
      return JSON.parse(raw) as HardwareConfigData
    } catch {
      console.warn(`[HardwareConfig] Could not read ${CONFIG_PATH} — using defaults`)
      return {
        gpu: { name: "unknown", vramGb: 6, cuda: false },
        cpu: { cores: 4, name: "unknown" },
        ramGb: 16,
        maxModelSizeB: 7_000_000_000,
        recommendedModels: {
          default: "llama3",
          coding:  "qwen2.5-coder:7b",
        },
        blockedModels:       [],
        maxConcurrentModels: 1,
      }
    }
  }

  /**
   * Extracts the parameter-count suffix from a model name string.
   * Returns null when no recognised suffix is found.
   * e.g. "qwen2.5-coder:7b" → 7_000_000_000
   *      "mistral-nemo:12b" → 12_000_000_000
   */
  private _inferModelSize(modelName: string): number | null {
    const lower = modelName.toLowerCase()

    // Try exact suffix matches (longest first to avoid "7b" inside "70b")
    const keys = Object.keys(SIZE_MAP).sort((a, b) => b.length - a.length)
    for (const key of keys) {
      const re = new RegExp(`[^\\d]${key.replace(".", "\\.")}(:|$|\\s)`, "i")
      if (re.test(lower) || lower.startsWith(key)) {
        return SIZE_MAP[key]
      }
    }

    // Generic numeric match: "42b" or "42B"
    const genericRe = /(\d+(?:\.\d+)?)b(?:$|[^a-z])/i
    const match     = genericRe.exec(lower)
    if (match) {
      return Math.round(parseFloat(match[1]) * 1_000_000_000)
    }

    return null
  }
}

export const hardwareConfig = new HardwareConfig()
