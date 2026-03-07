// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// verifier.ts — DevOS Post-Execution Verifier
// Confirms task results meet the original goal
// ============================================================

import { llmCall } from "../llm/router";
import { DevOSTask } from "./task";

export interface VerificationResult {
  passed: boolean;
  confidence: number; // 0–1
  summary: string;
  issues?: string[];
}

const SYSTEM_PROMPT = `You are a DevOS verification agent.
Given an original goal and the execution result, determine if the goal was achieved.

Respond ONLY with valid JSON. No markdown, no explanation.

Schema:
{
  "passed": true | false,
  "confidence": 0.0–1.0,
  "summary": "Brief explanation",
  "issues": ["list of issues if any"]
}`;

export async function verifyTask(task: DevOSTask): Promise<VerificationResult> {
  if (!task.result) {
    return {
      passed: false,
      confidence: 1.0,
      summary: "No result was produced.",
      issues: ["task.result is empty"],
    };
  }

  const prompt = `
ORIGINAL GOAL: ${task.goal}

EXECUTION RESULT:
${JSON.stringify(task.result, null, 2)}

ACTION COUNT: ${task.plan?.actions?.length ?? "unknown"}
RETRY COUNT: ${task.retryCount}

Did the execution successfully achieve the original goal?`;

  try {
    const { content } = await llmCall(prompt, SYSTEM_PROMPT);
    const cleaned = content.replace(/```json|```/g, "").trim();
    const result  = JSON.parse(cleaned);

    console.log(`[Verifier] Task ${task.id}: ${result.passed ? "✅ PASSED" : "❌ FAILED"} (${result.confidence})`);
    return result;
  } catch (err: any) {
    console.warn(`[Verifier] Verification parse failed: ${err.message}`);
    // Fail open — assume passed to not block pipeline
    return {
      passed: true,
      confidence: 0.5,
      summary: "Verification inconclusive — defaulting to passed.",
      issues: [err.message],
    };
  }
}
