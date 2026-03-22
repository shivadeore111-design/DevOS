"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeTask = routeTask;
const localBrain_1 = require("./localBrain");
function extractJSON(text) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match)
        throw new Error("No JSON found");
    return JSON.parse(match[0]);
}
async function routeTask(context) {
    // HARD STOP: if we already have results, finish.
    if (context.lastResult) {
        return {
            type: "finish",
            result: context.lastResult
        };
    }
    const prompt = `
You are an autonomous AI agent.

Task:
${context.task}

Available skills:
- web.search (args: { query: string })

Rules:
- If the task requires searching, use web.search.
- After getting search results, DO NOT call any more skills.
- After one successful action, finish.

Respond ONLY with valid JSON.

If action:
{
  "type": "action",
  "skill": "web.search",
  "args": { "query": "..." }
}

If finished:
{
  "type": "finish",
  "result": "final answer"
}
`;
    const raw = await (0, localBrain_1.localLLM)(prompt);
    try {
        return extractJSON(raw);
    }
    catch {
        return {
            type: "finish",
            result: "LLM parsing failed."
        };
    }
}
