// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/failureAnalyzer.ts — N+32 Deep GEPA failure trace analysis.
//
// Detects when a task failed (via keyword signal, consecutive tool errors,
// budget exhaustion, or /failed command), calls an LLM to identify the root
// cause, appends a lesson to workspace/LESSONS.md, and degrades the skill's
// confidence score so future lookups are aware of the failure history.
//
// callLLM is imported DYNAMICALLY to avoid a circular dependency:
//   server.ts → failureAnalyzer → agentLoop → server.ts  (would deadlock)

import fs   from 'fs'
import path from 'path'
import { appendLesson } from './lessonsBrowser'

// ── Types ─────────────────────────────────────────────────────

export interface FailureTrace {
  userMessage: string       // message that preceded the failure signal
  aiReply:     string       // AI's response to that message
  toolsUsed:   string[]     // tools called during the exchange
  errors:      string[]     // error strings from failed tool steps
  signal:      'keyword' | 'tool_errors' | 'budget' | 'manual'
  sessionId:   string
}

interface AnalysisResult {
  rootCause:   string
  pattern:     string
  lesson:      string
  failedSkill: string | null
}

// ── Failure keyword detection ─────────────────────────────────

export const FAILURE_KEYWORDS: string[] = [
  "that's wrong", "thats wrong",
  "no that's not", "no thats not",
  "wrong answer",
  "didn't work", "didnt work",
  "failed",
  "incorrect",
  "you got it wrong",
  "not what i asked",
  "that was wrong",
  "that's not right", "thats not right",
  "not right",
  "that's incorrect",
  "you're wrong", "youre wrong",
  "wrong result",
]

export function detectFailureSignal(message: string): boolean {
  const lower = message.toLowerCase()
  return FAILURE_KEYWORDS.some(kw => lower.includes(kw))
}

// ── Main analyzer ─────────────────────────────────────────────

export async function analyzeFailureTrace(trace: FailureTrace): Promise<void> {
  // Dynamic import — prevents circular dep agentLoop ↔ server
  let callLLM: Function
  try {
    const mod = await import('./agentLoop')
    callLLM   = mod.callLLM
  } catch {
    console.warn('[failureAnalyzer] could not import callLLM — writing minimal lesson')
    _writeMinimalLesson(trace)
    return
  }

  const transcript = [
    `User request: ${trace.userMessage}`,
    `AI response (truncated): ${trace.aiReply.slice(0, 600)}`,
    `Tools used: ${trace.toolsUsed.join(', ') || 'none'}`,
    `Errors: ${trace.errors.join('; ') || 'none'}`,
    `Failure signal: ${trace.signal}`,
  ].join('\n')

  const prompt = `You are a failure analyzer for an AI assistant. Analyze why the following task produced a bad result.

${transcript}

Respond with ONLY valid JSON and nothing else:
{
  "rootCause": "1-sentence technical root cause",
  "pattern": "one of: wrong_tool | hallucination | scope_creep | api_error | missing_context | bad_plan | timeout | unknown",
  "lesson": "1-2 sentence actionable rule for the AI — start with When / Always / Never / If",
  "failedSkill": "skill folder name if a learned/approved/installed skill was the culprit, or null"
}`

  let analysis: AnalysisResult | null = null

  try {
    // callLLM signature: (prompt, apiKey?, model?, provider?) — pass nulls to use defaults
    const raw  = await callLLM(prompt, null, null, null)
    const text = typeof raw === 'string' ? raw : (raw?.content ?? '')
    const json = text.match(/\{[\s\S]*\}/)
    if (json) analysis = JSON.parse(json[0])
  } catch (e) {
    console.warn('[failureAnalyzer] LLM analysis failed:', (e as Error).message)
  }

  if (!analysis) {
    _writeMinimalLesson(trace)
    return
  }

  // Write lesson to LESSONS.md
  const lessonText = `[${analysis.pattern}] ${analysis.lesson} (rootCause: ${analysis.rootCause})`
  appendLesson(lessonText)
  console.log(`[failureAnalyzer] lesson appended: ${lessonText.slice(0, 80)}…`)

  // Degrade skill confidence if a skill was identified
  if (analysis.failedSkill) {
    _degradeSkill(analysis.failedSkill, analysis.rootCause)
  }
}

// ── Helpers ───────────────────────────────────────────────────

function _writeMinimalLesson(trace: FailureTrace): void {
  const text = `[unknown] When the user signals failure (${trace.signal}), review tool outputs carefully before responding. Tools used: ${trace.toolsUsed.join(', ') || 'none'}.`
  appendLesson(text)
  console.log('[failureAnalyzer] minimal lesson written (no LLM analysis)')
}

function _degradeSkill(skillName: string, rootCause: string): void {
  const cwd     = process.cwd()
  const folders = ['learned', 'approved', 'installed']

  for (const folder of folders) {
    const metaPath = path.join(cwd, 'workspace', 'skills', folder, skillName, 'meta.json')
    if (!fs.existsSync(metaPath)) continue

    try {
      const meta: Record<string, any> = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))

      meta.failCount         = (meta.failCount         ?? 0) + 1
      meta.lastFailureReason = rootCause
      meta.confidence        = Math.max(0.1, (meta.confidence ?? 1.0) - 0.15)

      // Auto-deprecate after 3 consecutive failures
      if (meta.failCount >= 3) {
        meta.deprecated = true
        console.warn(`[failureAnalyzer] skill "${skillName}" auto-deprecated after ${meta.failCount} failures`)
      }

      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf-8')
      console.log(`[failureAnalyzer] degraded skill "${skillName}" → confidence ${meta.confidence.toFixed(2)}, failCount ${meta.failCount}`)
    } catch (e) {
      console.warn(`[failureAnalyzer] could not update meta for "${skillName}":`, (e as Error).message)
    }
    break  // only update the first match
  }
}
