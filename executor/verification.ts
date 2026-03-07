// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";

export interface ActionResult {
  success: boolean;
  message?: string;
  artifacts?: string[];
  error?: string;
}

export interface VerificationResult {
  passed: boolean;
  reason?: string;
}

export class VerificationLayer {
  async verify(result: ActionResult): Promise<VerificationResult> {
    if (!result.success) {
      return {
        passed: false,
        reason: result.error || "Action returned failure"
      };
    }

    if (result.artifacts?.length) {
      for (const file of result.artifacts) {
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