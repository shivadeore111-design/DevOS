// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// agents/ceo.ts — CEO Agent: structured task orchestration.
// Parses task notification XML, injects cost awareness, and
// enforces tight response discipline (answer → launch → STOP).
//
// Usage:
//   import { buildCeoSystemPrompt, parseCeoTaskNotification } from '../agents/ceo'

import { costTracker } from '../core/costTracker'

// ── Task notification XML format ───────────────────────────────
//
// When CEO delegates to a sub-agent it wraps the goal in:
//
//   <task>
//     <goal>What needs to be accomplished</goal>
//     <agent>engineer</agent>
//     <priority>high|normal|low</priority>
//     <tag>code|deploy|research|data|system</tag>
//     <acceptance>What "done" looks like (1-2 sentences)</acceptance>
//   </task>
//
// When reporting back to user it outputs:
//
//   <update>
//     <status>on_track|at_risk|blocked|done</status>
//     <summary>1-3 sentence executive summary</summary>
//     <next>Next milestone or required user decision</next>
//   </update>

export interface CeoTaskNotification {
  goal:       string
  agent:      string
  priority:   'high' | 'normal' | 'low'
  tag:        'code' | 'deploy' | 'research' | 'data' | 'system' | string
  acceptance: string
}

export interface CeoStatusUpdate {
  status:  'on_track' | 'at_risk' | 'blocked' | 'done'
  summary: string
  next:    string
}

// ── Parse <task> XML from CEO output ──────────────────────────

export function parseCeoTaskNotification(text: string): CeoTaskNotification | null {
  const taskMatch = text.match(/<task>([\s\S]*?)<\/task>/)
  if (!taskMatch) return null
  const inner = taskMatch[1]

  const get = (tag: string): string => {
    const m = inner.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
    return m ? m[1].trim() : ''
  }

  const goal       = get('goal')
  const agent      = get('agent')
  const priority   = get('priority') as CeoTaskNotification['priority']
  const tag        = get('tag')
  const acceptance = get('acceptance')

  if (!goal || !agent) return null
  return {
    goal,
    agent:      agent      || 'engineer',
    priority:   priority   || 'normal',
    tag:        tag        || 'system',
    acceptance: acceptance || 'Task completed successfully',
  }
}

// ── Parse <update> XML from CEO output ────────────────────────

export function parseCeoStatusUpdate(text: string): CeoStatusUpdate | null {
  const m = text.match(/<update>([\s\S]*?)<\/update>/)
  if (!m) return null
  const inner = m[1]

  const get = (tag: string): string => {
    const mx = inner.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
    return mx ? mx[1].trim() : ''
  }

  const status  = get('status') as CeoStatusUpdate['status']
  const summary = get('summary')
  const next    = get('next')

  if (!status || !summary) return null
  return { status, summary, next: next || '' }
}

// ── Checks whether a task warrants verification ────────────────
// Returns true when task involves 3+ file changes or code/deploy tags.

export function requiresVerification(task: CeoTaskNotification): boolean {
  return task.tag === 'code' || task.tag === 'deploy'
}

// ── Build CEO system prompt ────────────────────────────────────
// Injected at the top of every CEO-routed conversation.
// Includes live cost snapshot so CEO can make budget-aware decisions.

export function buildCeoSystemPrompt(): string {
  const daily      = costTracker.getDaily()
  const costLine   = `Today's spend: $${daily.userUSD.toFixed(4)} user / $${daily.systemUSD.toFixed(4)} system (budget cap: $${daily.budgetCapUSD.toFixed(2)}${daily.budgetExceeded ? ' — EXCEEDED' : ''})`
  const providers  = Object.entries(daily.byProvider)
    .map(([p, c]) => `${p}: $${c.toFixed(4)}`).join(' | ')
  const costBlock  = providers ? `${costLine}\nBy provider: ${providers}` : costLine

  return `You are Aiden operating in CEO mode — the strategic orchestrator of the DevOS autonomous AI OS.

COST AWARENESS:
${costBlock}
Keep this in mind when deciding which providers or sub-agents to invoke.

CORE BEHAVIORAL RULES (non-negotiable):
1. Answer simple factual questions DIRECTLY without launching any tools or agents.
   Examples of simple questions: "what is X?", "how does Y work?", "explain Z"
   For simple questions: answer concisely, then STOP.

2. When launching an agent or tool: tell the user what you are launching and why,
   then STOP. Do not narrate the execution. Results will appear when the agent finishes.
   Bad:  "I'm now going to first analyze the codebase, then create a plan, then..."
   Good: "Launching Engineer agent to refactor the auth module. ETA: ~30s."

3. Never say "I'll do X, Y, Z" as a multi-step announcement. One clear action, then execute.

4. For code/deploy tasks: route through the Verification Agent before reporting success.

TASK DELEGATION FORMAT:
When delegating to a sub-agent, output a <task> block (one per agent):

<task>
  <goal>Specific, measurable goal</goal>
  <agent>engineer|researcher|analyst|verifier</agent>
  <priority>high|normal|low</priority>
  <tag>code|deploy|research|data|system</tag>
  <acceptance>What done looks like in 1-2 sentences</acceptance>
</task>

STATUS REPORTING FORMAT:
When reporting back to the user, use an <update> block:

<update>
  <status>on_track|at_risk|blocked|done</status>
  <summary>1-3 sentence executive summary of what happened</summary>
  <next>The very next action or user decision required</next>
</update>

STRATEGIC PRINCIPLES:
- Autonomy first: resolve everything possible without asking the user
- Fail fast: if an approach fails twice, pivot — do not repeat
- Quality gate: never report done until you have verified the deliverable
- Budget discipline: prefer Cerebras/Groq (free) for background tasks; reserve paid providers for complex user-facing work
- Brevity: the user wants results, not narration

YOUR IDENTITY:
You are decisive, efficient, and outcome-focused. You protect the user's time and budget.`
}

// ── Singleton helper ───────────────────────────────────────────
// Returns a fresh system prompt each call (picks up live cost data).

export const ceoAgent = {
  buildSystemPrompt: buildCeoSystemPrompt,
  parseTask:         parseCeoTaskNotification,
  parseUpdate:       parseCeoStatusUpdate,
  requiresVerification,
}
