// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/eventBus.ts — Lightweight typed event bus for runtime wiring

import { EventEmitter } from "events";

export type DevOSRuntimeEvent =
  | "goal_received"
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "skill_executed"
  | "error_detected"
  | "research_started"
  | "research_completed"
  | "emergency_stop"
  | "workspace_created"
  | "artifact_saved";

interface HistoryEntry {
  event:     string;
  data:      any;
  timestamp: Date;
}

export class EventBus {
  private emitter               = new EventEmitter();
  private _history: HistoryEntry[] = [];
  private readonly MAX_HISTORY  = 100;

  /** Emit a named event with optional payload */
  emit(event: string, data?: any): void {
    const entry: HistoryEntry = { event, data, timestamp: new Date() };

    this._history.push(entry);
    if (this._history.length > this.MAX_HISTORY) {
      this._history = this._history.slice(-this.MAX_HISTORY);
    }

    this.emitter.emit(event, data);
  }

  /** Subscribe to an event */
  on(event: string, handler: (data: any) => void): void {
    this.emitter.on(event, handler);
  }

  /** Unsubscribe from an event */
  off(event: string, handler: (data: any) => void): void {
    this.emitter.off(event, handler);
  }

  /** Return the last N events from history (default: all up to 100) */
  history(limit = 100): HistoryEntry[] {
    return this._history.slice(-limit);
  }
}

export const eventBus = new EventBus();
