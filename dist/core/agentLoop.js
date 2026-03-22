"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentLoop = exports.AgentLoop = void 0;
// core/agentLoop.ts — Observe → Plan → Act → Reflect execution loop
const crypto_1 = __importDefault(require("crypto"));
const sessionManager_1 = require("./sessionManager");
const eventBus_1 = require("./eventBus");
const goalGovernor_1 = require("../control/goalGovernor");
const emergencyStop_1 = require("../control/emergencyStop");
const planner_v2_1 = require("./planner_v2");
const taskGraph_1 = require("./taskGraph");
const graphExecutor_1 = require("./graphExecutor");
const engine_1 = require("../executor/engine");
const DEFAULT_MAX_ITERATIONS = 10;
class AgentLoop {
    constructor() {
        this.running = new Map();
    }
    // ── Main loop ────────────────────────────────────────────
    async run(goal, sessionId, maxIterations = DEFAULT_MAX_ITERATIONS) {
        const session = sessionManager_1.sessionManager.get(sessionId);
        if (!session) {
            console.error(`[AgentLoop] Session not found: ${sessionId}`);
            return;
        }
        const ctx = {
            session,
            iteration: 0,
            maxIterations,
            lastResult: null,
            shouldContinue: true,
        };
        this.running.set(sessionId, ctx);
        // SHA-256 plan hash ring — stores last 5 plan hashes for loop detection
        const planHashRing = new Set();
        eventBus_1.eventBus.emit("loop_started", { sessionId, goal, maxIterations });
        console.log(`[AgentLoop] Starting loop for "${goal}" — max ${maxIterations} iterations`);
        const workspace = session.workspacePath;
        const engine = new engine_1.DevOSEngine(workspace);
        while (ctx.shouldContinue && ctx.iteration < ctx.maxIterations) {
            ctx.iteration++;
            // ── Emergency stop check ───────────────────────────
            if (emergencyStop_1.emergencyStop.isStopRequested(sessionId)) {
                console.log(`[AgentLoop] Emergency stop requested — halting loop`);
                ctx.shouldContinue = false;
                break;
            }
            console.log(`\n[AgentLoop] ── Iteration ${ctx.iteration}/${maxIterations} ──`);
            eventBus_1.eventBus.emit("loop_iteration", { sessionId, iteration: ctx.iteration, goal });
            // ── OBSERVE ────────────────────────────────────────
            const observedContext = this.observe(ctx);
            // ── PLAN ───────────────────────────────────────────
            let plan;
            try {
                plan = await (0, planner_v2_1.generatePlan)(observedContext.enrichedGoal);
                // Loop detection
                const loopCheck = goalGovernor_1.goalGovernor.checkLoop(sessionId, plan.summary ?? observedContext.enrichedGoal);
                if (loopCheck.looping) {
                    console.warn(`[AgentLoop] Loop detected: ${loopCheck.reason} — stopping`);
                    sessionManager_1.sessionManager.addHistory(sessionId, "agent", `Loop detected: ${loopCheck.reason}`);
                    ctx.shouldContinue = false;
                    break;
                }
                // SHA-256 plan hash guard — detect repeated identical action sequences
                const planHash = crypto_1.default
                    .createHash("sha256")
                    .update(JSON.stringify(plan.actions ?? []))
                    .digest("hex");
                if (planHashRing.has(planHash)) {
                    console.warn(`[AgentLoop] 🔄 Loop detected — breaking (plan hash repeated)`);
                    sessionManager_1.sessionManager.addHistory(sessionId, "agent", "Loop detected: identical plan generated twice");
                    ctx.shouldContinue = false;
                    break;
                }
                // Keep only the last 5 hashes
                planHashRing.add(planHash);
                if (planHashRing.size > 5) {
                    const oldest = planHashRing.values().next().value;
                    planHashRing.delete(oldest);
                }
            }
            catch (err) {
                console.error(`[AgentLoop] Plan generation failed: ${err.message}`);
                sessionManager_1.sessionManager.addHistory(sessionId, "agent", `Plan failed: ${err.message}`);
                break;
            }
            // ── ACT ────────────────────────────────────────────
            let success = false;
            let actError;
            try {
                const graph = taskGraph_1.taskGraphBuilder.fromPlan(sessionId, plan);
                const executor = (0, graphExecutor_1.createGraphExecutor)((action, wp) => engine.executeOne(action, wp, sessionId));
                const result = await executor.execute(graph, workspace);
                success = result.success;
                ctx.lastResult = result;
                actError = result.success ? undefined : `${result.nodesFailed} node(s) failed`;
            }
            catch (err) {
                actError = err.message;
                ctx.lastResult = { success: false, error: actError };
            }
            // ── REFLECT ────────────────────────────────────────
            const reflection = this.reflect(ctx, success, actError);
            sessionManager_1.sessionManager.addHistory(sessionId, "agent", reflection.summary);
            if (reflection.goalComplete) {
                console.log(`[AgentLoop] ✅ Goal appears complete after iteration ${ctx.iteration}`);
                ctx.shouldContinue = false;
            }
            else if (!success) {
                console.log(`[AgentLoop] ❌ Iteration ${ctx.iteration} failed: ${actError}`);
                // Continue — next iteration will re-plan with updated context
            }
        }
        // ── Loop finished ──────────────────────────────────────
        const finalStatus = emergencyStop_1.emergencyStop.isStopRequested(sessionId) ? "stopped"
            : ctx.iteration >= ctx.maxIterations ? "max_iterations"
                : "completed";
        console.log(`\n[AgentLoop] Loop ended — reason: ${finalStatus} (${ctx.iteration} iterations)`);
        eventBus_1.eventBus.emit("loop_completed", { sessionId, goal, iterations: ctx.iteration, finalStatus });
        this.running.delete(sessionId);
    }
    // ── Control ───────────────────────────────────────────────
    stop(sessionId) {
        const ctx = this.running.get(sessionId);
        if (ctx) {
            ctx.shouldContinue = false;
            console.log(`[AgentLoop] Stop requested for session: ${sessionId}`);
            eventBus_1.eventBus.emit("loop_stopped", { sessionId });
        }
    }
    isRunning(sessionId) {
        return this.running.has(sessionId);
    }
    // ── Private: Observe ──────────────────────────────────────
    observe(ctx) {
        const { session, lastResult, iteration } = ctx;
        const recentHistory = session.history
            .slice(-5)
            .map(h => `${h.role}: ${h.content}`)
            .join("\n");
        let enrichedGoal = session.goal;
        if (iteration > 1 && lastResult) {
            const resultNote = lastResult.success
                ? `(Previous attempt completed ${lastResult.nodesCompleted ?? "some"} actions.)`
                : `(Previous attempt failed. Retry and fix.)`;
            enrichedGoal = `${session.goal} ${resultNote}`;
        }
        if (recentHistory) {
            enrichedGoal += `\n\nContext:\n${recentHistory}`;
        }
        return { enrichedGoal };
    }
    // ── Private: Reflect ──────────────────────────────────────
    reflect(ctx, success, error) {
        const { iteration, lastResult } = ctx;
        if (success) {
            const nodesCompleted = lastResult?.nodesCompleted ?? 0;
            const totalNodes = lastResult?.totalNodes ?? 0;
            const summary = `Iteration ${iteration}: completed ${nodesCompleted}/${totalNodes} actions successfully.`;
            // Goal complete heuristic: all nodes finished cleanly
            const goalComplete = nodesCompleted > 0 && nodesCompleted === totalNodes;
            return { summary, goalComplete };
        }
        const summary = `Iteration ${iteration}: failed — ${error ?? "unknown error"}`;
        return { summary, goalComplete: false };
    }
}
exports.AgentLoop = AgentLoop;
exports.agentLoop = new AgentLoop();
