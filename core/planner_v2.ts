// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// core/planner.ts — DevOS Goal → Plan  (v2 — with RAG + Patterns)
//
// New in v2:
//   1. Retrieve semantically similar past tasks (RAG)
//   2. Retrieve matching task patterns (reuse successful plans)
//   3. Score context relevance (CRAG) — trigger web_search if weak
//   4. Inject context into planning prompt
// ============================================================

import { llmCall }             from "../llm/router";
import { RAGRetriever }        from "../memory/ragRetriever";
import { TaskPatternMemory }   from "../memory/taskPatterns";
import { scoreRelevance }      from "../llm/contextCompressor";

const BASE_SYSTEM_PROMPT = `You are DevOS, an autonomous AI operating system planner.
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
- Never include secrets or credentials in plans
- If past experience or patterns are provided, USE THEM as a template`;

export async function generatePlan(goal: string, extraContext?: string): Promise<any> {
  console.log(`[Planner] Generating plan for: "${goal}"`);

  // ── 1. Retrieve RAG context ──────────────────────────────────
  const ragCtx     = await RAGRetriever.retrieveSimilarTasks(goal);
  const patternHint = await TaskPatternMemory.getPlanningHint(goal);

  // ── 2. CRAG: only inject context if it's actually relevant ───
  let contextBlock = "";

  if (ragCtx.hasResults) {
    const score = await scoreRelevance(ragCtx.contextBlock, goal);
    if (score >= 0.4) {
      contextBlock += ragCtx.contextBlock + "\n\n";
      console.log(`[Planner] RAG context injected (relevance: ${(score * 100).toFixed(0)}%)`);
    } else {
      console.log(`[Planner] RAG context skipped (low relevance: ${(score * 100).toFixed(0)}%)`);
      // Low relevance → add web_search as first action hint
      contextBlock += "NOTE: No strong matching past experience found. Consider searching for current information.\n\n";
    }
  }

  if (patternHint) {
    contextBlock += patternHint + "\n\n";
    console.log(`[Planner] Task pattern hint injected.`);
  }

  if (extraContext) {
    contextBlock += extraContext + "\n\n";
  }

  // ── 3. Build prompt ───────────────────────────────────────────
  const fullPrompt = contextBlock
    ? `${contextBlock}\nGoal to plan: ${goal}`
    : goal;

  // ── 4. Call LLM ───────────────────────────────────────────────
  const { content, provider, tokensEstimate } = await llmCall(fullPrompt, BASE_SYSTEM_PROMPT);
  console.log(`[Planner] Plan received from ${provider} (~${tokensEstimate} tokens)`);

  try {
    const cleaned = content.replace(/```json|```/g, "").trim();
    const plan    = JSON.parse(cleaned);

    if (!plan.actions || !Array.isArray(plan.actions)) {
      throw new Error("Plan missing actions array");
    }

    return { ...plan, _meta: { provider, tokensEstimate, ragUsed: ragCtx.hasResults } };

  } catch (err: any) {
    console.error(`[Planner] Failed to parse plan: ${err.message}`);
    console.error(`[Planner] Raw response: ${content.substring(0, 500)}`);

    return {
      summary:    goal,
      complexity: "low",
      actions:    [{ type: "llm_task", description: goal, query: goal, risk: "low" }],
      _meta:      { provider, tokensEstimate, ragUsed: false },
    };
  }
}
