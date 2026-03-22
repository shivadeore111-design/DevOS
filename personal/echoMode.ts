// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personal/echoMode.ts — Record user workflows and replay them
//
// CLI:
//   devos echo "<name>"       → start recording
//   devos echo stop           → stop + save
//   devos run echo "<name>"   → replay workflow
//
// Persists to: workspace/echo-workflows.json

import * as fs     from 'fs'
import * as path   from 'path'
import * as crypto from 'crypto'

// ── Types ──────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  /** Human-readable description of the action */
  action:    string
  /** Tool / system that performed the action */
  tool?:     string
  /** Inputs passed to the action */
  inputs?:   any
  /** Result / output of the action */
  result?:   any
  recordedAt: string
}

export interface Workflow {
  id:          string
  name:        string
  steps:       WorkflowStep[]
  recordedAt:  string
  lastRunAt?:  string
  runCount:    number
}

// ── Storage ────────────────────────────────────────────────────────────────

const FILE = path.join(process.cwd(), 'workspace', 'echo-workflows.json')

function loadWorkflows(): Workflow[] {
  if (!fs.existsSync(FILE)) return []
  try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch { return [] }
}

function saveWorkflows(workflows: Workflow[]): void {
  const dir = path.dirname(FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(workflows, null, 2))
}

// ── EchoMode class ─────────────────────────────────────────────────────────

class EchoMode {
  private _recording  = false
  private _current:   Partial<Workflow> | null = null

  // ── Recording ────────────────────────────────────────────────────────

  startRecording(name: string): void {
    if (this._recording) {
      console.warn(`[EchoMode] ⚠️  Already recording: ${this._current?.name}. Stop it first.`)
      return
    }
    this._recording = true
    this._current   = { name, steps: [] }
    console.log(`[EchoMode] 🔴 Recording started: "${name}". Run your workflow, then: devos echo stop`)
  }

  recordAction(action: any): void {
    if (!this._recording || !this._current) return
    const step: WorkflowStep = typeof action === 'object' && action !== null
      ? { ...action, recordedAt: new Date().toISOString() }
      : { action: String(action), recordedAt: new Date().toISOString() }
    this._current.steps = this._current.steps || []
    this._current.steps.push(step)
  }

  stopRecording(): Workflow {
    this._recording = false
    const workflow: Workflow = {
      id:         crypto.randomUUID(),
      name:       this._current?.name ?? 'unnamed',
      steps:      this._current?.steps ?? [],
      recordedAt: new Date().toISOString(),
      runCount:   0,
    }
    const all = loadWorkflows()
    // Replace if same name exists, otherwise append
    const idx = all.findIndex(w => w.name.toLowerCase() === workflow.name.toLowerCase())
    if (idx >= 0) all[idx] = workflow
    else          all.push(workflow)
    saveWorkflows(all)
    this._current = null
    console.log(`[EchoMode] ✅ Saved: "${workflow.name}" (${workflow.steps.length} step${workflow.steps.length !== 1 ? 's' : ''})`)
    return workflow
  }

  // ── Replay ────────────────────────────────────────────────────────────

  async runWorkflow(name: string): Promise<void> {
    const all      = loadWorkflows()
    const workflow = all.find(w => w.name.toLowerCase() === name.toLowerCase())
    if (!workflow) {
      console.error(`[EchoMode] ❌ Workflow not found: "${name}"`)
      return
    }

    console.log(`[EchoMode] ▶️  Running: "${workflow.name}" (${workflow.steps.length} steps)`)

    for (const [i, step] of workflow.steps.entries()) {
      console.log(`[EchoMode] Step ${i + 1}/${workflow.steps.length}: ${step.action}`)
      if (step.tool) {
        // Lazy-load toolRuntime to avoid circular deps
        try {
          const { toolRuntime } = await import('../executor/toolRuntime')
          const result = await toolRuntime.execute(step.tool, step.inputs ?? {})
          console.log(`[EchoMode]   ✅ Result: ${JSON.stringify(result).slice(0, 80)}`)
        } catch (e: any) {
          console.error(`[EchoMode]   ❌ Error: ${e.message}`)
        }
      }
    }

    // Update run metadata
    const idx = all.findIndex(w => w.id === workflow.id)
    if (idx >= 0) {
      all[idx].runCount++
      all[idx].lastRunAt = new Date().toISOString()
      saveWorkflows(all)
    }

    console.log(`[EchoMode] ✅ Workflow complete: "${workflow.name}"`)
  }

  // ── Query ─────────────────────────────────────────────────────────────

  listWorkflows(): Workflow[] {
    return loadWorkflows()
  }

  getWorkflow(name: string): Workflow | null {
    return loadWorkflows().find(w => w.name.toLowerCase() === name.toLowerCase()) ?? null
  }

  isRecording(): boolean {
    return this._recording
  }

  currentRecordingName(): string | null {
    return this._current?.name ?? null
  }
}

export const echoMode = new EchoMode()
