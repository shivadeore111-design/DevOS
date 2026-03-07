// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// dashboard/events.ts — DevOS Event Bus
// Singleton EventEmitter that bridges the execution engine
// to the dashboard WebSocket server.
// ============================================================

import { EventEmitter } from "events";

// ── DevOS Event Interface ─────────────────────────────────────

export interface DevOSEvent {
  type:
    | "goal_received"
    | "plan_created"
    | "step_started"
    | "command_executed"
    | "step_failed"
    | "repair_attempt"
    | "step_completed"
    | "goal_completed"
    | "goal_failed"
    | "agent_spawned"
    | "agent_completed"
    | "skill_executed"
    | "memory_updated";
  taskId?:  string;
  goalId?:  string;
  agentId?: string;
  payload:  any;
  timestamp: string;
}

// ── Event Bus ─────────────────────────────────────────────────

class EventBus {
  private emitter = new EventEmitter();
  private history: DevOSEvent[] = [];
  private readonly MAX_HISTORY = 200;

  emit(event: DevOSEvent): void {
    // Keep a rolling history for new WebSocket clients to replay
    this.history.push(event);
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(-this.MAX_HISTORY);
    }
    this.emitter.emit("event", event);
  }

  subscribe(handler: (event: DevOSEvent) => void): void {
    this.emitter.on("event", handler);
  }

  unsubscribe(handler: (event: DevOSEvent) => void): void {
    this.emitter.off("event", handler);
  }

  /** Return the last N events (for WebSocket replay on connect) */
  getHistory(limit = 20): DevOSEvent[] {
    return this.history.slice(-limit);
  }
}

// ── Singleton ─────────────────────────────────────────────────

export const eventBus = new EventBus();
