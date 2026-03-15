"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskPlanner = exports.TaskPlanner = void 0;
// ============================================================
// skills/planning/taskPlanner.ts
// Converts a plain-English goal into an ordered execution plan.
// Integrates with memory/taskPatterns.ts to reuse known patterns.
// ============================================================
const router_1 = require("../../llm/router");
const taskPatterns_1 = require("../../memory/taskPatterns");
// ── Skill ─────────────────────────────────────────────────────
class TaskPlanner {
    constructor() {
        this.name = "task_planner";
        this.description = "Converts a plain-English goal into an ordered, dependency-aware execution plan";
    }
    async execute(args) {
        return this.plan(args.goal);
    }
    async plan(goal) {
        // Check if we have a reusable pattern. TaskPatternMemory uses static methods.
        const bestPattern = await taskPatterns_1.TaskPatternMemory.findBestMatch(goal, 0.70);
        const hasPattern = bestPattern !== null && bestPattern.similarity > 0.85;
        const patternHint = hasPattern && bestPattern
            ? `\n\nHINT — A similar task was successfully completed with these steps:\n${JSON.stringify(bestPattern.pattern.plan?.steps ?? [], null, 2)}\nAdapt those steps for the current goal.`
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
        const result = await (0, router_1.llmCallJSON)(prompt, systemPrompt, {
            complexity: fallback.complexity,
            steps: fallback.steps,
            estimatedTotalMs: fallback.estimatedTotalMs,
        });
        return {
            goal,
            complexity: result.complexity ?? fallback.complexity,
            steps: result.steps ?? fallback.steps,
            estimatedTotalMs: result.estimatedTotalMs ?? fallback.estimatedTotalMs,
            reusingPattern: hasPattern,
            patternGoal: hasPattern && bestPattern ? bestPattern.pattern.goalTemplate : undefined,
            generatedAt: new Date().toISOString(),
        };
    }
    buildFallback(goal) {
        return {
            goal,
            complexity: "medium",
            steps: [
                { id: "step_1", description: `Analyze requirements for: ${goal}`, type: "llm", estimatedDurationMs: 10000, dependencies: [] },
                { id: "step_2", description: "Set up project structure", type: "shell", estimatedDurationMs: 5000, dependencies: ["step_1"] },
                { id: "step_3", description: "Implement core logic", type: "llm", estimatedDurationMs: 30000, dependencies: ["step_2"] },
                { id: "step_4", description: "Write tests", type: "file", estimatedDurationMs: 10000, dependencies: ["step_3"] },
                { id: "step_5", description: "Verify and finalize", type: "manual", estimatedDurationMs: 5000, dependencies: ["step_4"] },
            ],
            estimatedTotalMs: 60000,
            reusingPattern: false,
            generatedAt: new Date().toISOString(),
        };
    }
}
exports.TaskPlanner = TaskPlanner;
exports.taskPlanner = new TaskPlanner();
