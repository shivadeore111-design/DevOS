// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

export abstract class BaseProvider {
  protected failureCount = 0;
  protected cooldownUntil = 0;

  abstract name: string;

  isHealthy(): boolean {
    return Date.now() > this.cooldownUntil;
  }

  markFailure() {
    this.failureCount++;
    if (this.failureCount >= 3) {
      this.cooldownUntil = Date.now() + 60_000; // 1 min cooldown
      this.failureCount = 0;
    }
  }

  markSuccess() {
    this.failureCount = 0;
  }
}