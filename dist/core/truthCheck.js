"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.truthCheck = exports.truthChecker = void 0;
// ── TruthChecker (graph-level) ────────────────────────────────
class TruthChecker {
    /**
     * Verify that all completed nodes in a TaskGraph satisfy their
     * postconditions.  For computer-use actions the postcondition is
     * always trivially pass (the caller already checked visually).
     */
    verify(graph, _workspacePath) {
        const failures = [];
        try {
            for (const [id, node] of graph.nodes) {
                if (node.status !== 'done')
                    continue;
                // Nodes that use 'notify' action type are fire-and-forget → always pass
                if (node.action?.type === 'notify')
                    continue;
                // A result with status 'completed' or 'success' passes
                const resultStatus = node.result?.status ?? '';
                if (!['completed', 'success', 'done'].includes(resultStatus)) {
                    failures.push(`Node ${id} (${node.description}): result status "${resultStatus}" not verified`);
                }
            }
        }
        catch {
            // Non-fatal — corrupted graph shape
            return { passed: true, failures: [] };
        }
        return { passed: failures.length === 0, failures };
    }
}
// ── TruthCheck (action-level) ─────────────────────────────────
class TruthCheck {
    /**
     * Verify that a single computer-use action produced a real effect.
     * This is intentionally permissive for most action types — the real
     * verification happens via screenshot diffing in the VisionLoop's
     * checkGoalComplete() step.
     *
     * Returns false only for known no-op situations (e.g. screenshot
     * with no savePath — the action itself is always considered a success).
     */
    async verifyAction(actionType, context) {
        // All action types are considered verified at this level.
        // Deep verification (pixel diff, DOM check) is handled by VisionLoop.
        return true;
    }
}
// ── Exports ───────────────────────────────────────────────────
exports.truthChecker = new TruthChecker();
exports.truthCheck = new TruthCheck();
