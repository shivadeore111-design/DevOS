// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { loadMemory } from "../memory/memoryEngine";

export function shouldStop(
  cycleCount: number
): { stop: boolean; reason?: string } {
  const memory = loadMemory();

  const maxCycles = 10;

  if (cycleCount >= maxCycles) {
    return { stop: true, reason: "Max cycles reached." };
  }

  const recentFailures = memory.failures.slice(-3);

  if (recentFailures.length === 3) {
    return { stop: true, reason: "3 consecutive failures detected." };
  }

  const recentScores = memory.improvements
    .slice(-5)
    .map((entry: any) => entry?.data?.usefulnessScore)
    .filter((s: number) => typeof s === "number");

  if (recentScores.length >= 5) {
    const avg =
      recentScores.reduce((a: number, b: number) => a + b, 0) /
      recentScores.length;

    if (avg < 5) {
      return { stop: true, reason: "Low average usefulness detected." };
    }
  }

  return { stop: false };
}

export function calculateAdaptiveDelay(): number {
  const memory = loadMemory();

  const lastImprovement = memory.improvements.slice(-1)[0];
  const recentFailures = memory.failures.slice(-2);

  // Cooldown after failures
  if (recentFailures.length > 0) {
    return 60_000; // 60 seconds
  }

  if (!lastImprovement || !lastImprovement.data) {
    return 10_000; // default 10 seconds
  }

  const score = lastImprovement.data.usefulnessScore;

  if (score >= 8) {
    return 60_000; // high-quality → slow deeper research
  }

  if (score >= 6) {
    return 30_000; // medium-quality → moderate pace
  }

  return 10_000; // low-quality → pivot quickly
}