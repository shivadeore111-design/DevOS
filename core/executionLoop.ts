// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/executionLoop.ts — Outer goal-level execution loop.
// Plans → Executes → Replans → Reports to EvolutionAnalyzer.

import * as fs   from 'fs'
import * as path from 'path'

import { executor }         from './executor'
import { truthCheck }       from './truthCheck'
import { faultEngine }      from './faultEngine'
import { memoryLayers }     from '../memory/memoryLayers'
import { evolutionAnalyzer, ExecutionReport } from './evolutionAnalyzer'
import { livePulse }        from '../coordination/livePulse'

// ── Types ─────────────────────────────────────────────────────

export interface GoalPlan {
  goalId:   string
  goal:     string
  steps:    PlanStep[]
  complete: boolean
}

export interface PlanStep {
  id:          string
  skill:       string
  description: string
  command:     string
  status:      'pending' | 'running' | 'done' | 'failed'
  result?:     any
}

// ── LLM helper ────────────────────────────────────────────────

async function callOllama(prompt: string): Promise<string> {
  try {
    let model = 'mistral:7b'
    try {
      const cfg = JSON.parse(fs.readFileSync(
        path.join(process.cwd(), 'config/model-selection.json'), 'utf-8'
      ))
      model = cfg.reasoning || cfg.chat || model
    } catch { /* use default */ }

    const res = await fetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream:   false,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json() as any
    return data?.message?.content || ''
  } catch { return '' }
}

// ── Planner ───────────────────────────────────────────────────

async function generatePlan(goal: string, goalId: string): Promise<GoalPlan> {
  livePulse.act('CEO', `Planning: ${goal}`)

  const prompt = `You are DevOS CEO Agent running on Windows 11. Break this goal into 2-5 concrete steps.
Goal: "${goal}"

IMPORTANT: Generate REAL Windows commands that will actually work.
For opening URLs use: Start-Process "https://url.com"
For creating files use file_write tool with actual content
For running scripts use shell_exec with PowerShell commands
For notifications use the notify tool

Respond ONLY with valid JSON, no other text:
{
  "steps": [
    { "skill": "open_browser", "description": "Open URL in browser", "command": "https://example.com" },
    { "skill": "shell_exec", "description": "Check system info", "command": "Get-ComputerInfo | Select-Object CsName" }
  ]
}

Available skills: shell_exec, file_write, file_read, web_search, run_python, run_node, notify, system_info, open_browser
OS: Windows 11, Shell: PowerShell`

  const raw = await callOllama(prompt)

  try {
    const clean  = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return {
      goalId,
      goal,
      complete: false,
      steps: (parsed.steps as any[]).map((s: any, i: number) => ({
        id:          `step_${i}`,
        skill:       s.skill,
        description: s.description,
        command:     s.command,
        status:      'pending' as const,
      })),
    }
  } catch {
    // Fallback single step
    return {
      goalId, goal, complete: false,
      steps: [{
        id: 'step_0', skill: 'shell_exec',
        description: goal,
        command: `echo "Working on: ${goal}"`,
        status: 'pending',
      }],
    }
  }
}

// ── Replanner ─────────────────────────────────────────────────

async function replan(plan: GoalPlan, lastResult: any): Promise<GoalPlan> {
  const remaining = plan.steps.filter(s => s.status === 'pending')
  if (!remaining.length) return { ...plan, complete: true }

  const done = plan.steps
    .filter(s => s.status === 'done')
    .map(s => `✓ ${s.description}`)
    .join('\n')

  const prompt = `You are DevOS CEO Agent. A goal is in progress.

Goal: "${plan.goal}"
Completed: ${done || 'nothing yet'}
Last result: ${JSON.stringify(lastResult).slice(0, 300)}
Remaining planned steps: ${remaining.map(s => s.description).join(', ')}

Should we continue with remaining steps or adjust the plan?
Respond ONLY with JSON:
{
  "continue": true,
  "steps": [
    { "skill": "shell_exec", "description": "next step", "command": "command" }
  ]
}`

  try {
    const raw    = await callOllama(prompt)
    const clean  = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    if (!parsed.continue) return { ...plan, complete: true }
    const newSteps: PlanStep[] = (parsed.steps as any[]).map((s: any, i: number) => ({
      id:          `replan_${Date.now()}_${i}`,
      skill:       s.skill,
      description: s.description,
      command:     s.command,
      status:      'pending' as const,
    }))
    return {
      ...plan,
      steps: [...plan.steps.filter(s => s.status !== 'pending'), ...newSteps],
    }
  } catch {
    return plan
  }
}

// ── Main execution loop ───────────────────────────────────────

export async function runGoalLoop(goal: string): Promise<{ success: boolean; summary: string }> {
  const goalId    = `goal_${Date.now()}`
  const startTime = Date.now()

  const report: ExecutionReport = {
    goalId, goal, success: false, totalDuration: 0,
    steps: [], timestamp: startTime,
  }

  livePulse.act('CEO', `Starting goal: ${goal}`)

  let plan          = await generatePlan(goal, goalId)
  let iterations    = 0
  const MAX_ITER    = 10

  while (!plan.complete && iterations < MAX_ITER) {
    iterations++

    const nextStep = plan.steps.find(s => s.status === 'pending')
    if (!nextStep) { plan.complete = true; break }

    nextStep.status = 'running'
    livePulse.act('Engineer', `${nextStep.skill}: ${nextStep.description}`)

    const stepStart   = Date.now()
    let stepResult:   any
    let stepSuccess   = false
    let stepError:    string | undefined

    try {
      // Execute through executor — unknown skill types will throw,
      // caught below and treated as failure
      const execResult = await executor.execute({
        id:          nextStep.id,
        type:        nextStep.skill as any,
        confidence:  0.9,
        description: nextStep.description,
        payload:     { command: nextStep.command },
        retries:     2,
        timeoutMs:   30000,
      } as any)

      stepResult  = execResult
      stepSuccess = execResult.status === 'success' || execResult.status === 'retried'

      if (stepSuccess) {
        // Verify with TruthCheck (uses actual signature)
        const verified = await truthCheck.verifyAction(
          nextStep.skill,
          { expected: nextStep.description, actual: execResult },
        )

        if (verified) {
          nextStep.status = 'done'
          nextStep.result = execResult
          livePulse.done('Engineer', `✓ ${nextStep.description}`)
        } else {
          stepSuccess = false
          stepError   = 'TruthCheck failed'
          // Log fault classification for diagnostics
          faultEngine.classify(stepError)
          nextStep.status = 'failed'
          livePulse.error('Engineer', `✗ ${nextStep.description}: TruthCheck failed`)
        }
      } else {
        nextStep.status = 'failed'
        stepError       = (execResult.error as any)?.message
        livePulse.error('Engineer', `✗ ${nextStep.description}: ${stepError}`)
      }
    } catch (err: any) {
      nextStep.status = 'failed'
      stepError       = err.message
      stepSuccess     = false
      livePulse.error('Engineer', `✗ ${nextStep.skill} threw: ${err.message}`)
    }

    // Record step in evolution report
    report.steps.push({
      skill:    nextStep.skill,
      success:  stepSuccess,
      duration: Date.now() - stepStart,
      error:    stepError,
    })

    // Store result in memory (sync — await is a no-op on void)
    memoryLayers.write(
      `Goal ${goalId} step ${nextStep.id}: ${nextStep.description} → ${stepSuccess ? 'success' : 'failed'}`,
      ['goal', 'execution', nextStep.skill],
    )

    // Replan after each successful step
    if (stepSuccess) {
      plan = await replan(plan, stepResult)
    }

    // Stop if too many failures
    const failures = plan.steps.filter(s => s.status === 'failed').length
    if (failures >= 3) {
      livePulse.error('CEO', 'Too many failures — stopping goal')
      break
    }
  }

  // Finalise report
  const successSteps = report.steps.filter(s => s.success).length
  report.success      = successSteps > 0 && successSteps >= report.steps.length * 0.6
  report.totalDuration = Date.now() - startTime

  // Send to evolution analyzer
  evolutionAnalyzer.collect(report)

  const summary = report.success
    ? `Goal complete in ${Math.round(report.totalDuration / 1000)}s — ${successSteps}/${report.steps.length} steps succeeded`
    : `Goal incomplete — ${successSteps}/${report.steps.length} steps succeeded`

  livePulse.done('CEO', summary)
  memoryLayers.write(`Goal complete: ${goal} → ${summary}`, ['goal', 'complete'])

  return { success: report.success, summary }
}
