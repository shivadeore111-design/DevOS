// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personal/teachMode.ts — Record user workflows and replay them

import * as fs     from 'fs'
import * as path   from 'path'
import * as crypto from 'crypto'
import { toolRuntime } from '../executor/toolRuntime'

export interface WorkflowStep {
  action: string
  tool:   string
  inputs: any
  result: any
}

export interface Workflow {
  id:         string
  name:       string
  steps:      WorkflowStep[]
  recordedAt: string
  runCount:   number
}

const FILE = path.join(process.cwd(), 'workspace/taught-workflows.json')

export class TeachMode {
  private recording   = false
  private currentWorkflow: Partial<Workflow> | null = null

  startRecording(workflowName: string): void {
    this.recording = true
    this.currentWorkflow = { name: workflowName, steps: [] }
    console.log(`[TeachMode] 🔴 Recording: ${workflowName}. Run your steps then type: devos stop`)
  }

  recordAction(action: string, tool: string, inputs: any, result: any): void {
    if (!this.recording || !this.currentWorkflow) return
    this.currentWorkflow.steps = this.currentWorkflow.steps || []
    this.currentWorkflow.steps.push({ action, tool, inputs, result })
  }

  stopRecording(): Workflow {
    this.recording = false
    const workflow: Workflow = {
      id:         crypto.randomUUID(),
      name:       this.currentWorkflow?.name || 'unnamed',
      steps:      this.currentWorkflow?.steps || [],
      recordedAt: new Date().toISOString(),
      runCount:   0,
    }
    const workflows = this.listWorkflows()
    workflows.push(workflow)
    const dir = path.dirname(FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(workflows, null, 2))
    this.currentWorkflow = null
    console.log(`[TeachMode] ✅ Saved: ${workflow.name} (${workflow.steps.length} steps)`)
    return workflow
  }

  listWorkflows(): Workflow[] {
    if (!fs.existsSync(FILE)) return []
    try { return JSON.parse(fs.readFileSync(FILE, 'utf-8')) } catch { return [] }
  }

  async runWorkflow(name: string): Promise<string> {
    const workflows = this.listWorkflows()
    const workflow  = workflows.find(w => w.name.toLowerCase() === name.toLowerCase())
    if (!workflow) return 'Workflow not found: ' + name

    const results: string[] = []
    for (const step of workflow.steps) {
      try {
        const result = await toolRuntime.execute(step.tool, step.inputs)
        results.push(`✅ ${step.action}: ${JSON.stringify(result).slice(0, 100)}`)
      } catch (e: any) {
        results.push(`❌ ${step.action}: ${e.message}`)
      }
    }
    workflow.runCount++
    fs.writeFileSync(FILE, JSON.stringify(workflows, null, 2))
    return results.join('\n')
  }

  isRecording(): boolean {
    return this.recording
  }
}

export const teachMode = new TeachMode()
