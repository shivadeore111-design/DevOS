"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionController = void 0;
exports.executeWithIntelligence = executeWithIntelligence;
const skillExecutor_1 = require("./skillExecutor");
const VerificationEngine_1 = require("./verification/VerificationEngine");
/**
 * Function alias kept for legacy imports:
 *   `import { executeWithIntelligence } from "./executionController"`
 */
async function executeWithIntelligence(plan, goal) {
    const controller = new ExecutionController();
    if (!plan?.actions?.length)
        return { success: false, error: "Empty plan" };
    const results = [];
    for (const action of plan.actions) {
        const result = await controller.execute(goal, action);
        results.push(result);
        if (!result.success)
            break;
    }
    return results;
}
class ExecutionController {
    constructor() {
        this.executor = new skillExecutor_1.SkillExecutor();
        this.verifier = new VerificationEngine_1.VerificationEngine();
    }
    async execute(goal, action) {
        try {
            console.log("⚙️ Executing action:", action.name);
            const result = (await this.executor.execute(action));
            const verdict = await this.verifier.verify({
                goal,
                expectedArtifacts: result.artifacts
            }, result);
            if (!verdict.passed) {
                console.log("❌ VERIFIED_FAIL:", verdict.reason);
                return {
                    success: false,
                    error: verdict.reason
                };
            }
            console.log("✅ VERIFIED_PASS");
            return result;
        }
        catch (error) {
            console.log("🔥 ExecutionController Error:", error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}
exports.ExecutionController = ExecutionController;
