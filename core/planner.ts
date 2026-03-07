// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// planner.ts — DevOS Goal → Plan
// Converts a natural language goal into a structured action plan
// ============================================================

import { llmCall } from "../llm/router";

const SYSTEM_PROMPT = `You are DevOS, an autonomous AI operating system planner.
Your job is to convert a user's goal into a structured JSON execution plan.

Respond ONLY with valid JSON. No markdown, no explanation, no code fences.

Schema:
{
  "summary": "Short description of the plan",
  "complexity": "low | medium | high",
  "actions": [
    {
      "type": "file_write | file_append | file_read | shell_exec | web_fetch | web_search | llm_task | system_task",
      "description": "What this action does",
      "path": "optional file path",
      "content": "optional file content",
      "command": "optional shell command",
      "url": "optional URL",
      "query": "optional search query or LLM prompt",
      "risk": "low | medium | high"
    }
  ]
}

Rules:
- Keep actions atomic and sequential
- Mark destructive operations (rm, del, format) as risk: high
- Prefer file_write over shell_exec when possible
- For complex tasks, break into multiple small actions
- Never include secrets or credentials in plans`;

export async function generatePlan(goal: string): Promise<any> {
  console.log(`[Planner] Generating plan for: "${goal}"`);

  const { content, provider, tokensEstimate } = await llmCall(goal, SYSTEM_PROMPT);

  console.log(`[Planner] Plan received from ${provider} (~${tokensEstimate} tokens)`);

  try {
    // Strip any accidental markdown fences
    const cleaned = content.replace(/```json|```/g, "").trim();
    const plan    = JSON.parse(cleaned);

    if (!plan.actions || !Array.isArray(plan.actions)) {
      throw new Error("Plan missing actions array");
    }

    return { ...plan, _meta: { provider, tokensEstimate } };
  } catch (err: any) {
    console.error(`[Planner] Failed to parse plan: ${err.message}`);
    console.error(`[Planner] Raw response: ${content.substring(0, 500)}`);

    // Fallback: wrap goal as single LLM task
    return {
      summary: goal,
      complexity: "low",
      actions: [{ type: "llm_task", description: goal, query: goal, risk: "low" }],
      _meta: { provider, tokensEstimate },
    };
  }
}
