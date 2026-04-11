// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/setupWizard.ts — First-boot setup wizard.
// Sprint 25: 3-case smart UX:
//   Case 1 — All good models already installed → confirm + use
//   Case 2 — Gaps or user wants upgrades → show plan + pull
//   Case 3 — Skip/offline → save what exists with fallbacks

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { spawn } from 'child_process'
import { detectHardware } from './hardwareDetector'
import { modelRouter, TaskType } from './modelRouter'
import { livePulse } from '../coordination/livePulse'

const CONFIG_DIR   = path.join(process.cwd(), 'config')
const MODEL_CONFIG = path.join(CONFIG_DIR, 'model-selection.json')
const SETUP_FLAG   = path.join(CONFIG_DIR, 'setup-complete.json')

const TASK_TYPES: TaskType[] = ['chat', 'code', 'vision', 'reasoning', 'embedding']

function ask(q: string, nonTtyDefault = 'skip'): Promise<string> {
  // When running as an Electron child process or in any non-interactive context
  // (no TTY attached to stdin), auto-answer with the default to avoid hanging.
  if (!process.stdin.isTTY) {
    console.log(`${q}[non-interactive: auto-answering "${nonTtyDefault}"]`)
    return Promise.resolve(nonTtyDefault)
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(res => rl.question(q, ans => { rl.close(); res(ans.trim().toLowerCase()) }))
}

function pullModel(model: string): Promise<void> {
  return new Promise((resolve, reject) => {
    livePulse.act('CEO', `Pulling model: ${model}`)
    const proc = spawn('ollama', ['pull', model], { stdio: 'inherit' })
    proc.on('close', code => {
      if (code === 0) { livePulse.done('CEO', `Model ready: ${model}`); resolve() }
      else { livePulse.error('CEO', `Failed: ${model}`); reject(new Error(`exit ${code}`)) }
    })
  })
}

function saveSelection(selection: Record<string, string>): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(MODEL_CONFIG, JSON.stringify(selection, null, 2))
}

function markComplete(hw: ReturnType<typeof detectHardware>, selection: Record<string, string>): void {
  fs.writeFileSync(SETUP_FLAG, JSON.stringify({
    complete:  true,
    setupAt:   new Date().toISOString(),
    hardware:  hw,
    models:    selection,
  }, null, 2))
}

export async function runSetupWizard(): Promise<void> {
  if (isSetupComplete()) return

  const hw = detectHardware()
  modelRouter.syncWithOllama()
  const assessment = modelRouter.assessInstalledModels()

  const gpuLine = hw.appleSilicon
    ? `Apple Silicon (${hw.gpu})`
    : `${hw.gpu} · ${hw.vramGB}GB VRAM`

  console.log(`
┌─────────────────────────────────────────┐
│  DevOS — First Boot                     │
└─────────────────────────────────────────┘

  Hey! I just scanned your machine.

  GPU    →  ${gpuLine}
  RAM    →  ${hw.ramGB}GB
  OS     →  ${hw.platform}${hw.cudaAvailable ? '  ·  CUDA ✓' : ''}
`)

  // ── CASE 1: All good models already installed ────────────────
  if (assessment.allGood) {
    console.log(`  Good news — I found models already installed on your machine:\n`)
    const selection: Record<string, string> = {}

    for (const task of TASK_TYPES) {
      const m       = assessment.goodModels[task]!
      const upgrade = assessment.upgradesAvailable[task]
      const note    = upgrade ? `  (better option: ${upgrade.name})` : ''
      console.log(`  ${task.padEnd(10)} →  ${m.name.padEnd(25)} ✓ installed${note}`)
      selection[task] = m.name
    }
    console.log('')

    const answer = await ask('  Use these models? (yes / no)  ', 'yes')
    console.log('')

    if (answer === 'yes' || answer === 'y') {
      saveSelection(selection)
      markComplete(hw, selection)
      console.log('  ✓ All set. DevOS is ready.\n  Run: devos serve\n')
      return
    }
    // If no, fall through to show upgrade options
    console.log('  Ok — showing better options available for your hardware:\n')
  }

  // ── CASE 2: Some gaps or user wants upgrades ─────────────────
  const selection: Record<string, string> = {}
  const toPull:    string[]               = []

  console.log(`  Here's what I recommend for your ${hw.gpu}:\n`)

  for (const task of TASK_TYPES) {
    const good    = assessment.goodModels[task]
    const upgrade = assessment.upgradesAvailable[task]
    const missing = assessment.missingModels[task]

    if (good && !upgrade) {
      // Already has the best option
      console.log(`  ${task.padEnd(10)} →  ${good.name.padEnd(25)} ✓ installed, best fit`)
      selection[task] = good.name
    } else if (good && upgrade) {
      // Has something but better available
      console.log(`  ${task.padEnd(10)} →  ${upgrade.name.padEnd(25)} ↑ upgrade from ${good.name}`)
      selection[task] = upgrade.name
      toPull.push(upgrade.name)
    } else if (missing) {
      // Nothing installed for this task
      console.log(`  ${task.padEnd(10)} →  ${missing.name.padEnd(25)} ✗ not installed`)
      selection[task] = missing.name
      toPull.push(missing.name)
    } else {
      // Absolute fallback
      console.log(`  ${task.padEnd(10)} →  ${'phi3:mini'.padEnd(25)} ⚠ fallback`)
      selection[task] = 'phi3:mini'
    }
  }
  console.log('')

  // Nothing needs pulling — just save config and finish
  if (!toPull.length) {
    saveSelection(selection)
    markComplete(hw, selection)
    console.log('  ✓ Configuration saved. Run: devos serve\n')
    return
  }

  const modelWord = toPull.length === 1 ? 'model' : 'models'
  const answer = await ask(
    `  Download ${toPull.length} ${modelWord}? (yes / no / skip)  `,
  )
  console.log('')

  // ── CASE 3: Skip downloads ───────────────────────────────────
  if (answer === 'skip' || answer === 's') {
    // Keep installed models; fall back for tasks with nothing
    for (const task of TASK_TYPES) {
      if (!selection[task] || toPull.includes(selection[task])) {
        const installed = assessment.goodModels[task]
        selection[task] = installed ? installed.name : 'phi3:mini'
      }
    }
    saveSelection(selection)
    markComplete(hw, selection)
    console.log('  ✓ Saved with available models. Pull later: ollama pull <model>\n')
    return
  }

  if (answer !== 'yes' && answer !== 'y') {
    console.log('  No problem. Run: devos config models to configure manually.\n')
    return
  }

  // Pull missing / upgrade models
  const unique = [...new Set(toPull)]
  console.log(`  Pulling ${unique.length} ${unique.length === 1 ? 'model' : 'models'}...\n`)

  for (const model of unique) {
    try {
      await pullModel(model)
    } catch {
      console.log(`  ✗ Could not pull ${model}. Try manually: ollama pull ${model}`)
      // Fall back to installed equivalent for this task
      for (const task of TASK_TYPES) {
        if (selection[task] === model) {
          const fallback = assessment.goodModels[task]
          selection[task] = fallback ? fallback.name : 'phi3:mini'
        }
      }
    }
  }

  saveSelection(selection)
  markComplete(hw, selection)

  console.log(`
  ✓ DevOS is configured for your machine.
  Run: devos serve
`)
}

export function isSetupComplete(): boolean {
  return fs.existsSync(SETUP_FLAG)
}
