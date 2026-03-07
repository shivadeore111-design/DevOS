// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

export function generateEscalationReport(
  goal: string,
  failedAction: any,
  error: any
) {
  const report = {
    goal,
    failed_action: failedAction,
    error_message: error?.message || "Unknown error",
    timestamp: new Date().toISOString()
  };

  console.log("\n🚨 CLOUD ESCALATION PACKAGE:");
  console.log(JSON.stringify(report, null, 2));
}