// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// agents/agentCoordinator_v2.ts — Multi-agent with compression + evolution
//
// New in v2:
//   1. Context compression before each agent run
//   2. Prompt evolution: reviewer scores feed back to improve prompts
//   3. Cross-agent shared memory (index outputs to RAG)
//   4. Observability: emit metrics per agent run
// ============================================================

import { v4 as uuidv4 }            from "uuid";
import { llmCall }                  from "../llm/router";
import { memoryStore }              from "../memory/memoryStore";
import { compressDependencyOutputs } from "../llm/contextCompressor";
import { PromptEvolver }            from "../core/promptEvolver";
import { RAGRetriever }             from "../memory/ragRetriever";
import { Observability }            from "../core/observability";

// ── Types (unchanged from v1) ─────────────────────────────────

export type AgentRole =
  | "researcher"
  | "coder"
  | "marketer"
  | "reviewer"
  | "deployer";

export type AgentStatus = "pending" | "running" | "completed" | "failed";

export interface AgentTask {
  id:           string;
  role:         AgentRole;
  goal:         string;
  context:      Record<string, any>;
  dependencies: string[];
  status:       AgentStatus;
  result?:      string;
  reviewScore?: number;
  error?:       string;
  startedAt?:   number;
  completedAt?: number;
}

export interface AgentReview {
  taskId:       string;
  role:         AgentRole;
  score:        number;
  pass:         boolean;
  improvements: string[];
}

export interface PipelineResult {
  goal:    string;
  tasks:   AgentTask[];
  reviews: AgentReview[];
  passed:  number;
  failed:  number;
  summary: string;
}

// ── Base System Prompts ───────────────────────────────────────

const BASE_PROMPTS: Record<AgentRole, string> = {
  researcher: `You are a factual research agent with deep analytical skills.
Your job: gather structured insights, identify patterns, cite reasoning.
Rules:
- Never speculate without flagging it
- Structure your output clearly with headers
- When returning data, use JSON
- Focus on what's actionable, not just informational`,

  coder: `You are a senior TypeScript/Node.js engineer with 10 years experience.
Your job: write production-ready, working code — not pseudocode.
Rules:
- Always include error handling
- Use TypeScript types, not any
- Write code that could go to production today
- Include brief inline comments on non-obvious logic
- No placeholder comments like "// implement this"`,

  marketer: `You are a SaaS growth strategist focused on conversion.
Your job: write copy and strategy that drives signups and revenue.
Rules:
- Lead with the customer's pain, not features
- Every piece of content must have a clear CTA
- Use specific numbers when possible
- No corporate jargon — write like a human`,

  reviewer: `You are a strict quality reviewer. Score output for quality, correctness, and completeness.
Rules:
- Be specific, not vague
- Score honestly — most outputs score 5–7; only exceptional work scores 9–10
- Always return valid JSON

Return this exact JSON:
{
  "score": <number 0-10>,
  "pass": <true if score >= 7>,
  "improvements": ["specific improvement 1", "specific improvement 2"]
}`,

  deployer: `You are a senior DevOps/infrastructure engineer.
Your job: produce secure, production-ready infrastructure configuration.
Rules:
- Never suggest storing secrets in code
- Always include health checks
- Use specific versions, not "latest"
- Include rollback considerations`,
};

// ── Init prompt evolver with base prompts (call once at startup) ──
export function initPromptEvolution(): void {
  for (const [role, prompt] of Object.entries(BASE_PROMPTS)) {
    PromptEvolver.init(role as AgentRole, prompt);
  }
}

// ── Helpers ───────────────────────────────────────────────────

function safeParseJSON(text: string): any | null {
  try {
    const match = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

function resolveBatches(tasks: AgentTask[]): AgentTask[][] {
  const completed = new Set<string>();
  const batches: AgentTask[][] = [];
  let remaining = [...tasks];

  while (remaining.length > 0) {
    const ready = remaining.filter(t =>
      t.dependencies.every(depId => completed.has(depId))
    );
    if (ready.length === 0) {
      console.warn("[AgentCoordinator] Circular dependency — running remaining sequentially");
      batches.push(remaining);
      break;
    }
    batches.push(ready);
    ready.forEach(t => completed.add(t.id));
    remaining = remaining.filter(t => !ready.includes(t));
  }

  return batches;
}

// ── AgentCoordinator v2 ───────────────────────────────────────

export class AgentCoordinator {

  static async spawnAgent(
    role:    AgentRole,
    goal:    string,
    context: Record<string, any> = {}
  ): Promise<AgentTask> {
    const task: AgentTask = {
      id:           uuidv4(),
      role,
      goal,
      context,
      dependencies: [],
      status:       "running",
      startedAt:    Date.now(),
    };

    console.log(`[AgentCoordinator] Spawning ${role}: "${goal.slice(0, 60)}..."`);

    // ── Compress dependency outputs before injecting ──────────
    let contextStr = "";
    if (Object.keys(context).length > 0) {
      const depOutputs = context.dependencyOutputs as Record<string, string> ?? {};
      const compressed = await compressDependencyOutputs(depOutputs, goal);
      if (compressed && compressed.trim()) {
        contextStr = `\n\nContext from prior agents:\n${compressed}`;
      }
    }

    // ── Get evolved prompt for this role ──────────────────────
    const systemPrompt = PromptEvolver.getPrompt(role, BASE_PROMPTS[role]);

    try {
      const response = await llmCall(
        `Goal: ${goal}${contextStr}`,
        systemPrompt
      );

      task.result      = response.content;
      task.status      = "completed";
      task.completedAt = Date.now();

      // ── Index output to cross-agent memory (RAG) ──────────
      await RAGRetriever.indexTask({
        id:         task.id,
        goal:       `[${role}] ${goal}`,
        status:     "completed",
        result:     task.result,
        durationMs: task.completedAt - (task.startedAt ?? task.completedAt),
      });

      // ── Emit observability metric ─────────────────────────
      Observability.recordAgentScore({
        agentId:   task.id,
        role,
        score:     0,             // updated after review
        goal,
        timestamp: new Date().toISOString(),
      });

      memoryStore.set(`agent_${task.id}`, {
        role, goal, result: task.result, completedAt: task.completedAt,
      });

      console.log(`[AgentCoordinator] ✅ ${role} completed`);
    } catch (error: any) {
      task.status      = "failed";
      task.error       = error?.message ?? "Unknown error";
      task.completedAt = Date.now();
      console.error(`[AgentCoordinator] ❌ ${role} failed:`, task.error);

      // Index failure
      await RAGRetriever.indexError(role, task.error ?? "", goal);
    }

    return task;
  }

  static async reviewAgentOutput(
    task:   AgentTask,
    output: string
  ): Promise<AgentReview> {
    const prompt = `Review this ${task.role} agent output.
Goal: ${task.goal}
Output: ${output.slice(0, 3000)}${output.length > 3000 ? "\n...[truncated]" : ""}`;

    const reviewerPrompt = PromptEvolver.getPrompt("reviewer", BASE_PROMPTS.reviewer);
    const response       = await llmCall(prompt, reviewerPrompt);
    const parsed         = safeParseJSON(response.content);

    const score = typeof parsed?.score === "number"
      ? Math.min(10, Math.max(0, parsed.score))
      : 5;

    const review: AgentReview = {
      taskId:       task.id,
      role:         task.role,
      score,
      pass:         parsed?.pass ?? score >= 7,
      improvements: Array.isArray(parsed?.improvements) ? parsed.improvements : ["Manual review recommended"],
    };

    // ── Feed score back to prompt evolver ────────────────────
    if (!review.pass) {
      await PromptEvolver.recordScore(
        task.role,
        score,
        review.improvements,
        task.goal
      );
    } else {
      // Record good score too (updates rolling average)
      await PromptEvolver.recordScore(task.role, score, [], task.goal);
    }

    // ── Update observability with actual score ────────────────
    Observability.recordAgentScore({
      agentId:   task.id,
      role:      task.role,
      score,
      goal:      task.goal,
      timestamp: new Date().toISOString(),
    });

    return review;
  }

  static async coordinateAgents(
    masterGoal:     string,
    availableRoles: AgentRole[]
  ): Promise<AgentTask[]> {
    console.log(`[AgentCoordinator] Planning: "${masterGoal.slice(0, 80)}..."`);

    const planningPrompt = `Break this master goal into sub-tasks for an AI agent team.

Master Goal: ${masterGoal}
Available Roles: ${availableRoles.join(", ")}

Rules:
- Each task should be completable by ONE agent in ONE LLM call
- researcher always runs first if needed
- reviewer should depend on the task it's reviewing
- Keep tasks focused and specific

Return JSON array:
[
  { "role": "researcher", "goal": "specific goal", "dependencyIndices": [] },
  { "role": "coder", "goal": "specific goal using researcher output", "dependencyIndices": [0] }
]`;

    const response = await llmCall(planningPrompt,
      "You are an execution planner. Return ONLY valid JSON array — no markdown, no explanation.");

    const parsed = safeParseJSON(response.content);
    const plan: Array<{ role: AgentRole; goal: string; dependencyIndices: number[] }> =
      Array.isArray(parsed) ? parsed : [];

    const tasks: AgentTask[] = plan
      .filter(item => availableRoles.includes(item.role))
      .map(item => ({
        id:           uuidv4(),
        role:         item.role,
        goal:         item.goal || "Complete assigned task",
        context:      {},
        dependencies: [],
        status:       "pending" as AgentStatus,
      }));

    plan.forEach((item, i) => {
      if (tasks[i] && Array.isArray(item.dependencyIndices)) {
        tasks[i].dependencies = item.dependencyIndices
          .filter(idx => idx >= 0 && idx < tasks.length && idx !== i)
          .map(idx => tasks[idx].id);
      }
    });

    console.log(`[AgentCoordinator] Planned ${tasks.length} tasks`);
    return tasks;
  }

  static async executeTasks(tasks: AgentTask[]): Promise<AgentTask[]> {
    const taskMap = new Map<string, AgentTask>(tasks.map(t => [t.id, t]));
    const batches = resolveBatches(tasks);

    console.log(`[AgentCoordinator] Executing ${tasks.length} tasks in ${batches.length} batch(es)`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[AgentCoordinator] Batch ${i + 1}/${batches.length}: ${batch.length} task(s) parallel`);

      const results = await Promise.all(
        batch.map(task => {
          // Build context from dependency outputs
          const depResults: Record<string, string> = {};
          for (const depId of task.dependencies) {
            const dep = taskMap.get(depId);
            if (dep?.result) depResults[`${dep.role}_output`] = dep.result;
          }
          const context = { ...task.context, dependencyOutputs: depResults };
          return this.spawnAgent(task.role, task.goal, context);
        })
      );

      results.forEach((result, idx) => {
        const original = batch[idx];
        const stored   = taskMap.get(original.id)!;
        Object.assign(stored, {
          status:      result.status,
          result:      result.result,
          error:       result.error,
          startedAt:   result.startedAt,
          completedAt: result.completedAt,
        });
      });
    }

    return Array.from(taskMap.values());
  }

  static async runAgentPipeline(goal: string): Promise<PipelineResult> {
    console.log(`\n[AgentCoordinator] 🚀 Pipeline: "${goal}"\n`);

    // Init prompt evolution on each pipeline run
    initPromptEvolution();

    const roles: AgentRole[] = ["researcher", "coder", "marketer", "deployer"];

    const plannedTasks  = await this.coordinateAgents(goal, roles);
    const executedTasks = await this.executeTasks(plannedTasks);

    const reviews: AgentReview[] = [];
    for (const task of executedTasks) {
      if (task.status === "completed" && task.result) {
        const review = await this.reviewAgentOutput(task, task.result);
        reviews.push(review);
        task.reviewScore = review.score;
      }
    }

    const passed   = reviews.filter(r => r.pass).length;
    const failed   = reviews.filter(r => !r.pass).length;
    const avgScore = reviews.length > 0
      ? Math.round(reviews.reduce((s, r) => s + r.score, 0) / reviews.length * 10) / 10
      : 0;

    const summary = `${executedTasks.filter(t => t.status === "completed").length}/${executedTasks.length} tasks. Reviews: ${passed} passed, ${failed} failed. Avg: ${avgScore}/10`;

    memoryStore.set("last_pipeline_run", { goal, passed, failed, avgScore, summary, completedAt: Date.now() });

    console.log(`\n[AgentCoordinator] ✅ ${summary}\n`);
    console.log(PromptEvolver.report());

    return { goal, tasks: executedTasks, reviews, passed, failed, summary };
  }

  static formatPipelineReport(result: PipelineResult): string {
    const lines = [
      "╔══════════════════════════════════════════╗",
      "║      DEVOS AGENT PIPELINE REPORT         ║",
      "╚══════════════════════════════════════════╝",
      "",
      `GOAL: ${result.goal}`,
      `SUMMARY: ${result.summary}`,
      "",
      "── TASKS ───────────────────────────────────",
    ];

    result.tasks.forEach((t, i) => {
      const status   = t.status === "completed" ? "✅" : "❌";
      const score    = t.reviewScore !== undefined ? ` (${t.reviewScore}/10)` : "";
      const duration = t.startedAt && t.completedAt
        ? ` ${((t.completedAt - t.startedAt) / 1000).toFixed(1)}s`
        : "";
      lines.push(`  ${i + 1}. ${status} [${t.role}]${score}${duration}`);
      lines.push(`     ${t.goal.slice(0, 80)}`);
      if (t.error) lines.push(`     ⚠ Error: ${t.error}`);
    });

    if (result.reviews.some(r => !r.pass)) {
      lines.push("", "── IMPROVEMENTS ────────────────────────────");
      result.reviews.filter(r => !r.pass).forEach(r => {
        lines.push(`  [${r.role}] Score: ${r.score}/10`);
        r.improvements.forEach(imp => lines.push(`    • ${imp}`));
      });
    }

    lines.push("", "════════════════════════════════════════════");
    return lines.join("\n");
  }
}
