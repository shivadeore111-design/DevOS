// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// runner.ts — DevOS Runner (Agent Lifecycle)
// Claim → Execute (via TaskGraph) → Handle success/failure
// ============================================================

import { DevOSTask }       from "./task";
import { taskStore }       from "./taskStore";
import { taskQueue }       from "./taskQueue";
import { eventBus as dashboardBus } from "../dashboard/events";
import { workspaceManager }         from "../devos/runtime/workspaceManager";
import { resourceManager }          from "../devos/runtime/resourceManager";
import { stateSnapshot }            from "../devos/runtime/stateSnapshot";
import { eventBus }                 from "./eventBus";
import { taskGraphBuilder }         from "./taskGraph";
import { createGraphExecutor }      from "./graphExecutor";
import { DevOSEngine }              from "../executor/engine";
import { planConfidence }           from "./planConfidence";
import { goalGovernor }             from "../control/goalGovernor";
import { budgetManager }            from "../control/budgetManager";
import { sessionManager }           from "./sessionManager";
import { heartbeat }                from "./heartbeat";
import { executionMemory }          from "../memory/executionMemory";
import { successEvaluator }         from "./successEvaluator";
import { researchEngine }           from "../research/researchEngine";
import { slack }                    from "../integrations/slack";
import { auditLogger }              from "../security/auditLogger";
import * as readline                from "readline";

// ── Action generation fallback ─────────────────────────────────────────────
// Called when the planner returns a plan with 0 actions (empty graph).
// Makes a second Ollama call to convert the raw goal description into
// concrete shell_exec / file_write / file_read actions.

async function generateActionsFromDescription(description: string): Promise<any[]> {
  const prompt = `Convert this task into a JSON array of executable actions.
Return ONLY a valid JSON array, no explanation, no markdown fences.
Each action must have a "type" field. Valid types and their required fields:
- shell_exec: { type: "shell_exec", command: string }
- file_write: { type: "file_write", path: string, content: string }
- file_read: { type: "file_read", path: string }

Task: ${description}

Example output:
[
  { "type": "shell_exec", "command": "mkdir -p workspace/myproject" },
  { "type": "file_write", "path": "workspace/myproject/server.js", "content": "const express = require('express')..." },
  { "type": "shell_exec", "command": "cd workspace/myproject && npm init -y && npm install express" }
]`

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: 'qwen2.5-coder:7b', prompt, stream: false }),
    })
    const data = await (response as any).json()
    let text = data.response || ''
    // Strip markdown fences if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    // Extract JSON array
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return []
    return JSON.parse(match[0])
  } catch (e: any) {
    console.error('[Runner] Action generation failed:', e.message)
    return []
  }
}

export interface ExecutionEngine {
  execute(plan: any):                                      Promise<{ success: boolean; output?: any; error?: string }>;
  executeOne?(action: any, ws?: string, goalId?: string): Promise<{ success: boolean; output?: any; error?: string }>;
}

interface RunnerOptions {
  agentId:         string;
  engine:          ExecutionEngine;
  pollIntervalMs?: number;
  autoApprove?:    boolean;
}

export class Runner {
  private agentId:        string;
  private engine:         ExecutionEngine;
  private pollIntervalMs: number;
  private autoApprove:    boolean;
  private running = false;

  constructor(opts: RunnerOptions) {
    this.agentId        = opts.agentId;
    this.engine         = opts.engine;
    this.pollIntervalMs = opts.pollIntervalMs ?? 2000;
    this.autoApprove    = opts.autoApprove    ?? false;
  }

  // ── CLI Mode: one goal, exit ──────────────────────────────

  async runOnce(goal: string, plan?: any): Promise<DevOSTask> {
    console.log(`\n[Runner:${this.agentId}] CLI — "${goal}"`);

    // ── Duplicate goal detection ─────────────────────────
    const dupCheck = goalGovernor.checkSimilarActive(goal);
    if (dupCheck.duplicate) {
      console.warn(`[Runner] ⚠️  Duplicate goal already running (${dupCheck.existingId}) — proceeding anyway`);
    }

    const task = taskQueue.create({ goal, priority: "high", plan });

    // Register with governor and budget manager
    goalGovernor.register(task.id, goal);
    budgetManager.canContinue(task.id); // initialises budget entry

    // Emit goal_received on both buses
    eventBus.emit("goal_received", { goal, taskId: task.id, agentId: this.agentId });
    dashboardBus.emit({
      type:      "goal_received",
      taskId:    task.id,
      agentId:   this.agentId,
      payload:   { goal, plan },
      timestamp: new Date().toISOString(),
    });

    // Create isolated workspace for this task
    await workspaceManager.create(task.id);

    // Begin resource tracking
    resourceManager.startTracking(task.id);

    // Allow the task store's persist() to flush before claiming.
    await this.sleep(150);

    // Retry claim up to 3 times with 100 ms between attempts.
    let claimed: DevOSTask | undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      claimed = taskStore.claim(task.id, this.agentId);
      if (claimed) break;
      console.warn(`[Runner:${this.agentId}] Claim attempt ${attempt}/3 failed for ${task.id} — retrying…`);
      await this.sleep(100);
    }

    if (!claimed) {
      resourceManager.stopTracking(task.id);
      throw new Error(`[Runner] Failed to claim task ${task.id} after 3 attempts`);
    }

    await this.executeTask(claimed);
    return taskStore.get(task.id)!;
  }

  // ── Daemon Mode: poll continuously ───────────────────────

  startDaemon(): void {
    if (this.running) return;
    this.running = true;
    console.log(`[Runner:${this.agentId}] 🤖 Daemon started (poll: ${this.pollIntervalMs}ms)`);
    this.poll();
  }

  stopDaemon(): void {
    this.running = false;
    console.log(`[Runner:${this.agentId}] Daemon stopped.`);
  }

  private async poll(): Promise<void> {
    while (this.running) {
      const task = taskStore.claimNext(this.agentId);
      if (task) {
        await workspaceManager.create(task.id);
        resourceManager.startTracking(task.id);
        await this.executeTask(task);
      } else {
        await this.sleep(this.pollIntervalMs);
      }
    }
  }

  // ── Core execution ────────────────────────────────────────

  private async executeTask(task: DevOSTask): Promise<void> {
    const now = new Date().toISOString();
    task.status = "running";
    task.logs.push({ timestamp: now, level: "info", message: `Execution started by ${this.agentId}` });
    taskStore.save(task);

    console.log(`[Runner:${this.agentId}] ▶ ${task.id}: "${task.goal}"`);

    // ── Session + heartbeat lifecycle ───────────────────────
    const workspacePath0  = workspaceManager.get(task.id);
    const session         = sessionManager.create(task.goal, workspacePath0 ?? "");
    const sessionId       = session.id;
    sessionManager.addHistory(sessionId, "user", task.goal);
    heartbeat.start(task.id);

    try {
      const plan          = task.plan ?? { summary: task.goal, actions: [] };
      const workspacePath = workspacePath0;

      // ── Execution memory lookup ──────────────────────────
      const parsedGoal = (plan as any)._meta?.parsedGoal ?? {}
      const memEntry   = executionMemory.lookup(parsedGoal)
      if (memEntry && memEntry.successRate > 0.8) {
        console.log(
          `[ExecutionMemory] Reusing proven pattern "${memEntry.pattern.slice(0, 50)}" ` +
          `(${(memEntry.successRate * 100).toFixed(0)}% success rate, used ${memEntry.useCount}x)`
        )
      }

      // ── Research pre-pass for research-type goals ────────
      if (parsedGoal.type === "research") {
        try {
          const report     = await researchEngine.research(task.goal, parsedGoal)
          const researchCtx = researchEngine.toExtraContext(report)
          // Inject research context into plan's extraContext if plan supports it
          if ((plan as any)._meta) {
            (plan as any)._meta.researchContext = researchCtx
          }
          console.log(
            `[Runner] Research pre-pass complete — ` +
            `${report.insights.length} insights injected into context`
          )
        } catch (err: any) {
          console.warn(`[Runner] Research pre-pass failed (continuing): ${err.message}`)
        }
      }

      // ── Plan confidence scoring ──────────────────────────
      const confScore    = planConfidence.score(plan, parsedGoal)
      const confDecision = planConfidence.decide(confScore)

      // Check DEVOS_AUTO env OR autoApprove flag — skip interactive prompts
      const skipPrompt = process.env.DEVOS_AUTO === 'true' || this.autoApprove

      if (confDecision === "auto" || skipPrompt) {
        console.log(`[Runner] Auto-executing (confidence: ${confScore.toFixed(2)})`)
      } else if (confDecision === "confirm") {
        console.log(`[Runner] ⚠️  Plan confidence: ${confScore.toFixed(2)} — confirmation required`)
        console.log(`[Runner] Plan summary: ${plan.summary ?? "(no summary)"}`)
        const confirmed = await this.promptYesNo("Execute? [Y/n]: ")
        if (!confirmed) {
          taskQueue.fail(task.id, "User cancelled at confirmation prompt", "User cancelled");
          goalGovernor.unregister(task.id);
          resourceManager.stopTracking(task.id);
          return;
        }
      } else {
        console.log(`[Runner] 🚫 Plan confidence too low (${confScore.toFixed(2)}) — blocked`)
        taskQueue.fail(task.id, "Plan confidence below approval threshold", "Low confidence");
        goalGovernor.unregister(task.id);
        resourceManager.stopTracking(task.id);
        return;
      }

      // Emit plan_created (dashboard bus)
      dashboardBus.emit({
        type:      "plan_created",
        taskId:    task.id,
        agentId:   this.agentId,
        payload:   { plan },
        timestamp: new Date().toISOString(),
      });

      // ── Build task graph from plan ───────────────────────
      const graph = taskGraphBuilder.fromPlan(task.id, plan);
      console.log(`[Runner:${this.agentId}] TaskGraph: ${graph.nodes.size} nodes`);

      // ── 0-node fallback: generate actions from description ──
      if (graph.nodes.size === 0) {
        console.log('[Runner] Graph has 0 nodes — generating actions from description')
        const actions = await generateActionsFromDescription(task.goal)
        for (const action of actions) {
          const nodeId = require('crypto').randomUUID() as string
          taskGraphBuilder.addNode(graph, {
            id:          nodeId,
            description: action.description ?? action.type ?? 'generated action',
            skill:       action.skill,
            action,
            dependsOn:   [],
            status:      'pending',
          })
        }
        console.log(`[Runner] Added ${actions.length} actions to graph`)
        // Wire sequential dependencies after all nodes are added
        const nodeIds = [...graph.nodes.keys()]
        for (let i = 1; i < nodeIds.length; i++) {
          const node = graph.nodes.get(nodeIds[i])!
          node.dependsOn = [nodeIds[i - 1]]
        }
      }

      // ── Persist snapshot (for resume-on-crash) ───────────
      await stateSnapshot.save(task.id, graph, workspacePath);

      // ── Choose execution path ────────────────────────────
      let success: boolean;
      let output:  any;
      let errorMsg: string | undefined;

      if (this.engine instanceof DevOSEngine) {
        // Graph path: parallel execution via GraphExecutor
        const graphExecutor = createGraphExecutor(
          (action: any, wp: string) => (this.engine as DevOSEngine).executeOne(action, wp, task.id)
        );
        const graphResult = await graphExecutor.execute(graph, workspacePath);
        success  = graphResult.success;
        output   = {
          nodesCompleted: graphResult.nodesCompleted,
          nodesFailed:    graphResult.nodesFailed,
          totalNodes:     graphResult.totalNodes,
          durationMs:     graphResult.durationMs,
          results:        Object.fromEntries(graphResult.results),
          errors:         Object.fromEntries(graphResult.errors),
        };
        errorMsg = graphResult.success ? undefined : `${graphResult.nodesFailed} node(s) failed`;
      } else {
        // Fallback: linear execution through engine interface
        const result = await this.engine.execute(plan);
        success  = result.success;
        output   = result.output;
        errorMsg = result.error;
      }

      if (success) {
        taskQueue.complete(task.id, output);
        eventBus.emit("task_completed", { taskId: task.id, goal: task.goal, output });
        dashboardBus.emit({
          type:      "goal_completed",
          taskId:    task.id,
          agentId:   this.agentId,
          payload:   { goal: task.goal, output },
          timestamp: new Date().toISOString(),
        });
        resourceManager.stopTracking(task.id);
        goalGovernor.unregister(task.id);
        sessionManager.addHistory(sessionId, "agent", "Goal completed successfully");
        sessionManager.complete(sessionId);
        heartbeat.stop(task.id);

        // ── Audit log ─────────────────────────────────────
        auditLogger.log({
          timestamp: new Date().toISOString(),
          type:      "goal_executed",
          actor:     this.agentId,
          action:    `completed:${task.id}`,
          detail:    task.goal.slice(0, 200),
          success:   true,
        });

        // ── Success evaluation + execution memory ─────────
        const evalResult = await successEvaluator.evaluate(
          { ...task, workspacePath: workspacePath0 },
          output,
          parsedGoal,
        )
        const durationMs = resourceManager.getRuntimeMs(task.id)
        // Fix: don't store 0/0-node runs as failure — only fail if nodes actually failed
        const nodesFailed   = output?.nodesFailed  ?? 0
        const totalNodes    = output?.totalNodes   ?? 0
        const isSuccess     = nodesFailed === 0 && (evalResult.success || totalNodes === 0)
        executionMemory.store({
          pattern:    task.goal,
          goalType:   parsedGoal.type  ?? "unknown",
          domain:     parsedGoal.domain ?? "general",
          stack:      parsedGoal.stack  ?? [],
          outcome:    isSuccess ? "success" : "failure",
          reason:     evalResult.summary,
          actions:    plan.actions ?? [],
          durationMs,
          retryCount: 0,
        })
        if (memEntry) executionMemory.recordUse(memEntry.id, evalResult.success)

        // ── Slack notification ────────────────────────────
        slack.notify(task.id, "completed", evalResult.summary || task.goal).catch(() => {})

        // Clean up snapshot on success
        await stateSnapshot.delete(task.id);

      } else {
        taskQueue.fail(task.id, errorMsg ?? "Engine returned failure.", "Engine indicated failure");
        eventBus.emit("task_failed", { taskId: task.id, goal: task.goal, error: errorMsg });
        dashboardBus.emit({
          type:      "goal_failed",
          taskId:    task.id,
          agentId:   this.agentId,
          payload:   { goal: task.goal, error: errorMsg },
          timestamp: new Date().toISOString(),
        });
        resourceManager.stopTracking(task.id);
        goalGovernor.unregister(task.id);
        sessionManager.fail(sessionId);
        heartbeat.stop(task.id);

        // ── Audit log ─────────────────────────────────────
        auditLogger.log({
          timestamp: new Date().toISOString(),
          type:      "goal_executed",
          actor:     this.agentId,
          action:    `failed:${task.id}`,
          detail:    (errorMsg ?? task.goal).slice(0, 200),
          success:   false,
        });

        // ── Failure execution memory ──────────────────────
        const failDurationMs = resourceManager.getRuntimeMs(task.id)
        executionMemory.store({
          pattern:    task.goal,
          goalType:   parsedGoal.type  ?? "unknown",
          domain:     parsedGoal.domain ?? "general",
          stack:      parsedGoal.stack  ?? [],
          outcome:    "failure",
          reason:     errorMsg ?? "unknown failure",
          actions:    plan.actions ?? [],
          durationMs: failDurationMs,
          retryCount: 0,
        })
        if (memEntry) executionMemory.recordUse(memEntry.id, false)

        // ── Slack notification ────────────────────────────
        slack.notify(task.id, "failed", errorMsg ?? task.goal).catch(() => {})

        const latest = taskStore.get(task.id);
        if (latest?.status === "failed") {
          taskQueue.escalate(task.id, "critical", `Retries exhausted: ${errorMsg}`);
        }
      }

    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`[Runner:${this.agentId}] Exception on ${task.id}: ${msg}`);

      taskQueue.fail(task.id, msg, "Unhandled exception");
      eventBus.emit("task_failed", { taskId: task.id, goal: task.goal, error: msg });
      dashboardBus.emit({
        type:      "goal_failed",
        taskId:    task.id,
        agentId:   this.agentId,
        payload:   { goal: task.goal, error: msg },
        timestamp: new Date().toISOString(),
      });
      resourceManager.stopTracking(task.id);
      goalGovernor.unregister(task.id);
      sessionManager.fail(sessionId);
      heartbeat.stop(task.id);

      // ── Audit log ───────────────────────────────────────
      auditLogger.log({
        timestamp: new Date().toISOString(),
        type:      "goal_executed",
        actor:     this.agentId,
        action:    `exception:${task.id}`,
        detail:    msg.slice(0, 200),
        success:   false,
      });

      const latest = taskStore.get(task.id);
      if (latest?.status === "failed") {
        taskQueue.escalate(task.id, "critical", `Exception: ${msg}`);
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────

  private sleep(ms: number) {
    return new Promise<void>(r => setTimeout(r, ms));
  }

  private promptYesNo(question: string): Promise<boolean> {
    return new Promise(resolve => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      rl.question(question, (answer: string) => {
        rl.close()
        const a = answer.trim().toLowerCase()
        resolve(a === "" || a === "y" || a === "yes")
      })
    })
  }
}
