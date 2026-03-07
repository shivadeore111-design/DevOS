// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// ============================================================
// task.ts — DevOS Core Task Types
// ============================================================

export type AgentId = string;

export type TaskStatus =
  | "pending"
  | "queued"
  | "claimed"
  | "running"
  | "completed"
  | "failed"
  | "escalated"
  | "cancelled";

export type EscalationLevel = "none" | "warning" | "critical" | "human";

export type Priority = "low" | "normal" | "high" | "critical";

export interface TaskLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  modelUsed?: string;
  tokensUsed?: number;
}

export interface DevOSTask {
  id: string;
  goal: string;
  status: TaskStatus;
  priority: Priority;
  escalation: EscalationLevel;

  claimedBy?: AgentId;
  claimedAt?: string;
  completedAt?: string;

  dependsOn: string[];
  blockedBy: string[];

  plan?: any;
  result?: any;

  lastError?: string;
  retryReason?: string;
  retryCount: number;
  maxRetries: number;

  logs: TaskLogEntry[];

  createdAt: string;
  updatedAt: string;
}
