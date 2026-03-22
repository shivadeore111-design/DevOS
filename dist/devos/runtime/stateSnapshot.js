"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stateSnapshot = exports.StateSnapshot = void 0;
exports.graphFromSnapshot = graphFromSnapshot;
// devos/runtime/stateSnapshot.ts — Persist graph state for resume-on-crash
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const taskGraph_1 = require("../../core/taskGraph");
const SNAPSHOT_DIR = path_1.default.join(process.cwd(), "workspace", "snapshots");
class StateSnapshot {
    constructor() {
        fs_1.default.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    }
    /** Persist a snapshot for a running goal */
    async save(goalId, graph, workspacePath) {
        const snap = {
            goalId,
            graph: taskGraph_1.taskGraphBuilder.toJSON(graph),
            workspacePath,
            timestamp: new Date(),
            status: "running",
        };
        const file = this.filePath(goalId);
        fs_1.default.writeFileSync(file, JSON.stringify(snap, null, 2), "utf-8");
        console.log(`[StateSnapshot] Saved snapshot for ${goalId}`);
    }
    /** Load a snapshot by goalId; returns null if not found */
    async load(goalId) {
        const file = this.filePath(goalId);
        if (!fs_1.default.existsSync(file))
            return null;
        try {
            const raw = fs_1.default.readFileSync(file, "utf-8");
            const snap = JSON.parse(raw);
            snap.timestamp = new Date(snap.timestamp);
            return snap;
        }
        catch (err) {
            console.error(`[StateSnapshot] Failed to load snapshot for ${goalId}: ${err.message}`);
            return null;
        }
    }
    /** List all goalIds that have snapshots */
    list() {
        if (!fs_1.default.existsSync(SNAPSHOT_DIR))
            return [];
        return fs_1.default
            .readdirSync(SNAPSHOT_DIR)
            .filter(f => f.startsWith("snapshot_") && f.endsWith(".json"))
            .map(f => f.replace(/^snapshot_/, "").replace(/\.json$/, ""));
    }
    /** Delete a snapshot (call after successful completion) */
    async delete(goalId) {
        const file = this.filePath(goalId);
        if (fs_1.default.existsSync(file)) {
            fs_1.default.rmSync(file);
            console.log(`[StateSnapshot] Deleted snapshot for ${goalId}`);
        }
    }
    // ── Internal ──────────────────────────────────────────────
    filePath(goalId) {
        return path_1.default.join(SNAPSHOT_DIR, `snapshot_${goalId}.json`);
    }
}
exports.StateSnapshot = StateSnapshot;
exports.stateSnapshot = new StateSnapshot();
/**
 * Reconstruct a TaskGraph from a Snapshot, resetting "running" nodes to "pending"
 * so they get re-executed on resume.
 */
function graphFromSnapshot(snap) {
    const graph = taskGraph_1.taskGraphBuilder.fromJSON(snap.graph);
    // Any node that was "running" when we crashed → revert to pending
    for (const node of graph.nodes.values()) {
        if (node.status === "running") {
            node.status = "pending";
            node.startedAt = undefined;
            node.completedAt = undefined;
        }
    }
    return graph;
}
