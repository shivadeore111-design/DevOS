// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { SkillExecutor } from "./skillExecutor";
import { VerificationEngine, ExecutionResult } from "./verification/VerificationEngine";

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

      const result: ExecutionResult = await this.executor.execute(action);

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