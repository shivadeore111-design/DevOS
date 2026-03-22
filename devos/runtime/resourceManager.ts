// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// devos/runtime/resourceManager.ts — Runtime budget enforcement

export interface ResourceLimits {
  maxRuntimeMs: number;   // wall-clock limit per goal
  maxMemoryMb:  number;   // RSS memory ceiling (informational)
  maxDiskMb:    number;   // disk usage ceiling (informational)
}

const DEFAULT_LIMITS: ResourceLimits = {
  maxRuntimeMs: 1_800_000,   // 30 minutes
  maxMemoryMb:  2048,
  maxDiskMb:    1024,
};

interface TrackingEntry {
  startMs:  number;
  limits:   ResourceLimits;
}

export class ResourceManager {
  private tracking = new Map<string, TrackingEntry>();

  /** Begin tracking a goal's resource usage */
  startTracking(goalId: string, limits: Partial<ResourceLimits> = {}): void {
    this.tracking.set(goalId, {
      startMs: Date.now(),
      limits:  { ...DEFAULT_LIMITS, ...limits },
    });
    console.log(`[ResourceManager] Tracking started for ${goalId}`);
  }

  /** Check whether any resource limit has been breached */
  checkLimits(goalId: string): { exceeded: boolean; reason?: string } {
    const entry = this.tracking.get(goalId);
    if (!entry) return { exceeded: false };

    const runtimeMs = Date.now() - entry.startMs;

    if (runtimeMs > entry.limits.maxRuntimeMs) {
      const mins = (entry.limits.maxRuntimeMs / 60_000).toFixed(0);
      return {
        exceeded: true,
        reason:   `Runtime limit exceeded: ${(runtimeMs / 60_000).toFixed(1)} min > ${mins} min`,
      };
    }

    // Memory check (best-effort; only available for the current process)
    const memMb = process.memoryUsage().rss / (1024 * 1024);
    if (memMb > entry.limits.maxMemoryMb) {
      return {
        exceeded: true,
        reason:   `Memory limit exceeded: ${memMb.toFixed(0)} MB > ${entry.limits.maxMemoryMb} MB`,
      };
    }

    return { exceeded: false };
  }

  /** Stop tracking a goal */
  stopTracking(goalId: string): void {
    if (this.tracking.has(goalId)) {
      const ms = this.getRuntimeMs(goalId);
      console.log(`[ResourceManager] Stopped tracking ${goalId} — runtime: ${(ms / 1000).toFixed(1)}s`);
      this.tracking.delete(goalId);
    }
  }

  /** Return elapsed milliseconds for a tracked goal */
  getRuntimeMs(goalId: string): number {
    const entry = this.tracking.get(goalId);
    return entry ? Date.now() - entry.startMs : 0;
  }
}

export const resourceManager = new ResourceManager();
