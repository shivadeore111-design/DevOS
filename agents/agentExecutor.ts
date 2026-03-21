// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// agents/agentExecutor.ts — Assigns tasks to agents and drives LLM execution

import { callOllama }                        from '../llm/ollama'
import { toolRuntime }                       from '../executor/toolRuntime'
import { agentRegistry }                     from './agentRegistry'
import { AgentRole }                         from './types'
import { Task }                              from '../goals/types'
import { liveThinking }                      from '../coordination/liveThinking'
import { getCodingModel, getPlanningModel }  from '../core/autoModelSelector'
import { missionCanvas }                     from '../coordination/missionCanvas'
import { agentDen }                          from './agentDen'
import { impactMap }                         from '../intelligence/impactMap'

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
}

export const agentExecutor = new AgentExecutor()
