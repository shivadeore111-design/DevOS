"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Runner = void 0;
const taskStore_1 = require("./taskStore");
const taskQueue_1 = require("./taskQueue");
const events_1 = require("../dashboard/events");
const workspaceManager_1 = require("../devos/runtime/workspaceManager");
const resourceManager_1 = require("../devos/runtime/resourceManager");
const stateSnapshot_1 = require("../devos/runtime/stateSnapshot");
const eventBus_1 = require("./eventBus");
const taskGraph_1 = require("./taskGraph");
const graphExecutor_1 = require("./graphExecutor");
const engine_1 = require("../executor/engine");
const planConfidence_1 = require("./planConfidence");
const goalGovernor_1 = require("../control/goalGovernor");
const budgetManager_1 = require("../control/budgetManager");
const sessionManager_1 = require("./sessionManager");
const heartbeat_1 = require("./heartbeat");
const executionMemory_1 = require("../memory/executionMemory");
const successEvaluator_1 = require("./successEvaluator");
const researchEngine_1 = require("../research/researchEngine");
const slack_1 = require("../integrations/slack");
const auditLogger_1 = require("../security/auditLogger");
const readline = __importStar(require("readline"));
class Runner {
    constructor(opts) {
        this.running = false;
        this.agentId = opts.agentId;
        this.engine = opts.engine;
        this.pollIntervalMs = opts.pollIntervalMs ?? 2000;
    }
    // ── CLI Mode: one goal, exit ──────────────────────────────
    async runOnce(goal, plan) {
        console.log(`\n[Runner:${this.agentId}] CLI — "${goal}"`);
        // ── Duplicate goal detection ─────────────────────────
        const dupCheck = goalGovernor_1.goalGovernor.checkSimilarActive(goal);
        if (dupCheck.duplicate) {
            console.warn(`[Runner] ⚠️  Duplicate goal already running (${dupCheck.existingId}) — proceeding anyway`);
        }
        const task = taskQueue_1.taskQueue.create({ goal, priority: "high", plan });
        // Register with governor and budget manager
        goalGovernor_1.goalGovernor.register(task.id, goal);
        budgetManager_1.budgetManager.canContinue(task.id); // initialises budget entry
        // Emit goal_received on both buses
        eventBus_1.eventBus.emit("goal_received", { goal, taskId: task.id, agentId: this.agentId });
        events_1.eventBus.emit({
            type: "goal_received",
            taskId: task.id,
            agentId: this.agentId,
            payload: { goal, plan },
            timestamp: new Date().toISOString(),
        });
        // Create isolated workspace for this task
        await workspaceManager_1.workspaceManager.create(task.id);
        // Begin resource tracking
        resourceManager_1.resourceManager.startTracking(task.id);
        // Allow the task store's persist() to flush before claiming.
        await this.sleep(150);
        // Retry claim up to 3 times with 100 ms between attempts.
        let claimed;
        for (let attempt = 1; attempt <= 3; attempt++) {
            claimed = taskStore_1.taskStore.claim(task.id, this.agentId);
            if (claimed)
                break;
            console.warn(`[Runner:${this.agentId}] Claim attempt ${attempt}/3 failed for ${task.id} — retrying…`);
            await this.sleep(100);
        }
        if (!claimed) {
            resourceManager_1.resourceManager.stopTracking(task.id);
            throw new Error(`[Runner] Failed to claim task ${task.id} after 3 attempts`);
        }
        await this.executeTask(claimed);
        return taskStore_1.taskStore.get(task.id);
    }
    // ── Daemon Mode: poll continuously ───────────────────────
    startDaemon() {
        if (this.running)
            return;
        this.running = true;
        console.log(`[Runner:${this.agentId}] 🤖 Daemon started (poll: ${this.pollIntervalMs}ms)`);
        this.poll();
    }
    stopDaemon() {
        this.running = false;
        console.log(`[Runner:${this.agentId}] Daemon stopped.`);
    }
    async poll() {
        while (this.running) {
            const task = taskStore_1.taskStore.claimNext(this.agentId);
            if (task) {
                await workspaceManager_1.workspaceManager.create(task.id);
                resourceManager_1.resourceManager.startTracking(task.id);
                await this.executeTask(task);
            }
            else {
                await this.sleep(this.pollIntervalMs);
            }
        }
    }
    // ── Core execution ────────────────────────────────────────
    async executeTask(task) {
        const now = new Date().toISOString();
        task.status = "running";
        task.logs.push({ timestamp: now, level: "info", message: `Execution started by ${this.agentId}` });
        taskStore_1.taskStore.save(task);
        console.log(`[Runner:${this.agentId}] ▶ ${task.id}: "${task.goal}"`);
        // ── Session + heartbeat lifecycle ───────────────────────
        const workspacePath0 = workspaceManager_1.workspaceManager.get(task.id);
        const session = sessionManager_1.sessionManager.create(task.goal, workspacePath0 ?? "");
        const sessionId = session.id;
        sessionManager_1.sessionManager.addHistory(sessionId, "user", task.goal);
        heartbeat_1.heartbeat.start(task.id);
        try {
            const plan = task.plan ?? { summary: task.goal, actions: [] };
            const workspacePath = workspacePath0;
            // ── Execution memory lookup ──────────────────────────
            const parsedGoal = plan._meta?.parsedGoal ?? {};
            const memEntry = executionMemory_1.executionMemory.lookup(parsedGoal);
            if (memEntry && memEntry.successRate > 0.8) {
                console.log(`[ExecutionMemory] Reusing proven pattern "${memEntry.pattern.slice(0, 50)}" ` +
                    `(${(memEntry.successRate * 100).toFixed(0)}% success rate, used ${memEntry.useCount}x)`);
            }
            // ── Research pre-pass for research-type goals ────────
            if (parsedGoal.type === "research") {
                try {
                    const report = await researchEngine_1.researchEngine.research(task.goal, parsedGoal);
                    const researchCtx = researchEngine_1.researchEngine.toExtraContext(report);
                    // Inject research context into plan's extraContext if plan supports it
                    if (plan._meta) {
                        plan._meta.researchContext = researchCtx;
                    }
                    console.log(`[Runner] Research pre-pass complete — ` +
                        `${report.insights.length} insights injected into context`);
                }
                catch (err) {
                    console.warn(`[Runner] Research pre-pass failed (continuing): ${err.message}`);
                }
            }
            // ── Plan confidence scoring ──────────────────────────
            const confScore = planConfidence_1.planConfidence.score(plan, parsedGoal);
            const confDecision = planConfidence_1.planConfidence.decide(confScore);
            if (confDecision === "auto") {
                console.log(`[Runner] Auto-executing (confidence: ${confScore.toFixed(2)})`);
            }
            else if (confDecision === "confirm") {
                console.log(`[Runner] ⚠️  Plan confidence: ${confScore.toFixed(2)} — confirmation required`);
                console.log(`[Runner] Plan summary: ${plan.summary ?? "(no summary)"}`);
                const confirmed = await this.promptYesNo("Execute? [Y/n]: ");
                if (!confirmed) {
                    taskQueue_1.taskQueue.fail(task.id, "User cancelled at confirmation prompt", "User cancelled");
                    goalGovernor_1.goalGovernor.unregister(task.id);
                    resourceManager_1.resourceManager.stopTracking(task.id);
                    return;
                }
            }
            else {
                // approve — block execution, require manual override
                console.log(`[Runner] 🚫 Plan confidence too low (${confScore.toFixed(2)}) for: "${task.goal.slice(0, 60)}..." — blocked`);
                taskQueue_1.taskQueue.fail(task.id, "Plan confidence below approval threshold", "Low confidence");
                goalGovernor_1.goalGovernor.unregister(task.id);
                resourceManager_1.resourceManager.stopTracking(task.id);
                return;
            }
            // Emit plan_created (dashboard bus)
            events_1.eventBus.emit({
                type: "plan_created",
                taskId: task.id,
                agentId: this.agentId,
                payload: { plan },
                timestamp: new Date().toISOString(),
            });
            // ── Build task graph from plan ───────────────────────
            const graph = taskGraph_1.taskGraphBuilder.fromPlan(task.id, plan);
            console.log(`[Runner:${this.agentId}] TaskGraph: ${graph.nodes.size} nodes`);
            // ── Persist snapshot (for resume-on-crash) ───────────
            await stateSnapshot_1.stateSnapshot.save(task.id, graph, workspacePath);
            // ── Choose execution path ────────────────────────────
            let success;
            let output;
            let errorMsg;
            if (this.engine instanceof engine_1.DevOSEngine) {
                // Graph path: parallel execution via GraphExecutor
                const graphExecutor = (0, graphExecutor_1.createGraphExecutor)((action, wp) => this.engine.executeOne(action, wp, task.id));
                const graphResult = await graphExecutor.execute(graph, workspacePath);
                success = graphResult.success;
                output = {
                    nodesCompleted: graphResult.nodesCompleted,
                    nodesFailed: graphResult.nodesFailed,
                    totalNodes: graphResult.totalNodes,
                    durationMs: graphResult.durationMs,
                    results: Object.fromEntries(graphResult.results),
                    errors: Object.fromEntries(graphResult.errors),
                };
                errorMsg = graphResult.success ? undefined : `${graphResult.nodesFailed} node(s) failed`;
            }
            else {
                // Fallback: linear execution through engine interface
                const result = await this.engine.execute(plan);
                success = result.success;
                output = result.output;
                errorMsg = result.error;
            }
            if (success) {
                taskQueue_1.taskQueue.complete(task.id, output);
                eventBus_1.eventBus.emit("task_completed", { taskId: task.id, goal: task.goal, output });
                events_1.eventBus.emit({
                    type: "goal_completed",
                    taskId: task.id,
                    agentId: this.agentId,
                    payload: { goal: task.goal, output },
                    timestamp: new Date().toISOString(),
                });
                resourceManager_1.resourceManager.stopTracking(task.id);
                goalGovernor_1.goalGovernor.unregister(task.id);
                sessionManager_1.sessionManager.addHistory(sessionId, "agent", "Goal completed successfully");
                sessionManager_1.sessionManager.complete(sessionId);
                heartbeat_1.heartbeat.stop(task.id);
                // ── Audit log ─────────────────────────────────────
                auditLogger_1.auditLogger.log({
                    timestamp: new Date().toISOString(),
                    type: "goal_executed",
                    actor: this.agentId,
                    action: `completed:${task.id}`,
                    detail: task.goal.slice(0, 200),
                    success: true,
                });
                // ── Success evaluation + execution memory ─────────
                const evalResult = await successEvaluator_1.successEvaluator.evaluate({ ...task, workspacePath: workspacePath0 }, output, parsedGoal);
                const durationMs = resourceManager_1.resourceManager.getRuntimeMs(task.id);
                executionMemory_1.executionMemory.store({
                    pattern: task.goal,
                    goalType: parsedGoal.type ?? "unknown",
                    domain: parsedGoal.domain ?? "general",
                    stack: parsedGoal.stack ?? [],
                    outcome: evalResult.success ? "success" : "failure",
                    reason: evalResult.summary,
                    actions: plan.actions ?? [],
                    durationMs,
                    retryCount: 0,
                });
                if (memEntry)
                    executionMemory_1.executionMemory.recordUse(memEntry.id, evalResult.success);
                // ── Slack notification ────────────────────────────
                slack_1.slack.notify(task.id, "completed", evalResult.summary || task.goal).catch(() => { });
                // Clean up snapshot on success
                await stateSnapshot_1.stateSnapshot.delete(task.id);
            }
            else {
                taskQueue_1.taskQueue.fail(task.id, errorMsg ?? "Engine returned failure.", "Engine indicated failure");
                eventBus_1.eventBus.emit("task_failed", { taskId: task.id, goal: task.goal, error: errorMsg });
                events_1.eventBus.emit({
                    type: "goal_failed",
                    taskId: task.id,
                    agentId: this.agentId,
                    payload: { goal: task.goal, error: errorMsg },
                    timestamp: new Date().toISOString(),
                });
                resourceManager_1.resourceManager.stopTracking(task.id);
                goalGovernor_1.goalGovernor.unregister(task.id);
                sessionManager_1.sessionManager.fail(sessionId);
                heartbeat_1.heartbeat.stop(task.id);
                // ── Audit log ─────────────────────────────────────
                auditLogger_1.auditLogger.log({
                    timestamp: new Date().toISOString(),
                    type: "goal_executed",
                    actor: this.agentId,
                    action: `failed:${task.id}`,
                    detail: (errorMsg ?? task.goal).slice(0, 200),
                    success: false,
                });
                // ── Failure execution memory ──────────────────────
                const failDurationMs = resourceManager_1.resourceManager.getRuntimeMs(task.id);
                executionMemory_1.executionMemory.store({
                    pattern: task.goal,
                    goalType: parsedGoal.type ?? "unknown",
                    domain: parsedGoal.domain ?? "general",
                    stack: parsedGoal.stack ?? [],
                    outcome: "failure",
                    reason: errorMsg ?? "unknown failure",
                    actions: plan.actions ?? [],
                    durationMs: failDurationMs,
                    retryCount: 0,
                });
                if (memEntry)
                    executionMemory_1.executionMemory.recordUse(memEntry.id, false);
                // ── Slack notification ────────────────────────────
                slack_1.slack.notify(task.id, "failed", errorMsg ?? task.goal).catch(() => { });
                const latest = taskStore_1.taskStore.get(task.id);
                if (latest?.status === "failed") {
                    taskQueue_1.taskQueue.escalate(task.id, "critical", `Retries exhausted: ${errorMsg}`);
                }
            }
        }
        catch (err) {
            const msg = err?.message ?? String(err);
            console.error(`[Runner:${this.agentId}] Exception on ${task.id}: ${msg}`);
            taskQueue_1.taskQueue.fail(task.id, msg, "Unhandled exception");
            eventBus_1.eventBus.emit("task_failed", { taskId: task.id, goal: task.goal, error: msg });
            events_1.eventBus.emit({
                type: "goal_failed",
                taskId: task.id,
                agentId: this.agentId,
                payload: { goal: task.goal, error: msg },
                timestamp: new Date().toISOString(),
            });
            resourceManager_1.resourceManager.stopTracking(task.id);
            goalGovernor_1.goalGovernor.unregister(task.id);
            sessionManager_1.sessionManager.fail(sessionId);
            heartbeat_1.heartbeat.stop(task.id);
            // ── Audit log ───────────────────────────────────────
            auditLogger_1.auditLogger.log({
                timestamp: new Date().toISOString(),
                type: "goal_executed",
                actor: this.agentId,
                action: `exception:${task.id}`,
                detail: msg.slice(0, 200),
                success: false,
            });
            const latest = taskStore_1.taskStore.get(task.id);
            if (latest?.status === "failed") {
                taskQueue_1.taskQueue.escalate(task.id, "critical", `Exception: ${msg}`);
            }
        }
    }
    // ── Helpers ───────────────────────────────────────────
    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
    promptYesNo(question) {
        return new Promise(resolve => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            rl.question(question, (answer) => {
                rl.close();
                const a = answer.trim().toLowerCase();
                resolve(a === "" || a === "y" || a === "yes");
            });
        });
    }
}
exports.Runner = Runner;
