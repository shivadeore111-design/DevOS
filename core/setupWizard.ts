// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/setupWizard.ts — First-boot setup wizard.
// Detects hardware, picks optimal Ollama models, pulls them.

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { spawn, execSync } from 'child_process'
import { detectHardware, HardwareProfile } from './hardwareDetector'
import { livePulse } from '../coordination/livePulse'

type TaskType = 'chat' | 'code' | 'vision' | 'reasoning' | 'embedding'

const CONFIG_DIR   = path.join(process.cwd(), 'config')
const MODEL_CONFIG = path.join(CONFIG_DIR, 'model-selection.json')
const SETUP_FLAG   = path.join(CONFIG_DIR, 'setup-complete.json')

const MODELS = [
  // Chat
  { name: 'phi3:mini',           vramGB: 2, type: 'chat'      as TaskType, moeEnabled: false, description: 'Lightweight, fast, fits any GPU' },
  { name: 'llama3.2:3b',         vramGB: 3, type: 'chat'      as TaskType, moeEnabled: false, description: 'Meta Llama 3.2 — fast and capable' },
  { name: 'mistral-nemo:12b',    vramGB: 6, type: 'chat'      as TaskType, moeEnabled: false, description: 'Best chat quality at 6GB VRAM' },
  // Code
  { name: 'qwen2.5-coder:1.5b',  vramGB: 2, type: 'code'      as TaskType, moeEnabled: false, description: 'Fast coder for simple tasks' },
  { name: 'deepseek-coder:6.7b', vramGB: 5, type: 'code'      as TaskType, moeEnabled: false, description: 'Efficient coding model' },
  { name: 'qwen2.5-coder:7b',    vramGB: 6, type: 'code'      as TaskType, moeEnabled: false, description: 'Best local coder at 6GB VRAM' },
  // Vision
  { name: 'moondream',           vramGB: 2, type: 'vision'    as TaskType, moeEnabled: false, description: 'Tiny vision model, fast' },
  { name: 'llava:7b',            vramGB: 5, type: 'vision'    as TaskType, moeEnabled: false, description: 'Full quality vision + text' },
  // Reasoning
  { name: 'phi3:medium',         vramGB: 5, type: 'reasoning' as TaskType, moeEnabled: false, description: 'Strong reasoning, fits 6GB' },
  { name: 'mistral:7b',          vramGB: 6, type: 'reasoning' as TaskType, moeEnabled: false, description: 'Balanced reasoning model' },
  // Embedding
  { name: 'nomic-embed-text',    vramGB: 1, type: 'embedding' as TaskType, moeEnabled: false, description: 'Fast text embeddings' },
  { name: 'mxbai-embed-large',   vramGB: 2, type: 'embedding' as TaskType, moeEnabled: false, description: 'Higher quality embeddings' },
]

function pickBestModel(task: TaskType, vram: number): string {
  const candidates = MODELS.filter(m => m.type === task && m.vramGB <= vram)
  if (!candidates.length) return 'phi3:mini'
  const moe  = candidates.filter(m => m.moeEnabled)
  const pool = moe.length ? moe : candidates
  return pool.sort((a, b) => b.vramGB - a.vramGB)[0].name
}

function ask(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(res => rl.question(q, ans => { rl.close(); res(ans.trim().toLowerCase()) }))
}

function getInstalledModels(): string[] {
  try {
    const output = execSync('ollama list', { timeout: 5000 }).toString()
    // ollama list format: "name:tag    ID    SIZE    MODIFIED"
    return output.split('\n')
      .slice(1) // skip header line
      .map(line => line.split(/\s+/)[0]) // take first column only
      .filter(Boolean)
  } catch { return [] }
}

function pullModel(model: string): Promise<void> {
  return new Promise((resolve, reject) => {
    livePulse.act('CEO', `Pulling model: ${model}`)
    const proc = spawn('ollama', ['pull', model], { stdio: 'inherit' })
    proc.on('close', code => {
      if (code === 0) {
        livePulse.done('CEO', `Model ready: ${model}`)
        resolve()
      } else {
        livePulse.error('CEO', `Failed to pull: ${model}`)
        reject()
      }
    })
  })
}

export async function runSetupWizard(): Promise<void> {
  if (isSetupComplete()) return

  const hw = detectHardware()

  const selection = {
    chat:      pickBestModel('chat',      hw.vramGB),
    code:      pickBestModel('code',      hw.vramGB),
    vision:    pickBestModel('vision',    hw.vramGB),
    reasoning: pickBestModel('reasoning', hw.vramGB),
    embedding: pickBestModel('embedding', hw.vramGB),
  }

  // DevOSMind personality — feels alive, not robotic
  const gpuLine = hw.appleSilicon
    ? `Apple Silicon (${hw.gpu})`
    : `${hw.gpu} (${hw.vramGB}GB VRAM)`

  console.log(`
┌─────────────────────────────────────────┐
│  DevOS — First Boot                     │
└─────────────────────────────────────────┘

Hey! I just scanned your machine. Here's what I found:

  GPU    →  ${gpuLine}
  RAM    →  ${hw.ramGB}GB
  OS     →  ${hw.platform}${hw.cudaAvailable ? '  ·  CUDA available ✓' : ''}

Based on your hardware, here's what I'd recommend:

  Chat       →  ${selection.chat}
  Code       →  ${selection.code}
  Vision     →  ${selection.vision}
  Reasoning  →  ${selection.reasoning}
  Embeddings →  ${selection.embedding}

These are the best models for your specific setup —
not too big to run, not too small to be useful.
`)

  const answer = await ask('  Apply these settings and pull the models? (yes / no)  ')
  console.log('')

  if (answer !== 'yes' && answer !== 'y') {
    console.log(`  No problem. You can configure manually anytime:\n  devos config models\n`)
    return
  }

  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(MODEL_CONFIG, JSON.stringify(selection, null, 2))

  console.log(`  Pulling models for your machine...\n`)

  const installed = getInstalledModels()
  const unique    = [...new Set(Object.values(selection))]

  for (const model of unique) {
    if (installed.some(m => m.startsWith(model.split(':')[0]))) {
      console.log(`  ✓  Already installed: ${model}`)
      continue
    }
    try {
      await pullModel(model)
    } catch {
      console.log(`  ✗  Could not pull ${model} — skipping. Pull manually: ollama pull ${model}`)
    }
  }

  fs.writeFileSync(SETUP_FLAG, JSON.stringify({
    complete:  true,
    setupAt:   new Date().toISOString(),
    hardware:  hw,
    models:    selection
  }, null, 2))

  console.log(`
  ✓ All done. DevOS is configured for your machine.
  Run: devos serve
`)
}

export function isSetupComplete(): boolean {
  return fs.existsSync(SETUP_FLAG)
}
