// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// agents/agentExecutor.ts — Assigns tasks to agents and drives LLM execution

import { callOllama }                        from '../llm/ollama'
import { toolRuntime }                       from '../executor/toolRuntime'
import { agentRegistry }                     from './agentRegistry'
import { AgentRole, AgentResult }            from './types'
import { Task }                              from '../goals/types'
import { liveThinking }                      from '../coordination/liveThinking'
import { getCodingModel, getPlanningModel }  from '../core/autoModelSelector'
import { missionCanvas }                     from '../coordination/missionCanvas'
import { agentDen }                          from './agentDen'
import { impactMap }                         from '../intelligence/impactMap'
import { pluginBus }                         from '../integrations/pluginBus'
import { coreBoot }                          from '../core/coreBoot'
import { memoryLayers }                      from '../memory/memoryLayers'
import { contextLens }                       from '../core/contextLens'
import crypto                                from 'crypto'

interface ToolCall {
  tool:  string
  input: Record<string, any>
}

/** Parse any tool calls embedded in the LLM response */
function parseToolCalls(response: string): ToolCall[] {
  const calls: ToolCall[] = []
  // Match: TOOL_CALL: <toolName> { ...json }
  const pattern = /TOOL_CALL:\s*(\w+)\s*(\{[\s\S]*?\})/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(response)) !== null) {
    try {
      calls.push({ tool: match[1], input: JSON.parse(match[2]) })
    } catch { /* skip malformed */ }
  }
  return calls
}

export class AgentExecutor {

  async assign(
    role: AgentRole,
    task: Pick<Task, 'id' | 'title' | 'description'>,
    goalContext: string,
    missionId?: string,
  ): Promise<string> {
    const agent = agentRegistry.get(role)
    if (!agent) throw new Error(`[AgentExecutor] Agent not found: ${role}`)

    // 1. Mark agent as executing
    agentRegistry.updateStatus(role, 'executing', task.id ?? undefined)

    // 2. Build prompt
    const toolList = agent.tools.join(', ')
    const prompt   = `${agent.systemPrompt}

===
GOAL CONTEXT: ${goalContext}

YOUR TASK: ${task.title}
DESCRIPTION: ${task.description}

Available tools: ${toolList}

To use a tool, respond with:
TOOL_CALL: <toolName> {"param": "value"}

Provide your response and any tool calls needed.
===`

    let result = ''

    try {
      agentRegistry.updateStatus(role, 'thinking', task.id ?? undefined)

      // 3. Signal thinking before Ollama call
      liveThinking.think(role, `Processing: ${task.description.slice(0, 60)}`, missionId)

      // 3a. Inject MissionCanvas context into the prompt (if mission is set)
      let fullPrompt = prompt
      if (missionId) {
        const canvasCtx = missionCanvas.getFullContext(missionId)
        if (canvasCtx) {
          fullPrompt = `${canvasCtx}\n\n${prompt}`
        }
      }

      // 4. Call Ollama — coding agents use coding model, all others use planning model
      const CODING_ROLES = ['software-engineer', 'frontend-developer', 'backend-developer', 'mobile-developer', 'blockchain-developer']
      const model = CODING_ROLES.includes(role) ? getCodingModel() : getPlanningModel()
      const raw = await callOllama(fullPrompt, undefined, model)

      // 5. Execute any tool calls found in the response
      const toolCalls = parseToolCalls(raw)
      const toolResults: string[] = []

      for (const tc of toolCalls) {
        agentRegistry.updateStatus(role, 'executing', task.id ?? undefined)
        liveThinking.act(role, `Running ${tc.tool}`, missionId)

        // ImpactMap: analyse blast radius before writing to existing files
        if (tc.tool === 'file_write' && tc.input?.path) {
          try {
            const report = impactMap.analyze(tc.input.path as string)
            toolResults.push(`[ImpactMap] ${report.warning}`)
            if (report.riskLevel === 'high') {
              console.warn(`[AgentExecutor] ⚠️  HIGH IMPACT edit by ${role}: ${report.warning}`)
            }
          } catch { /* non-fatal */ }
        }

        // plugin_call: route to PluginBus instead of toolRuntime
        if (tc.tool === 'plugin_call') {
          try {
            const pluginResult = await pluginBus.callTool(
              tc.input?.plugin  as string,
              tc.input?.toolName as string,
              tc.input?.inputs  ?? {},
            )
            toolResults.push(`[plugin_call:${tc.input?.plugin}/${tc.input?.toolName}]: ${JSON.stringify(pluginResult ?? 'ok')}`)
          } catch (pErr: any) {
            toolResults.push(`[plugin_call]: ERROR: ${pErr?.message ?? String(pErr)}`)
          }
          continue
        }

        const tr = await toolRuntime.execute(tc.tool, tc.input)
        toolResults.push(`[${tc.tool}]: ${tr.success ? JSON.stringify(tr.output ?? 'ok') : `ERROR: ${tr.error}`}`)

        // AgentDen: stage Engineer code output
        if (tc.tool === 'file_write' && tc.input?.path && tc.input?.content) {
          const ENGINEER_ROLES = ['software-engineer', 'frontend-developer', 'backend-developer', 'mobile-developer', 'blockchain-developer']
          if (ENGINEER_ROLES.includes(role)) {
            try {
              const filename = require('path').basename(tc.input.path as string)
              agentDen.stageCode(role, filename, tc.input.content as string)
            } catch { /* non-fatal */ }
          }
        }

        // AgentDen: save Research findings
        if (tc.tool === 'file_write' && role === 'researcher') {
          try {
            agentDen.writeFinding(task.title, tc.input?.content as string ?? '')
          } catch { /* non-fatal */ }
        }
      }

      // 6. Build final result
      const cleanResponse = raw.replace(/TOOL_CALL:\s*\w+\s*\{[\s\S]*?\}/g, '').trim()
      result = [
        cleanResponse,
        ...(toolResults.length > 0 ? [`\nTool Results:\n${toolResults.join('\n')}`] : []),
      ].join('\n').trim() || 'Task acknowledged and completed.'

      // 7. Mark idle + record success
      agentRegistry.updateStatus(role, 'idle')
      agentRegistry.recordCompletion(role, true)
      liveThinking.done(role, `Completed: ${task.description.slice(0, 60)}`, missionId)
      console.log(`[AgentExecutor] ✅ ${agent.name} completed: ${task.title}`)

      // 8. AgentDen: log task completion
      try {
        agentDen.writeLog(role, `✅ DONE  [${task.id ?? 'no-id'}] ${task.title}`)
      } catch { /* non-fatal */ }

      // 9. MissionCanvas: write result entry
      if (missionId) {
        try {
          missionCanvas.write(missionId, {
            author:  role,
            type:    'result',
            content: result.slice(0, 500),
            tags:    [task.id ?? 'no-id'],
          })
        } catch { /* non-fatal */ }
      }

    } catch (err: any) {
      result = `Error: ${err?.message ?? String(err)}`
      agentRegistry.updateStatus(role, 'error')
      agentRegistry.recordCompletion(role, false)
      liveThinking.error(role, err?.message ?? String(err), missionId)
      console.error(`[AgentExecutor] ❌ ${agent.name} failed: ${task.title} — ${result}`)

      // AgentDen: log failure
      try {
        agentDen.writeLog(role, `❌ FAIL  [${task.id ?? 'no-id'}] ${task.title} — ${result.slice(0, 200)}`)
      } catch { /* non-fatal */ }
    }

    return result
  }

  // ── execute() — Sprint 14 canonical entry point ───────────────
  //
  // Differs from assign() in three ways:
  //   1. Always prepends coreBoot.getSystemPrompt() as the system context
  //   2. Builds rich user-context from memoryLayers + missionCanvas + agentDen
  //   3. Returns a structured AgentResult (not a raw string)
  //   4. Applies role-specific model routing (coder roles → coding model)
  //   5. Compresses the final output via contextLens

  async execute(
    role:      AgentRole,
    task:      string,
    missionId: string,
  ): Promise<AgentResult> {
    const agent  = agentRegistry.get(role)
    const taskId = `task_${crypto.randomBytes(4).toString('hex')}`

    // ── 1. Build context ──────────────────────────────────────
    const system      = coreBoot.getSystemPrompt()
    const memCtx      = await memoryLayers.getContextForPrompt(500)
    const canvasCtx   = missionCanvas.getFullContext(missionId) ?? ''
    const agentMemory = agentDen.readMemory(role)

    const userContext = [
      memCtx      ? `[Memory Context]\n${memCtx}`       : '',
      canvasCtx   ? `[Mission Canvas]\n${canvasCtx}`    : '',
      agentMemory ? `[Agent Memory]\n${agentMemory}`    : '',
      `[Role]\n${role}`,
      `[Task]\n${task}`,
    ].filter(Boolean).join('\n\n')

    // ── 2. Select model ───────────────────────────────────────
    const CODING_ROLES = new Set<string>([
      'software-engineer', 'frontend-developer', 'backend-developer',
      'mobile-developer', 'blockchain-developer', 'qa-engineer', 'devops-engineer',
      // Sprint-14 simplified roles
      'Engineer', 'QA', 'Deployment',
    ])
    const model = CODING_ROLES.has(role) ? getCodingModel() : getPlanningModel()

    // ── 3. Call LLM — one prompt, one response ────────────────
    const agentSystemPrompt = agent
      ? `${system}\n\n${agent.systemPrompt}`
      : system

    agentRegistry.updateStatus(role, 'thinking', taskId)
    liveThinking.think(role, `Executing: ${task.slice(0, 60)}`, missionId)

    let rawOutput = ''
    let success   = true
    let errorMsg  = ''

    try {
      rawOutput = await callOllama(userContext, agentSystemPrompt, model)
    } catch (err: any) {
      success  = false
      errorMsg = err?.message ?? String(err)
      rawOutput = `Error: ${errorMsg}`
    }

    // ── 4. Compress result via contextLens ────────────────────
    const compressed = contextLens.compress(
      { success, output: rawOutput, error: errorMsg || undefined },
      'llm_response',
    )

    // ── 5. Write result to MissionCanvas ──────────────────────
    try {
      missionCanvas.write(missionId, {
        author:  role,
        type:    'result',
        content: compressed.slice(0, 800),
        tags:    [taskId],
      })
    } catch { /* non-fatal */ }

    // ── 6. TruthCheck — extract reasoning and nextAction hints ─
    const reasoningMatch  = rawOutput.match(/(?:reasoning|rationale|because)[:\s]+(.{20,200})/i)
    const nextActionMatch = rawOutput.match(/(?:next[:\s]+|then[:\s]+|follow[- ]up[:\s]+)(.{10,120})/i)

    const reasoning  = reasoningMatch?.[1]?.trim()  ?? (success ? 'Task completed.' : errorMsg)
    const nextAction = nextActionMatch?.[1]?.trim()

    // Update registry
    agentRegistry.updateStatus(role, success ? 'idle' : 'error')
    agentRegistry.recordCompletion(role, success)
    liveThinking.done(role, `Done: ${task.slice(0, 60)}`, missionId)

    // Log to AgentDen
    try {
      agentDen.writeLog(role, `${success ? '✅' : '❌'} [${taskId}] ${task.slice(0, 80)}`)
    } catch { /* non-fatal */ }

    return {
      agentId:    agent?.id ?? role,
      taskId,
      output:     compressed,
      success,
      reasoning,
      nextAction,
    }
  }
}

export const agentExecutor = new AgentExecutor()
