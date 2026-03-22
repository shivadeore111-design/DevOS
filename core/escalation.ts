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

/**
 * Check whether an action type requires OpenClaw escalation.
 * Standard DevOS actions (file_write, shell_exec, file_read) are always
 * approved locally — they do NOT need to go through OpenClaw.
 * OpenClaw escalation is disabled for these types to prevent the
 * "Unsupported escalation type" error.
 */
export function approveEscalation(
  action: any
): { approved: boolean; reason: string } {
  switch (action?.type) {
    case 'file_write':
    case 'shell_exec':
    case 'file_read':
      // These are standard DevOS actions — pass through without escalation
      return { approved: true, reason: 'standard action' }

    case 'system_task':
    case 'shell_plan':
      return { approved: false, reason: 'requires OpenClaw escalation' }

    default:
      return { approved: true, reason: 'default passthrough' }
  }
}