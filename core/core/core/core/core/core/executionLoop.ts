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

// ── Payload parser ────────────────────────────────────────────

function parsePayload(skill: string, command: string): any {
  // Try JSON first (for compound payloads like file_write)
  try { return JSON.parse(command) } catch {}
  // Skill-specific scalar mappings
  switch (skill) {
    case 'open_browser': return { url: command }
    case 'web_search':   return { query: command }
    case 'shell_exec':   return { command }
    case 'run_powershell': return { script: command }
    case 'file_read':    return { path: command }
    case 'file_list':    return { path: command }
    case 'system_info':  return {}
    case 'notify':       return { message: command }
    default:             return { command }
  }
}

// ── Planner ───────────────────────────────────────────────────

async function generatePlan(goal: string, goalId: string): Promise<GoalPlan> {
  livePulse.thinking('CEO', `Planning: ${goal}`)
  const lower = goal.toLowerCase()

  // ── Direct tool mapping — no LLM needed for common patterns ──

  const urlMatch = goal.match(/https?:\/\/[^\s]+/) ||
    goal.match(/([a-zA-Z0-9-]+\.(com|org|net|io|dev|co|uk))/i)
  if (urlMatch && /open|go to|browse|show|navigate|launch/.test(lower)) {
    const url = urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`
    return {
      goalId, goal, complete: false,
      steps: [{ id: 'step_0', skill: 'open_browser', description: `Open ${url}`, command: url, status: 'pending' }],
    }
  }

  if (/system info|my pc|computer specs|my ram|my cpu|disk space/i.test(lower)) {
    return {
      goalId, goal, complete: false,
      steps: [{ id: 'step_0', skill: 'system_info', description: 'Get system info', command: '', status: 'pending' }],
    }
  }

  if (/(create|write|make).+(file|txt|py|js|html|md)/i.test(lower)) {
    const nameMatch    = goal.match(/called?\s+["']?([^\s"',]+\.?\w*)["']?/i)
    const fileName     = nameMatch?.[1] || 'devos-file.txt'
    const contentMatch = goal.match(/(?:with|containing|content)[:\s]+["']?(.+?)["']?$/i)
    const content      = contentMatch?.[1] || `Created by DevOS on ${new Date().toLocaleDateString()}`
    const desktopPath  = `C:\\Users\\${process.env.USERNAME || 'shiva'}\\Desktop\\${fileName}`
    return {
      goalId, goal, complete: false,
      steps: [{
        id: 'step_0', skill: 'file_write',
        description: `Create ${fileName} on Desktop`,
        command: JSON.stringify({ path: desktopPath, content }),
        status: 'pending',
      }],
    }
  }

  if (/^(search|find|look up|search for|find me)/i.test(lower)) {
    const query = goal.replace(/^(search|find|look up|search for|find me)/i, '').trim()
    return {
      goalId, goal, complete: false,
      steps: [{ id: 'step_0', skill: 'web_search', description: `Search: ${query}`, command: query, status: 'pending' }],
    }
  }

  if (/notify|notification|alert/i.test(lower)) {
    const msg = goal.replace(/^(notify|send notification|alert|send alert)[:\s]*/i, '').trim()
    return {
      goalId, goal, complete: false,
      steps: [{ id: 'step_0', skill: 'notify', description: `Notify: ${msg}`, command: JSON.stringify({ message: msg }), status: 'pending' }],
    }
  }

  // ── LLM planning for complex tasks (tries Groq first, then Ollama) ──
  try {
    const { loadConfig } = await import('../providers/index')
    const config = loadConfig()
    const api    = config.providers.apis.find((a: any) => a.enabled && !a.rateLimited && a.provider === 'groq')
    if (api) {
      const prompt = `Plan this task on Windows: "${goal}"
Respond ONLY with JSON (no markdown):
{"steps":[{"skill":"open_browser","description":"what this does","command":"https://example.com"}]}
Skills: open_browser(command=url), file_write(command=json{path,content}), shell_exec(command=powershell), web_search(command=query), run_python(command=json{script}), system_info(command=""), notify(command=json{message})
Max 3 steps.`

      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api.key}` },
        body: JSON.stringify({
          model:      api.model || 'llama-3.3-70b-versatile',
          messages:   [{ role: 'user', content: prompt }],
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(10000),
      })
      const d      = await r.json() as any
      const raw    = d?.choices?.[0]?.message?.content || ''
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      if (parsed.steps?.length) {
        return {
          goalId, goal, complete: false,
          steps: parsed.steps.map((s: any, i: number) => ({
            id: `step_${i}`, skill: s.skill, description: s.description, command: s.command, status: 'pending' as const,
          })),
        }
      }
    }
  } catch { /* fall through to Ollama */ }

  // ── Ollama fallback ───────────────────────────────────────────
  try {
    let ollamaModel = 'mistral:7b'
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config/model-selection.json'), 'utf-8'))
      ollamaModel = cfg.reasoning || cfg.chat || ollamaModel
    } catch {}

    const res = await fetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    ollamaModel,
        stream:   false,
        messages: [{ role: 'user', content: `Plan this Windows task in JSON only (no markdown): "${goal}"\n{"steps":[{"skill":"shell_exec","description":"step","command":"command"}]}` }],
      }),
    })
    const data   = await res.json() as any
    const raw    = data?.message?.content || ''
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    if (parsed.steps?.length) {
      return {
        goalId, goal, complete: false,
        steps: parsed.steps.map((s: any, i: number) => ({
          id: `step_${i}`, skill: s.skill, description: s.description, command: s.command, status: 'pending' as const,
        })),
      }
    }
  } catch {}

  // Last resort
  return {
    goalId, goal, complete: false,
    steps: [{ id: 'step_0', skill: 'notify', description: 'Could not plan', command: JSON.stringify({ message: `Could not plan: ${goal.slice(0, 40)}` }), status: 'pending' }],
  }
}

// ── Replanner ─────────────────────────────────────────────────

async function replan(plan: GoalPlan, _lastResult: any): Promise<GoalPlan> {
  const remaining = plan.steps.filter(s => s.status === 'pending')
  // If nothing left, mark complete
  if (!remaining.length) return { ...plan, complete: true }
  // Otherwise keep going with remaining steps
  return plan
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

    // Emit thinking before we run — lets UI show "planning this step"
    livePulse.thinking('CEO', `Next: ${nextStep.description}`)
    // Emit tool event so UI knows exactly what will run
    livePulse.tool('Engineer', nextStep.skill, nextStep.command)

    const stepStart   = Date.now()
    let stepResult:   any
    let stepSuccess   = false
    let stepError:    string | undefined

    try {
      const stepPayload = parsePayload(nextStep.skill, nextStep.command)
      const execResult  = await executor.execute({
        id:          nextStep.id,
        type:        nextStep.skill as any,
        confidence:  0.9,
        description: nextStep.description,
        payload:     stepPayload,
        retries:     1,
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
          const toolOutput = typeof execResult.data === 'string'
            ? execResult.data.slice(0, 120)
            : undefined
          // Emit tool event with output so UI can show result
          livePulse.tool('Engineer', nextStep.skill, nextStep.command, toolOutput)
          livePulse.done('Engineer', `${nextStep.description}${toolOutput ? ` → ${toolOutput}` : ''}`)
        } else {
          stepSuccess = false
          stepError   = 'TruthCheck failed'
          // Log fault classification for diagnostics
          faultEngine.classify(stepError)
          nextStep.status = 'failed'
          livePulse.error('Engineer', `${nextStep.description}: TruthCheck failed`)
        }
      } else {
        nextStep.status = 'failed'
        stepError       = (execResult.error as any)?.message
        livePulse.error('Engineer', `${nextStep.description}: ${stepError}`)
      }
    } catch (err: any) {
      nextStep.status = 'failed'
      stepError       = err.message
      stepSuccess     = false
      livePulse.error('Engineer', `${nextStep.skill} threw: ${err.message}`)
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
