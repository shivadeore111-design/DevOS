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

      // 4. Call Ollama — engineer uses coding model, all others use planning model
      const model = (role === 'engineer') ? getCodingModel() : getPlanningModel()
      const raw = await callOllama(prompt, undefined, model)

      // 5. Execute any tool calls found in the response
      const toolCalls = parseToolCalls(raw)
      const toolResults: string[] = []

      for (const tc of toolCalls) {
        agentRegistry.updateStatus(role, 'executing', task.id ?? undefined)
        liveThinking.act(role, `Running ${tc.tool}`, missionId)
        const tr = await toolRuntime.execute(tc.tool, tc.input)
        toolResults.push(`[${tc.tool}]: ${tr.success ? JSON.stringify(tr.output ?? 'ok') : `ERROR: ${tr.error}`}`)
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

    } catch (err: any) {
      result = `Error: ${err?.message ?? String(err)}`
      agentRegistry.updateStatus(role, 'error')
      agentRegistry.recordCompletion(role, false)
      liveThinking.error(role, err?.message ?? String(err), missionId)
      console.error(`[AgentExecutor] ❌ ${agent.name} failed: ${task.title} — ${result}`)
    }

    return result
  }
}

export const agentExecutor = new AgentExecutor()
