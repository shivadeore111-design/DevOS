// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";

export interface ExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  artifacts?: string[];
  metadata?: Record<string, any>;
}

export interface VerificationContext {
  goal: string;
  expectedArtifacts?: string[];
}

export interface VerificationVerdict {
  passed: boolean;
  reason?: string;
}

export class VerificationEngine {
  async verify(
    context: VerificationContext,
    result: ExecutionResult
  ): Promise<VerificationVerdict> {
    if (!result.success) {
      return {
        passed: false,
        reason: result.error || "Execution returned failure"
      };
    }

    if (context.expectedArtifacts?.length) {
      for (const file of context.expectedArtifacts) {
        const fullPath = path.resolve(file);
        if (!fs.existsSync(fullPath)) {
          return {
            passed: false,
            reason: `Missing artifact: ${file}`
          };
        }
      }
    }

    return { passed: true };
  }
}