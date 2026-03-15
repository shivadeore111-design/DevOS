"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphExecutor = void 0;
exports.createGraphExecutor = createGraphExecutor;
// core/graphExecutor.ts — Parallel DAG executor for TaskGraphs
const taskGraph_1 = require("./taskGraph");
const eventBus_1 = require("./eventBus");
class GraphExecutor {
    constructor(executeAction) {
        this.executeAction = executeAction;
    }
    async execute(graph, workspacePath) {
        const startMs = Date.now();
        const results = new Map();
        const errors = new Map();
        console.log(`\n[GraphExecutor] Executing graph for goal "${graph.goalId}" (${graph.nodes.size} nodes)`);
        // ── Main execution loop ────────────────────────────────────
        let iterations = 0;
        const MAX_ITER = graph.nodes.size * 4; // safety guard against infinite loops
        while (!taskGraph_1.taskGraphBuilder.isComplete(graph) && iterations < MAX_ITER) {
            iterations++;
            const ready = taskGraph_1.taskGraphBuilder.getReady(graph);
            // If nothing is ready but graph isn't complete → we're stuck (likely due to failures)
            if (ready.length === 0) {
                // Mark remaining pending nodes as skipped
                for (const node of taskGraph_1.taskGraphBuilder.getByStatus(graph, "pending")) {
                    node.status = "skipped";
                    console.warn(`[GraphExecutor] Skipped (no deps available): ${node.id}`);
                }
                break;
            }
            // Execute all ready nodes in parallel
            await Promise.all(ready.map(node => this.runNode(node, graph, workspacePath, results, errors)));
            // After any failure, mark dependent nodes as skipped
            this.propagateFailures(graph);
        }
        const nodesCompleted = taskGraph_1.taskGraphBuilder.getByStatus(graph, "done").length;
        const nodesFailed = taskGraph_1.taskGraphBuilder.getByStatus(graph, "failed").length;
        const success = nodesFailed === 0 && taskGraph_1.taskGraphBuilder.isComplete(graph);
        console.log(`\n[GraphExecutor] ${success ? "✅" : "❌"} ${nodesCompleted}/${graph.nodes.size} nodes completed, ${nodesFailed} failed`);
        return {
            goalId: graph.goalId,
            success,
            nodesCompleted,
            nodesFailed,
            totalNodes: graph.nodes.size,
            results,
            errors,
            durationMs: Date.now() - startMs,
        };
    }
    // ── Execute a single node ──────────────────────────────────
    async runNode(node, graph, workspacePath, results, errors) {
        node.status = "running";
        node.startedAt = new Date();
        console.log(`[GraphExecutor] ▶ ${node.id}: ${node.description}`);
        eventBus_1.eventBus.emit("task_started", { goalId: graph.goalId, nodeId: node.id, description: node.description });
        try {
            const result = await this.executeAction(node.action, workspacePath);
            node.result = result.output;
            node.status = result.success ? "done" : "failed";
            if (result.success) {
                node.completedAt = new Date();
                results.set(node.id, result.output);
                console.log(`[GraphExecutor] ✅ ${node.id} done`);
                eventBus_1.eventBus.emit("task_completed", { goalId: graph.goalId, nodeId: node.id, output: result.output });
            }
            else {
                node.error = result.error ?? "Action returned failure";
                errors.set(node.id, node.error);
                console.error(`[GraphExecutor] ❌ ${node.id} failed: ${node.error}`);
                eventBus_1.eventBus.emit("task_failed", { goalId: graph.goalId, nodeId: node.id, error: node.error });
            }
        }
        catch (err) {
            const msg = err?.message ?? String(err);
            node.status = "failed";
            node.error = msg;
            errors.set(node.id, msg);
            console.error(`[GraphExecutor] ❌ ${node.id} threw: ${msg}`);
            eventBus_1.eventBus.emit("task_failed", { goalId: graph.goalId, nodeId: node.id, error: msg });
        }
        node.completedAt = node.completedAt ?? new Date();
    }
    // ── Propagate failures: skip nodes that depended on a failed node ──
    propagateFailures(graph) {
        const failed = new Set(taskGraph_1.taskGraphBuilder.getByStatus(graph, "failed").map(n => n.id));
        let changed = true;
        while (changed) {
            changed = false;
            for (const node of graph.nodes.values()) {
                if (node.status !== "pending")
                    continue;
                const blockedByFailed = node.dependsOn.some(depId => failed.has(depId));
                const blockedBySkipped = node.dependsOn.some(depId => {
                    const dep = graph.nodes.get(depId);
                    return dep?.status === "skipped";
                });
                if (blockedByFailed || blockedBySkipped) {
                    node.status = "skipped";
                    failed.add(node.id);
                    changed = true;
                    console.warn(`[GraphExecutor] Skipped (dep failed): ${node.id}`);
                }
            }
        }
    }
}
exports.GraphExecutor = GraphExecutor;
/** Factory: create a GraphExecutor with an action runner function */
function createGraphExecutor(executeAction) {
    return new GraphExecutor(executeAction);
}
