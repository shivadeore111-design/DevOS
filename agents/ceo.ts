// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// agents/ceo.ts — CEO orchestration agent.
// Parses structured task notifications, decides delegation,
// tracks session cost, warns on budget approach.

import { callBgLLM }          from '../core/bgLLM'
import { auditTrail }         from '../core/auditTrail'
import { costTracker }        from '../core/costTracker'
import { conversationMemory } from '../core/conversationMemory'
import { executeTool }        from '../core/toolRegistry'

// ── Task notification XML schema ──────────────────────────────

export interface TaskNotification {
  taskId:    string
  agent:     string
  status:    'completed' | 'failed' | 'killed'
  summary:   string
  result:    string
  usage: {
    tokens:   number
    tools:    number
    duration: number
    costUSD:  number
  }
}

// ── requiresVerification ──────────────────────────────────────
// Returns true if a task needs adversarial verification before
// the result is trusted.

export function requiresVerification(task: {
  tags?:          string[]
  filesModified?: number
  goal?:          string
}): boolean {
  const tags         = task.tags ?? []
  const fileCount    = task.filesModified ?? 0
  const hasCodeTag   = tags.includes('code')   || tags.includes('deploy')
  const manyFiles    = fileCount >= 3

  return hasCodeTag || manyFiles
}

// ── Parse task notification XML ───────────────────────────────

export function parseTaskNotification(xml: string): TaskNotification | null {
  try {
    const get = (tag: string): string => {
      const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
      return m ? m[1].trim() : ''
    }

    const taskId   = get('task-id')
    const agent    = get('agent')
    const status   = get('status') as TaskNotification['status']
    const summary  = get('summary')
    const result   = get('result')
    const tokens   = parseInt(get('tokens')   || '0', 10)
    const tools    = parseInt(get('tools')    || '0', 10)
    const duration = parseInt(get('duration') || '0', 10)
    const costStr  = get('cost').replace('$', '')
    const costUSD  = parseFloat(costStr) || 0

    if (!taskId || !agent) return null

    return { taskId, agent, status, summary, result, usage: { tokens, tools, duration, costUSD } }
  } catch {
    return null
  }
}

// ── Format task notification XML ──────────────────────────────

export function formatTaskNotification(n: TaskNotification): string {
  return `<task-notification>
  <task-id>${n.taskId}</task-id>
  <agent>${n.agent}</agent>
  <status>${n.status}</status>
  <summary>${n.summary}</summary>
  <result>${n.result}</result>
  <usage>
    <tokens>${n.usage.tokens}</tokens>
    <tools>${n.usage.tools}</tools>
    <duration>${n.usage.duration}</duration>
    <cost>$${n.usage.costUSD.toFixed(4)}</cost>
  </usage>
</task-notification>`
}

// ── Fork pattern — context-aware agent delegation ─────────────

const FORK_CAPABLE_AGENTS = ['ceo']

export async function forkAgent(
  agentType:   string,
  taskPrompt:  string,
  inheritContext: boolean = false,
): Promise<{ success: boolean; output: string; error?: string }> {
  let contextBlock = ''

  if (inheritContext) {
    const memCtx = conversationMemory.buildContext()
    if (memCtx && memCtx.trim()) {
      contextBlock =
        '\n## Conversation Context\n' +
        'The user has been discussing:\n' +
        memCtx.slice(0, 1200) + '\n'
    }
  }

  const fullPrompt = contextBlock
    ? `${contextBlock}\n## Your Task\n${taskPrompt}`
    : taskPrompt

  const result = await executeTool('run_agent', {
    agent:          agentType,
    task:           fullPrompt,
    inheritContext: false,  // already injected above — don't double-inject
    _callerAgent:   'ceo',
  })

  return { success: result.success, output: result.output, error: result.error }
}

// ── CEO system prompt ─────────────────────────────────────────

function buildCEOSystem(sessionCostUSD: number, dailyBudget: number): string {
  const budgetWarn = sessionCostUSD > dailyBudget * 0.8
    ? `\n⚠️ SESSION COST WARNING: $${sessionCostUSD.toFixed(4)} used (${Math.round(sessionCostUSD / dailyBudget * 100)}% of daily $${dailyBudget} budget). Prefer direct answers.`
    : ''

  return `You are Aiden's CEO orchestrator — the strategic coordinator for DevOS.

DELEGATION RULES:
1. Answer simple questions DIRECTLY — do NOT delegate trivial work
2. When delegating: tell the user what you're launching, then STOP — never fabricate results before the task notification arrives
3. Continue existing agents via taskId to reuse their loaded context
4. Track cumulative session cost from notifications — warn user when approaching daily budget

## Delegation Quality Rules
When delegating to specialists:
- ALWAYS include WHY the user wants this, not just WHAT to do
- Include what was already tried and what failed
- Include specific file paths, variable names, and details from context
- NEVER write "based on your findings, fix it" — give the specialist the exact context they need
- For complex tasks (long description or dependencies), the specialist receives full conversation context automatically
- Specialists CANNOT spawn their own sub-agents — only CEO-level agents can delegate

TASK NOTIFICATIONS: When you receive a <task-notification> block, parse it and act accordingly:
- completed: summarize the result for the user
- failed: decide whether to retry (max 2x), re-delegate, or inform user
- killed: inform user and offer alternatives

VERIFICATION: After tasks tagged 'code' or 'deploy', or when 3+ files were modified, request verification before treating output as final.

COST TRACKING: You have spent $${sessionCostUSD.toFixed(4)} this session.${budgetWarn}

Always be direct, decisive, and transparent about what you're doing and why.`
}

// ── CEO agent class ───────────────────────────────────────────

export class CEOAgent {
  private sessionCostUSD = 0
  private taskHistory: TaskNotification[] = []

  // ── Process incoming message or notification ───────────────

  async process(input: string, traceId?: string): Promise<string> {
    // Check if this is a task notification
    if (input.includes('<task-notification>')) {
      return this.handleNotification(input, traceId)
    }

    // Regular user message — route to LLM with CEO system prompt
    return this.delegateOrAnswer(input, traceId)
  }

  // ── Handle task notification ───────────────────────────────

  private async handleNotification(xml: string, traceId?: string): Promise<string> {
    const notif = parseTaskNotification(xml)
    if (!notif) return 'Received malformed task notification.'

    // Track cost from this task
    this.sessionCostUSD += notif.usage.costUSD
    this.taskHistory.push(notif)

    // Log to audit trail
    try {
      auditTrail.record({
        action:     'system',
        tool:       `task_notification_${notif.status}`,
        input:      JSON.stringify({ taskId: notif.taskId, agent: notif.agent }),
        output:     notif.summary,
        durationMs: notif.usage.duration,
        success:    notif.status === 'completed',
        traceId:    traceId ?? notif.taskId,
      })
    } catch {}

    const budget = costTracker.getDailyBudget()
    const system = buildCEOSystem(this.sessionCostUSD, budget)

    const prompt = `${system}

Task notification received:
${xml}

Summarize the result for the user and decide what (if anything) to do next.`

    const response = await callBgLLM(prompt, traceId)
    return response || `Task ${notif.taskId} ${notif.status}: ${notif.summary}`
  }

  // ── Answer directly or delegate ────────────────────────────

  private async delegateOrAnswer(message: string, traceId?: string): Promise<string> {
    const budget = costTracker.getDailyBudget()
    const system = buildCEOSystem(this.sessionCostUSD, budget)

    const prompt = `${system}

User message: ${message}

Respond directly if this is a simple question. Otherwise explain what you would delegate and to which agent type (code, research, automation, analysis).`

    return callBgLLM(prompt, traceId)
  }

  // ── Session stats ──────────────────────────────────────────

  getSessionCost(): number {
    return this.sessionCostUSD
  }

  getTaskHistory(): TaskNotification[] {
    return this.taskHistory
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const ceoAgent = new CEOAgent()
