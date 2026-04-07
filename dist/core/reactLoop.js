"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.runReActLoop = runReActLoop;
// core/reactLoop.ts — ReAct (Reasoning + Acting) agent loop.
// Iterates: Thought → Action → Observation until FINISH or maxIterations.
const agentLoop_1 = require("./agentLoop");
const toolRegistry_1 = require("./toolRegistry");
const livePulse_1 = require("../coordination/livePulse");
// ── ReAct system prompt ────────────────────────────────────────
const REACT_SYSTEM = `You are DevOS ReAct agent. You solve goals iteratively using a Thought→Action→Observation loop.

At each step, output ONLY valid JSON with this shape:
{
  "reasoning": "what you're thinking",
  "action": "tool_name or FINISH",
  "actionInput": { ...tool args },
  "finalAnswer": "only when action is FINISH — the complete answer"
}

Available tools:
- web_search    { "query": "..." }
- fetch_url     { "url": "https://..." }
- file_read     { "path": "..." }
- file_write    { "path": "...", "content": "..." }
- run_python    { "script": "..." }
- run_node      { "code": "..." }
- shell_exec    { "command": "..." }
- system_info   {}
- deep_research { "topic": "..." }
- get_stocks    { "market": "NSE", "type": "gainers" }

Rules:
1. Think step-by-step. Use observations from previous steps.
2. When you have enough information to answer, set action to FINISH and provide finalAnswer.
3. Output ONLY valid JSON — no markdown, no prose outside the JSON.
4. If a tool fails, adapt your approach in the next thought.`;
// ── Parse LLM output to Thought ────────────────────────────────
function parseThought(raw) {
    try {
        const cleaned = raw
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match)
            return null;
        const parsed = JSON.parse(match[0]);
        return {
            reasoning: String(parsed.reasoning || ''),
            action: String(parsed.action || 'FINISH'),
            actionInput: parsed.actionInput && typeof parsed.actionInput === 'object'
                ? parsed.actionInput
                : {},
            finalAnswer: parsed.finalAnswer ? String(parsed.finalAnswer) : undefined,
        };
    }
    catch {
        return null;
    }
}
// ── Build context string from prior steps ──────────────────────
function buildContext(goal, steps) {
    let ctx = `Goal: ${goal}\n\n`;
    for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        ctx += `Step ${i + 1}:\n`;
        ctx += `  Thought: ${s.thought.reasoning}\n`;
        ctx += `  Action: ${s.thought.action}(${JSON.stringify(s.thought.actionInput)})\n`;
        ctx += `  Observation: ${s.observation.success ? 'OK' : 'ERROR'} — ${s.observation.result.slice(0, 400)}\n\n`;
    }
    ctx += 'What is your next thought and action? Output JSON only.';
    return ctx;
}
// ── Main ReAct loop ────────────────────────────────────────────
async function runReActLoop(goal, apiKey, model, provider, onStep, maxIterations = 5) {
    const steps = [];
    let answer = '';
    livePulse_1.livePulse.act('ReAct', `Starting: ${goal.slice(0, 60)}`);
    for (let iter = 0; iter < maxIterations; iter++) {
        // Build prompt from system + accumulated context
        const contextPrompt = `${REACT_SYSTEM}\n\n${buildContext(goal, steps)}`;
        // Call LLM
        let raw = '';
        try {
            raw = await (0, agentLoop_1.callLLM)(contextPrompt, apiKey, model, provider);
        }
        catch (e) {
            console.warn(`[ReAct] LLM call failed at iter ${iter}: ${e.message}`);
            break;
        }
        if (!raw || raw.trim().length === 0) {
            console.warn(`[ReAct] Empty LLM response at iter ${iter}`);
            break;
        }
        // Parse thought
        const thought = parseThought(raw);
        if (!thought) {
            console.warn(`[ReAct] Could not parse thought at iter ${iter}: ${raw.slice(0, 100)}`);
            break;
        }
        livePulse_1.livePulse.act('ReAct', `Iter ${iter + 1}: ${thought.action}`);
        // FINISH — return final answer
        if (thought.action === 'FINISH') {
            answer = thought.finalAnswer || thought.reasoning || 'Done.';
            // Record a terminal step with a synthetic observation
            const terminalStep = {
                thought,
                observation: { tool: 'FINISH', result: answer, success: true },
            };
            steps.push(terminalStep);
            onStep(terminalStep);
            break;
        }
        // Execute the tool
        let toolResult = '';
        let toolSuccess = false;
        try {
            const result = await (0, toolRegistry_1.executeTool)(thought.action, thought.actionInput);
            toolResult = typeof result.output === 'string'
                ? result.output
                : JSON.stringify(result.output || result);
            toolSuccess = result.success !== false;
        }
        catch (e) {
            toolResult = `Tool error: ${e.message}`;
            toolSuccess = false;
        }
        const step = {
            thought,
            observation: {
                tool: thought.action,
                result: toolResult,
                success: toolSuccess,
            },
        };
        steps.push(step);
        onStep(step);
        console.log(`[ReAct] Iter ${iter + 1}: ${thought.action} → ${toolSuccess ? 'OK' : 'ERR'} (${toolResult.slice(0, 80)})`);
    }
    // If loop exhausted without FINISH, summarise what was gathered
    if (!answer && steps.length > 0) {
        const lastObs = steps[steps.length - 1].observation;
        answer = lastObs.success
            ? lastObs.result.slice(0, 800)
            : `Could not complete the goal after ${steps.length} steps. Last error: ${lastObs.result.slice(0, 200)}`;
    }
    if (!answer) {
        answer = 'I was unable to complete the task.';
    }
    livePulse_1.livePulse.done('ReAct', `Finished in ${steps.length} step(s)`);
    return { answer, steps };
}
