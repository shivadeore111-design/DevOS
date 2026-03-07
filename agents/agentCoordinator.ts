// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// agents/agentCoordinator.ts — DevOS Multi-Agent Coordinator
// Spawns, coordinates, reviews agents in dependency order
// Runs independent agents in parallel via Promise.all
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { llmCall } from '../llm/router';
import { memoryStore } from '../memory/memoryStore';

// ── Types ────────────────────────────────────────────────────

export type AgentRole =
  | 'researcher'
  | 'coder'
  | 'marketer'
  | 'reviewer'
  | 'deployer';

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentTask {
  id: string;
  role: AgentRole;
  goal: string;
  context: Record<string, any>;
  dependencies: string[];  // task IDs this task depends on
  status: AgentStatus;
  result?: string;
  reviewScore?: number;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface AgentReview {
  taskId: string;
  role: AgentRole;
  score: number;
  pass: boolean;
  improvements: string[];
}

export interface PipelineResult {
  goal: string;
  tasks: AgentTask[];
  reviews: AgentReview[];
  passed: number;
  failed: number;
  summary: string;
}

// ── System Prompts ───────────────────────────────────────────

const SYSTEM_PROMPTS: Record<AgentRole, string> = {
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

  reviewer: `You are a strict quality reviewer. You review agent output for quality, correctness, and completeness.
Your job: score output and identify specific improvements.
Rules:
- Be specific, not vague ("improve performance" is not useful)
- Score honestly — most outputs score 5-7, only exceptional work scores 9-10
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

// ── Helpers ──────────────────────────────────────────────────

function safeParseJSON(text: string): any | null {
  try {
    const match = text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

function buildTaskContext(
  task: AgentTask,
  allTasks: AgentTask[]
): Record<string, any> {
  const depResults: Record<string, string> = {};
  for (const depId of task.dependencies) {
    const dep = allTasks.find((t) => t.id === depId);
    if (dep?.result) {
      depResults[`${dep.role}_output`] = dep.result;
    }
  }
  return { ...task.context, dependencyOutputs: depResults };
}

function resolveBatches(tasks: AgentTask[]): AgentTask[][] {
  // Topological sort into execution batches
  // Each batch contains tasks whose dependencies are all in prior batches
  const completed = new Set<string>();
  const batches: AgentTask[][] = [];
  let remaining = [...tasks];

  while (remaining.length > 0) {
    const ready = remaining.filter((t) =>
      t.dependencies.every((depId) => completed.has(depId))
    );

    if (ready.length === 0) {
      // Circular dependency or unresolved — run remaining sequentially
      console.warn('[AgentCoordinator] Could not resolve dependencies — running remaining tasks sequentially');
      batches.push(remaining);
      break;
    }

    batches.push(ready);
    ready.forEach((t) => completed.add(t.id));
    remaining = remaining.filter((t) => !ready.includes(t));
  }

  return batches;
}

// ── AgentCoordinator Class ───────────────────────────────────

export class AgentCoordinator {

  /**
   * Spawn a single agent and run its goal.
   * Persists result to project memory.
   */
  static async spawnAgent(
    role: AgentRole,
    goal: string,
    context: Record<string, any> = {}
  ): Promise<AgentTask> {
    const task: AgentTask = {
      id: uuidv4(),
      role,
      goal,
      context,
      dependencies: [],
      status: 'running',
      startedAt: Date.now(),
    };

    console.log(`[AgentCoordinator] Spawning ${role} agent: "${goal.slice(0, 60)}..."`);

    try {
      const contextStr = Object.keys(context).length > 0
        ? `\n\nContext:\n${JSON.stringify(context, null, 2)}`
        : '';

      const response = await llmCall(
        `Goal: ${goal}${contextStr}`,
        SYSTEM_PROMPTS[role]
      );

      task.result = response.content;
      task.status = 'completed';
      task.completedAt = Date.now();

      // Persist to project memory
      try {
        memoryStore.set(`agent_${task.id}`, {
          role,
          goal,
          result: task.result,
          completedAt: task.completedAt,
        });
      } catch {
        // Non-fatal — memory persistence failure shouldn't fail the task
      }

      console.log(`[AgentCoordinator] ✅ ${role} agent completed`);
    } catch (error: any) {
      task.status = 'failed';
      task.error = error?.message || 'Unknown error';
      task.completedAt = Date.now();
      console.error(`[AgentCoordinator] ❌ ${role} agent failed:`, task.error);
    }

    return task;
  }

  /**
   * Review agent output using the reviewer agent.
   * Returns score, pass/fail, and specific improvements.
   */
  static async reviewAgentOutput(
    task: AgentTask,
    output: string
  ): Promise<AgentReview> {
    const prompt = `Review this output from a ${task.role} agent.

Original Goal: ${task.goal}

Output to Review:
${output.slice(0, 3000)}${output.length > 3000 ? '\n...[truncated]' : ''}`;

    const response = await llmCall(prompt, SYSTEM_PROMPTS.reviewer);
    const parsed = safeParseJSON(response.content);

    const score = typeof parsed?.score === 'number'
      ? Math.min(10, Math.max(0, parsed.score))
      : 5;

    return {
      taskId: task.id,
      role: task.role,
      score,
      pass: parsed?.pass ?? score >= 7,
      improvements: Array.isArray(parsed?.improvements) ? parsed.improvements : ['Manual review recommended'],
    };
  }

  /**
   * Break a master goal into sub-tasks mapped to available roles.
   * Returns planned AgentTask[] with dependency IDs resolved.
   */
  static async coordinateAgents(
    masterGoal: string,
    availableRoles: AgentRole[]
  ): Promise<AgentTask[]> {
    console.log(`[AgentCoordinator] Planning execution for: "${masterGoal.slice(0, 80)}..."`);

    const planningPrompt = `Break this master goal into sub-tasks for an AI agent team.

Master Goal: ${masterGoal}
Available Roles: ${availableRoles.join(', ')}

Rules:
- Each task should be completable by ONE agent in ONE LLM call
- Use dependency indices (0-based position in array) to sequence work
- researcher always runs first if needed
- reviewer should depend on the task it's reviewing
- Keep tasks focused and specific

Return JSON array:
[
  {
    "role": "researcher",
    "goal": "specific, actionable goal for this agent",
    "dependencyIndices": []
  },
  {
    "role": "coder",
    "goal": "specific goal that uses researcher output",
    "dependencyIndices": [0]
  }
]`;

    const response = await llmCall(planningPrompt, `You are an execution planner for an AI agent system.
Return ONLY valid JSON array — no markdown, no explanation.`);

    const parsed = safeParseJSON(response.content);
    const plan: Array<{ role: AgentRole; goal: string; dependencyIndices: number[] }> =
      Array.isArray(parsed) ? parsed : [];

    // Build tasks with real UUIDs, then resolve dependency indices → IDs
    const tasks: AgentTask[] = plan
      .filter((item) => availableRoles.includes(item.role))
      .map((item) => ({
        id: uuidv4(),
        role: item.role,
        goal: item.goal || 'Complete assigned task',
        context: {},
        dependencies: [], // filled below
        status: 'pending' as AgentStatus,
      }));

    // Resolve dependency indices to actual task IDs
    plan.forEach((item, i) => {
      if (tasks[i] && Array.isArray(item.dependencyIndices)) {
        tasks[i].dependencies = item.dependencyIndices
          .filter((idx) => idx >= 0 && idx < tasks.length && idx !== i)
          .map((idx) => tasks[idx].id);
      }
    });

    console.log(`[AgentCoordinator] Planned ${tasks.length} tasks across ${new Set(tasks.map((t) => t.role)).size} roles`);
    return tasks;
  }

  /**
   * Execute a set of planned tasks in dependency order.
   * Independent tasks run in parallel via Promise.all.
   */
  static async executeTasks(tasks: AgentTask[]): Promise<AgentTask[]> {
    const taskMap = new Map<string, AgentTask>(tasks.map((t) => [t.id, t]));
    const batches = resolveBatches(tasks);

    console.log(`[AgentCoordinator] Executing ${tasks.length} tasks in ${batches.length} batch(es)`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[AgentCoordinator] Batch ${i + 1}/${batches.length}: running ${batch.length} task(s) in parallel`);

      // Run all tasks in this batch in parallel
      const results = await Promise.all(
        batch.map((task) => {
          const context = buildTaskContext(task, tasks);
          return this.spawnAgent(task.role, task.goal, context);
        })
      );

      // Merge results back into taskMap
      results.forEach((result, idx) => {
        const original = batch[idx];
        const stored = taskMap.get(original.id)!;
        stored.status = result.status;
        stored.result = result.result;
        stored.error = result.error;
        stored.startedAt = result.startedAt;
        stored.completedAt = result.completedAt;
      });
    }

    return Array.from(taskMap.values());
  }

  /**
   * Full end-to-end pipeline:
   * Plan → Execute in dependency order → Review all outputs → Return results
   */
  static async runAgentPipeline(goal: string): Promise<PipelineResult> {
    console.log(`\n[AgentCoordinator] 🚀 Starting pipeline for: "${goal}"\n`);

    const roles: AgentRole[] = ['researcher', 'coder', 'marketer', 'deployer'];

    // 1. Plan
    const plannedTasks = await this.coordinateAgents(goal, roles);

    // 2. Execute in dependency-ordered batches
    const executedTasks = await this.executeTasks(plannedTasks);

    // 3. Review all completed tasks
    const reviews: AgentReview[] = [];
    for (const task of executedTasks) {
      if (task.status === 'completed' && task.result) {
        const review = await this.reviewAgentOutput(task, task.result);
        reviews.push(review);
        task.reviewScore = review.score;
      }
    }

    const passed = reviews.filter((r) => r.pass).length;
    const failed = reviews.filter((r) => !r.pass).length;
    const avgScore = reviews.length > 0
      ? Math.round(reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length * 10) / 10
      : 0;

    const summary = `Pipeline completed: ${executedTasks.filter((t) => t.status === 'completed').length}/${executedTasks.length} tasks succeeded. Reviews: ${passed} passed, ${failed} failed. Avg quality score: ${avgScore}/10`;

    // 4. Persist pipeline run
    try {
      memoryStore.set('last_pipeline_run', {
        goal,
        taskCount: executedTasks.length,
        passed,
        failed,
        avgScore,
        summary,
        completedAt: Date.now(),
      });
    } catch {
      // Non-fatal
    }

    console.log(`\n[AgentCoordinator] ✅ ${summary}\n`);

    return { goal, tasks: executedTasks, reviews, passed, failed, summary };
  }

  /**
   * Format pipeline results as a readable CLI report.
   */
  static formatPipelineReport(result: PipelineResult): string {
    const lines = [
      '╔══════════════════════════════════════════╗',
      '║      DEVOS AGENT PIPELINE REPORT         ║',
      '╚══════════════════════════════════════════╝',
      '',
      `GOAL: ${result.goal}`,
      `SUMMARY: ${result.summary}`,
      '',
      '── TASKS ───────────────────────────────────',
    ];

    result.tasks.forEach((t, i) => {
      const status = t.status === 'completed' ? '✅' : '❌';
      const score = t.reviewScore !== undefined ? ` (score: ${t.reviewScore}/10)` : '';
      const duration = t.startedAt && t.completedAt
        ? ` ${((t.completedAt - t.startedAt) / 1000).toFixed(1)}s`
        : '';
      lines.push(`  ${i + 1}. ${status} [${t.role}]${score}${duration}`);
      lines.push(`     ${t.goal.slice(0, 80)}`);
      if (t.error) lines.push(`     ⚠ Error: ${t.error}`);
    });

    if (result.reviews.length > 0) {
      lines.push('', '── REVIEW FEEDBACK ─────────────────────────');
      result.reviews
        .filter((r) => !r.pass)
        .forEach((r) => {
          lines.push(`  [${r.role}] Score: ${r.score}/10`);
          r.improvements.forEach((imp) => lines.push(`    • ${imp}`));
        });
    }

    lines.push('', '════════════════════════════════════════════');
    return lines.join('\n');
  }
}
