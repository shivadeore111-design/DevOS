// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/smartRetry.ts — LLM-powered failure analysis and retry strategy

import { callOllama }      from '../llm/ollama'
import { getChatModel }    from './autoModelSelector'
import * as os             from 'os'
import * as path           from 'path'

export interface RetryContext {
  taskTitle:       string
  taskDescription: string
  goalTitle:       string
  previousError:   string
  previousAction:  string
  attemptNumber:   number
}

export interface SmartRetryResult {
  newAction:  string
  newCommand: string
  reasoning:  string
}

const DESKTOP = path.join(os.homedir(), 'Desktop')
const IS_WIN  = process.platform === 'win32'

// ── Failure cache — prevent repeating known-failing patterns ─────────────

const failureCache = new Map<string, string[]>()

export function recordFailure(taskKey: string, errorPattern: string): void {
  const existing = failureCache.get(taskKey) || []
  existing.push(errorPattern)
  failureCache.set(taskKey, existing)
}

export function getKnownFailures(taskKey: string): string[] {
  return failureCache.get(taskKey) || []
}

// ── Core: analyse the failure and suggest a different approach ────────────

export async function analyzeFailureAndRetry(ctx: RetryContext): Promise<SmartRetryResult> {
  const knownFailures = getKnownFailures(ctx.taskTitle)
  const knownFailuresNote = knownFailures.length > 0
    ? `\nKNOWN FAILING PATTERNS (do NOT repeat these):\n${knownFailures.map(f => `- ${f}`).join('\n')}`
    : ''

  const prompt = `You are DevOS, an autonomous AI OS running on ${IS_WIN ? 'Windows' : process.platform}.

A task just failed. Analyze the error and suggest a DIFFERENT approach.

TASK: ${ctx.taskTitle}
DESCRIPTION: ${ctx.taskDescription}
GOAL: ${ctx.goalTitle}
ATTEMPT: ${ctx.attemptNumber} of 3

WHAT WAS TRIED:
${ctx.previousAction}

ERROR RECEIVED:
${ctx.previousError}
${knownFailuresNote}

SYSTEM CONTEXT:
- Platform: ${IS_WIN ? 'Windows' : process.platform}
- Desktop: ${DESKTOP}
- Home: ${os.homedir()}
${IS_WIN ? `- Use Windows commands: echo, mkdir, copy, del, dir, type
- NEVER use: touch, ls, cat, cp, rm, mkdir -p
- Full paths only: C:\\Users\\shiva\\Desktop\\file.txt` : ''}

Common fixes:
- If "cd" failed → use full absolute path instead
- If "touch" failed → use "echo. > file.txt" on Windows
- If "mkdir -p" failed → use "mkdir" on Windows
- If file_write failed → try shell_exec with echo command
- If permission denied → try different location
- If path not found → use exact absolute path

Respond with ONLY a JSON object:
{
  "reasoning": "what went wrong and why",
  "newAction": "shell_exec or file_write",
  "newCommand": "the exact command or content to use this time"
}`

  try {
    const raw     = await callOllama(prompt, undefined, getChatModel())
    const cleaned = raw.replace(/```json|```/g, '').trim()
    // Extract the JSON object in case the model adds extra text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON object in response')
    const result: SmartRetryResult = JSON.parse(jsonMatch[0])
    console.log(`[SmartRetry] Analysis: ${result.reasoning}`)
    console.log(`[SmartRetry] New approach: ${result.newAction} — ${result.newCommand?.slice(0, 80)}`)
    // Record this error pattern so we don't repeat it
    recordFailure(ctx.taskTitle, ctx.previousError.slice(0, 120))
    return result
  } catch {
    // Fallback — try shell_exec with direct command
    const fallbackCommand = IS_WIN
      ? `echo ${ctx.taskDescription.slice(0, 50)} > "${DESKTOP}\\output.txt"`
      : `echo "${ctx.taskDescription.slice(0, 50)}" > ~/Desktop/output.txt`
    return {
      reasoning:  'Could not analyze error — using fallback approach',
      newAction:  'shell_exec',
      newCommand: fallbackCommand,
    }
  }
}
