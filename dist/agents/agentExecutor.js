"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentExecutor = exports.AgentExecutor = void 0;
// agents/agentExecutor.ts — Assigns tasks to agents and drives LLM execution
const ollama_1 = require("../llm/ollama");
const toolRuntime_1 = require("../executor/toolRuntime");
const agentRegistry_1 = require("./agentRegistry");
const liveThinking_1 = require("../coordination/liveThinking");
/** Parse any tool calls embedded in the LLM response */
function parseToolCalls(response) {
    const calls = [];
    // Match: TOOL_CALL: <toolName> { ...json }
    const pattern = /TOOL_CALL:\s*(\w+)\s*(\{[\s\S]*?\})/g;
    let match;
    while ((match = pattern.exec(response)) !== null) {
        try {
            calls.push({ tool: match[1], input: JSON.parse(match[2]) });
        }
        catch { /* skip malformed */ }
    }
    return calls;
}
class AgentExecutor {
    async assign(role, task, goalContext, missionId) {
        const agent = agentRegistry_1.agentRegistry.get(role);
        if (!agent)
            throw new Error(`[AgentExecutor] Agent not found: ${role}`);
        // 1. Mark agent as executing
        agentRegistry_1.agentRegistry.updateStatus(role, 'executing', task.id ?? undefined);
        // 2. Build prompt
        const toolList = agent.tools.join(', ');
        const prompt = `${agent.systemPrompt}

===
GOAL CONTEXT: ${goalContext}

YOUR TASK: ${task.title}
DESCRIPTION: ${task.description}

Available tools: ${toolList}

To use a tool, respond with:
TOOL_CALL: <toolName> {"param": "value"}

Provide your response and any tool calls needed.
===`;
        let result = '';
        try {
            agentRegistry_1.agentRegistry.updateStatus(role, 'thinking', task.id ?? undefined);
            // 3. Signal thinking before Ollama call
            liveThinking_1.liveThinking.think(role, `Processing: ${task.description.slice(0, 60)}`, missionId);
            // 4. Call Ollama
            const raw = await (0, ollama_1.callOllama)(prompt);
            // 5. Execute any tool calls found in the response
            const toolCalls = parseToolCalls(raw);
            const toolResults = [];
            for (const tc of toolCalls) {
                agentRegistry_1.agentRegistry.updateStatus(role, 'executing', task.id ?? undefined);
                liveThinking_1.liveThinking.act(role, `Running ${tc.tool}`, missionId);
                const tr = await toolRuntime_1.toolRuntime.execute(tc.tool, tc.input);
                toolResults.push(`[${tc.tool}]: ${tr.success ? JSON.stringify(tr.output ?? 'ok') : `ERROR: ${tr.error}`}`);
            }
            // 6. Build final result
            const cleanResponse = raw.replace(/TOOL_CALL:\s*\w+\s*\{[\s\S]*?\}/g, '').trim();
            result = [
                cleanResponse,
                ...(toolResults.length > 0 ? [`\nTool Results:\n${toolResults.join('\n')}`] : []),
            ].join('\n').trim() || 'Task acknowledged and completed.';
            // 7. Mark idle + record success
            agentRegistry_1.agentRegistry.updateStatus(role, 'idle');
            agentRegistry_1.agentRegistry.recordCompletion(role, true);
            liveThinking_1.liveThinking.done(role, `Completed: ${task.description.slice(0, 60)}`, missionId);
            console.log(`[AgentExecutor] ✅ ${agent.name} completed: ${task.title}`);
        }
        catch (err) {
            result = `Error: ${err?.message ?? String(err)}`;
            agentRegistry_1.agentRegistry.updateStatus(role, 'error');
            agentRegistry_1.agentRegistry.recordCompletion(role, false);
            liveThinking_1.liveThinking.error(role, err?.message ?? String(err), missionId);
            console.error(`[AgentExecutor] ❌ ${agent.name} failed: ${task.title} — ${result}`);
        }
        return result;
    }
}
exports.AgentExecutor = AgentExecutor;
exports.agentExecutor = new AgentExecutor();
