"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskGraphBuilder = exports.TaskGraphBuilder = void 0;
// ── Builder ───────────────────────────────────────────────────
class TaskGraphBuilder {
    /** Create a new empty TaskGraph */
    create(goalId) {
        return {
            goalId,
            nodes: new Map(),
            createdAt: new Date(),
        };
    }
    /** Add or overwrite a node in the graph */
    addNode(graph, node) {
        graph.nodes.set(node.id, node);
    }
    /**
     * Return nodes that are "pending" and whose every dependency is "done".
     * These are ready to execute immediately.
     */
    getReady(graph) {
        const ready = [];
        for (const node of graph.nodes.values()) {
            if (node.status !== "pending")
                continue;
            const allDepsDone = node.dependsOn.every(depId => {
                const dep = graph.nodes.get(depId);
                return dep?.status === "done";
            });
            if (allDepsDone)
                ready.push(node);
        }
        return ready;
    }
    /** Return all nodes with the given status */
    getByStatus(graph, status) {
        return Array.from(graph.nodes.values()).filter(n => n.status === status);
    }
    /** True if every node is "done" or "skipped" */
    isComplete(graph) {
        for (const node of graph.nodes.values()) {
            if (node.status !== "done" && node.status !== "skipped")
                return false;
        }
        return true;
    }
    /** True if any node is "failed" */
    hasFailed(graph) {
        for (const node of graph.nodes.values()) {
            if (node.status === "failed")
                return true;
        }
        return false;
    }
    /** Return a plain-object (JSON-serializable) version of the graph */
    toJSON(graph) {
        const nodes = [];
        for (const node of graph.nodes.values()) {
            nodes.push({
                ...node,
                startedAt: node.startedAt?.toISOString(),
                completedAt: node.completedAt?.toISOString(),
            });
        }
        return {
            goalId: graph.goalId,
            nodes,
            createdAt: graph.createdAt.toISOString(),
        };
    }
    /** Reconstruct a TaskGraph from its serialized JSON form */
    fromJSON(json) {
        const graph = this.create(json.goalId);
        graph.createdAt = new Date(json.createdAt);
        for (const n of json.nodes) {
            graph.nodes.set(n.id, {
                ...n,
                startedAt: n.startedAt ? new Date(n.startedAt) : undefined,
                completedAt: n.completedAt ? new Date(n.completedAt) : undefined,
            });
        }
        return graph;
    }
    /**
     * Convert a DevOS plan (with actions array) into a TaskGraph.
     * Actions are sequential by default: each node depends on the previous one,
     * unless the action already has an explicit `dependsOn` array.
     */
    fromPlan(goalId, plan) {
        const graph = this.create(goalId);
        const actions = plan?.actions ?? [];
        actions.forEach((action, i) => {
            const nodeId = action.id ?? `action_${i}`;
            // Explicit deps override sequential chaining
            const dependsOn = Array.isArray(action.dependsOn)
                ? action.dependsOn
                : (i === 0 ? [] : [`action_${i - 1}`]);
            // If the previous node used an explicit id, reference it correctly
            const resolvedDeps = Array.isArray(action.dependsOn)
                ? action.dependsOn
                : (i === 0 ? [] : [actions[i - 1].id ?? `action_${i - 1}`]);
            const node = {
                id: nodeId,
                description: action.description ?? action.type ?? `step ${i + 1}`,
                skill: action.skill,
                action,
                dependsOn: resolvedDeps,
                status: "pending",
            };
            this.addNode(graph, node);
        });
        return graph;
    }
}
exports.TaskGraphBuilder = TaskGraphBuilder;
exports.taskGraphBuilder = new TaskGraphBuilder();
