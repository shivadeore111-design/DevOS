// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/computerUse/visionLoop.ts
// Agentic vision-action loop: screenshot → vision LLM → action → verify → repeat.
//
// Model routing (DataGuard):
//   local  → llava:13b via Ollama REST (/api/chat with images[])
//   claude → Anthropic Messages API (ANTHROPIC_API_KEY required)
//   auto   → DataGuard decides per screenshot: sensitive → local, otherwise cloud
//
// CommandGate approval before session start + low-confidence (< 0.65) escalation.

import axios from 'axios'
import { ComputerUseAction, VisionLoopResult } from '../../types/computerUse'
import { screenAgent }  from './screenAgent'
import { apiRegistry }  from './apiRegistry'
import { commandGate }  from '../../coordination/commandGate'
import { memoryLayers } from '../../memory/memoryLayers'
import { dataGuard }    from '../../security/dataGuard'

// ── Constants ──────────────────────────────────────────────────

const OLLAMA_BASE  = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
const VISION_MODEL = process.env.DEVOS_VISION_MODEL ?? 'llava:13b'

// ── Types ──────────────────────────────────────────────────────

interface VisionLoopOptions {
  maxIterations?:   number
  timeoutMs?:       number
  requireApproval?: boolean
  /** auto = DataGuard decides per screenshot */
  visionModel?:     'local' | 'claude' | 'auto'
}

// ── Vision API helpers ────────────────────────────────────────

/**
 * Call llava (or any vision-capable Ollama model) with a base64 image.
 */
async function callOllamaVision(prompt: string, imageB64: string): Promise<string> {
  const res = await axios.post(
    `${OLLAMA_BASE}/api/chat`,
    {
      model:    VISION_MODEL,
      messages: [
        {
          role:    'user',
          content: prompt,
          images:  [imageB64],
        },
      ],
      stream:  false,
      options: { temperature: 0.2, num_predict: 512 },
    },
    { timeout: 90_000 },
  )
  return (res.data?.message?.content as string) ?? ''
}

/**
 * Call Claude via Anthropic Messages API with a base64 PNG image.
 * Requires ANTHROPIC_API_KEY env var.
 */
async function callClaudeVision(prompt: string, imageB64: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('[VisionLoop] ANTHROPIC_API_KEY not set — use visionModel: "local"')

  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model:      process.env.DEVOS_CLAUDE_VISION_MODEL ?? 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        {
          role:    'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: 'image/png', data: imageB64 },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    },
    {
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      timeout: 30_000,
    },
  )
  return (res.data?.content?.[0]?.text as string) ?? ''
}

// ── VisionLoop ────────────────────────────────────────────────

class VisionLoop {
  private aborted = false

  // ── Run ──────────────────────────────────────────────────────

  async run(goal: string, options: VisionLoopOptions = {}): Promise<VisionLoopResult> {
    const maxIterations  = options.maxIterations ?? 20
    const timeoutMs      = options.timeoutMs     ?? 120_000
    const actionsExecuted: ComputerUseAction[]   = []
    const start          = Date.now()
    this.aborted         = false

    // CommandGate approval before taking control of the computer
    if (options.requireApproval !== false) {
      const approved = await commandGate.requestApproval(
        `Computer control session: ${goal}`,
        'VisionLoop will take screenshots and control mouse/keyboard',
      )
      if (!approved) {
        return {
          success:         false,
          iterations:      0,
          actionsExecuted: [],
          failureReason:   'Rejected by user via CommandGate',
        }
      }
    }

    for (let i = 0; i < maxIterations; i++) {
      if (this.aborted) break

      if (Date.now() - start > timeoutMs) {
        return { success: false, iterations: i, actionsExecuted, failureReason: 'Timeout' }
      }

      // 1. Take screenshot
      const screenshotB64 = await screenAgent.takeScreenshot()

      // 2. DataGuard: choose vision model
      let useLocal: boolean
      if (options.visionModel === 'local') {
        useLocal = true
      } else if (options.visionModel === 'claude') {
        useLocal = false
      } else {
        // 'auto' — scan a prefix of the base64 for sensitive text (e.g. from OCR metadata)
        useLocal = await dataGuard.isSensitive(screenshotB64.slice(0, 200))
      }

      // 3. Vision LLM → next action (null = goal complete)
      const action = await this.callVisionLLM(goal, screenshotB64, useLocal, actionsExecuted)

      if (!action) {
        memoryLayers.write(`ComputerUse success: ${goal}`, ['computer_use', 'success'])
        return { success: true, iterations: i + 1, actionsExecuted }
      }

      // 4. Low-confidence escalation
      if (action.confidence < 0.65) {
        const approved = await commandGate.requestApproval(
          `Low-confidence action: ${action.type} (${Math.round(action.confidence * 100)}%)`,
          action.description ?? 'No description',
        )
        if (!approved) continue
      }

      // 5. API-first routing for api_call actions
      if (action.type === 'api_call') {
        const apiAction = action as import('../../types/computerUse').ApiCallAction
        const r = await apiRegistry.execute(apiAction.service, {
          endpoint: apiAction.endpoint,
          method:   apiAction.method,
          payload:  apiAction.payload,
          headers:  apiAction.headers,
        })
        actionsExecuted.push(action)

        if (r.usedAPI) {
          memoryLayers.write(`ComputerUse success: ${goal}`, ['computer_use', 'success'])
          return { success: true, iterations: i + 1, actionsExecuted }
        }
        continue
      }

      // 6. Mouse/keyboard execution via screenAgent
      const result = await screenAgent.execute(action)
      actionsExecuted.push(action)

      if (!result.success && action.fallback) {
        await screenAgent.execute(action.fallback)
      }

      // 7. Goal-complete check on fresh screenshot
      const newScreenshot = await screenAgent.takeScreenshot()
      const done = await this.checkGoalComplete(goal, newScreenshot, useLocal)
      if (done) {
        memoryLayers.write(`ComputerUse success: ${goal}`, ['computer_use', 'success'])
        return { success: true, iterations: i + 1, actionsExecuted }
      }
    }

    return {
      success:         false,
      iterations:      maxIterations,
      actionsExecuted,
      failureReason:   this.aborted ? 'Aborted by user' : 'Max iterations reached',
    }
  }

  // ── Vision LLM call ──────────────────────────────────────────

  private async callVisionLLM(
    goal:          string,
    screenshotB64: string,
    useLocal:      boolean,
    history:       ComputerUseAction[],
  ): Promise<ComputerUseAction | null> {
    const historyStr = history
      .slice(-5)
      .map(a => `${a.type}: ${a.description ?? ''}`)
      .join('\n')

    const prompt = `You are controlling a computer to achieve this goal: "${goal}"

Recent actions taken:
${historyStr || 'None yet'}

Look at the screenshot and decide the SINGLE next action to take.
If the goal is already complete, respond with: { "done": true }

Respond ONLY with valid JSON:
{
  "id": "action_<timestamp>",
  "type": "click|type|scroll|keypress|screenshot|api_call",
  "confidence": 0.0-1.0,
  "description": "what this action does"
}`

    try {
      const raw = useLocal
        ? await callOllamaVision(prompt, screenshotB64)
        : await callClaudeVision(prompt, screenshotB64)
      return this.parseAction(raw)
    } catch (err: any) {
      console.warn(`[VisionLoop] LLM call failed (${useLocal ? 'local' : 'claude'}): ${err?.message}`)
      return null
    }
  }

  // ── Goal-complete check ───────────────────────────────────────

  private async checkGoalComplete(
    goal:          string,
    screenshotB64: string,
    useLocal:      boolean,
  ): Promise<boolean> {
    const prompt =
      `Is this goal complete based on the screenshot? Goal: "${goal}". ` +
      `Respond ONLY with JSON: {"complete": true} or {"complete": false}`

    try {
      const raw = useLocal
        ? await callOllamaVision(prompt, screenshotB64)
        : await callClaudeVision(prompt, screenshotB64)
      const cleaned = raw.replace(/```json|```/g, '').trim()
      return JSON.parse(cleaned).complete === true
    } catch {
      return false
    }
  }

  // ── Parse LLM response → action ──────────────────────────────

  private parseAction(raw: string): ComputerUseAction | null {
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim()
      const parsed  = JSON.parse(cleaned)
      if (parsed.done) return null
      if (!parsed.id)                            parsed.id         = `action_${Date.now()}`
      if (typeof parsed.confidence !== 'number') parsed.confidence = 0.7
      return parsed as ComputerUseAction
    } catch {
      return null
    }
  }

  // ── Abort ─────────────────────────────────────────────────────

  abort(): void { this.aborted = true }
}

export const visionLoop = new VisionLoop()
