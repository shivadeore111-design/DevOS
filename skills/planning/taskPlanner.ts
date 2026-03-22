// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// skills/planning/taskPlanner.ts
// Converts a plain-English goal into an ordered execution plan.
// Integrates with memory/taskPatterns.ts to reuse known patterns.
// ============================================================

import { llmCallJSON }       from "../../llm/router";
import { TaskPatternMemory } from "../../memory/taskPatterns";
import { Skill }             from "../registry";

// ── Return types ──────────────────────────────────────────────

export interface PlanStep {
  id:                  string;
  description:         string;
  type:                "shell" | "file" | "llm" | "web" | "skill" | "manual";
  estimatedDurationMs: number;
  dependencies:        string[];   // step IDs this step waits for
  command?:            string;     // if type === "shell"
  skillName?:          string;     // if type === "skill"
}

export interface ExecutionPlan {
  goal:               string;
  complexity:         "low" | "medium" | "high";
  steps:              PlanStep[];
  estimatedTotalMs:   number;
  reusingPattern:     boolean;
  patternGoal?:       string;
  generatedAt:        string;
}

// ── Skill ─────────────────────────────────────────────────────

export class TaskPlanner implements Skill {
  readonly name        = "task_planner";
  readonly description = "Converts a plain-English goal into an ordered, dependency-aware execution plan";

  async execute(args: { goal: string }): Promise<ExecutionPlan> {
    return this.plan(args.goal);
  }

  async plan(goal: string): Promise<ExecutionPlan> {
    // Check if we have a reusable pattern. TaskPatternMemory uses static methods.
    const bestPattern = await TaskPatternMemory.findBestMatch(goal, 0.70);
    const hasPattern  = bestPattern !== null && bestPattern.similarity > 0.85;

    const patternHint = hasPattern && bestPattern
      ? `\n\nHINT — A similar task was successfully completed with these steps:\n${
          JSON.stringify(bestPattern.pattern.plan?.steps ?? [], null, 2)
        }\nAdapt those steps for the current goal.`
      : "";

    const systemPrompt = `You are DevOS task planner. Convert goals into executable step plans.
Each step must have a unique id (step_1, step_2, ...), clear description, type, duration estimate, and dependencies.
Return ONLY valid JSON — no markdown, no text.`;

    const prompt = `Create an execution plan for: "${goal}"${patternHint}

Return JSON:
{
  "complexity": "low|medium|high",
  "steps": [
    {
      "id": "step_1",
      "description": "What this step does",
      "type": "shell|file|llm|web|skill|manual",
      "estimatedDurationMs": 5000,
      "dependencies": [],
      "command": "npm install  (only if type=shell)",
      "skillName": "skill_name  (only if type=skill)"
    }
  ],
  "estimatedTotalMs": 30000
}`;

    const fallback = this.buildFallback(goal);

    const result = await llmCallJSON<{
      complexity: ExecutionPlan["complexity"];
      steps: Omit<PlanStep, never>[];
      estimatedTotalMs: number;
    }>(prompt, systemPrompt, {
      complexity:       fallback.complexity,
      steps:            fallback.steps,
      estimatedTotalMs: fallback.estimatedTotalMs,
    });

    return {
      goal,
      complexity:       result.complexity       ?? fallback.complexity,
      steps:            result.steps            ?? fallback.steps,
      estimatedTotalMs: result.estimatedTotalMs ?? fallback.estimatedTotalMs,
      reusingPattern:   hasPattern,
      patternGoal:      hasPattern && bestPattern ? bestPattern.pattern.goalTemplate : undefined,
      generatedAt:      new Date().toISOString(),
    };
  }

  private buildFallback(goal: string): ExecutionPlan {
    return {
      goal,
      complexity: "medium",
      steps: [
        { id: "step_1", description: `Analyze requirements for: ${goal}`, type: "llm",    estimatedDurationMs: 10_000, dependencies: [] },
        { id: "step_2", description: "Set up project structure",           type: "shell",  estimatedDurationMs: 5_000,  dependencies: ["step_1"] },
        { id: "step_3", description: "Implement core logic",               type: "llm",    estimatedDurationMs: 30_000, dependencies: ["step_2"] },
        { id: "step_4", description: "Write tests",                        type: "file",   estimatedDurationMs: 10_000, dependencies: ["step_3"] },
        { id: "step_5", description: "Verify and finalize",                type: "manual", estimatedDurationMs: 5_000,  dependencies: ["step_4"] },
      ],
      estimatedTotalMs: 60_000,
      reusingPattern:   false,
      generatedAt:      new Date().toISOString(),
    };
  }
}

export const taskPlanner = new TaskPlanner();
