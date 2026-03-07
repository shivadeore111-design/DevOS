// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { SkillExecutor } from "./skillExecutor";
import { VerificationEngine, ExecutionResult } from "./verification/VerificationEngine";

/**
 * Function alias kept for legacy imports:
 *   `import { executeWithIntelligence } from "./executionController"`
 */
export async function executeWithIntelligence(plan: any, goal: string): Promise<any> {
  const controller = new ExecutionController();
  if (!plan?.actions?.length) return { success: false, error: "Empty plan" };
  const results = [];
  for (const action of plan.actions) {
    const result = await controller.execute(goal, action);
    results.push(result);
    if (!result.success) break;
  }
  return results;
}

export class ExecutionController {
  private executor: SkillExecutor;
  private verifier: VerificationEngine;

  constructor() {
    this.executor = new SkillExecutor();
    this.verifier = new VerificationEngine();
  }

  async execute(goal: string, action: any): Promise<ExecutionResult> {
    try {
      console.log("⚙️ Executing action:", action.name);

      const result: ExecutionResult = (await this.executor.execute(action)) as ExecutionResult;

      const verdict = await this.verifier.verify(
        {
          goal,
          expectedArtifacts: result.artifacts
        },
        result
      );

      if (!verdict.passed) {
        console.log("❌ VERIFIED_FAIL:", verdict.reason);
        return {
          success: false,
          error: verdict.reason
        };
      }

      console.log("✅ VERIFIED_PASS");

      return result;

    } catch (error: any) {
      console.log("🔥 ExecutionController Error:", error.message);

      return {
        success: false,
        error: error.message
      };
    }
  }
}