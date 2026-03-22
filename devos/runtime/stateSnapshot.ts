// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// devos/runtime/stateSnapshot.ts — Persist graph state for resume-on-crash

import fs   from "fs"
import path from "path"
import { TaskGraph, taskGraphBuilder } from "../../core/taskGraph"

const SNAPSHOT_DIR = path.join(process.cwd(), "workspace", "snapshots")

export interface Snapshot {
  goalId:        string
  graph:         object      // serialised TaskGraph (toJSON)
  workspacePath: string
  timestamp:     Date
  status:        string      // "running" | "completed" | "failed"
}

export class StateSnapshot {
  constructor() {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
  }

  /** Persist a snapshot for a running goal */
  async save(goalId: string, graph: TaskGraph, workspacePath: string): Promise<void> {
    const snap: Snapshot = {
      goalId,
      graph:         taskGraphBuilder.toJSON(graph),
      workspacePath,
      timestamp:     new Date(),
      status:        "running",
    }
    const file = this.filePath(goalId)
    fs.writeFileSync(file, JSON.stringify(snap, null, 2), "utf-8")
    console.log(`[StateSnapshot] Saved snapshot for ${goalId}`)
  }

  /** Load a snapshot by goalId; returns null if not found */
  async load(goalId: string): Promise<Snapshot | null> {
    const file = this.filePath(goalId)
    if (!fs.existsSync(file)) return null
    try {
      const raw  = fs.readFileSync(file, "utf-8")
      const snap = JSON.parse(raw) as Snapshot
      snap.timestamp = new Date(snap.timestamp)
      return snap
    } catch (err: any) {
      console.error(`[StateSnapshot] Failed to load snapshot for ${goalId}: ${err.message}`)
      return null
    }
  }

  /** List all goalIds that have snapshots */
  list(): string[] {
    if (!fs.existsSync(SNAPSHOT_DIR)) return []
    return fs
      .readdirSync(SNAPSHOT_DIR)
      .filter(f => f.startsWith("snapshot_") && f.endsWith(".json"))
      .map(f => f.replace(/^snapshot_/, "").replace(/\.json$/, ""))
  }

  /** Delete a snapshot (call after successful completion) */
  async delete(goalId: string): Promise<void> {
    const file = this.filePath(goalId)
    if (fs.existsSync(file)) {
      fs.rmSync(file)
      console.log(`[StateSnapshot] Deleted snapshot for ${goalId}`)
    }
  }

  // ── Internal ──────────────────────────────────────────────

  private filePath(goalId: string): string {
    return path.join(SNAPSHOT_DIR, `snapshot_${goalId}.json`)
  }
}

export const stateSnapshot = new StateSnapshot()

/**
 * Reconstruct a TaskGraph from a Snapshot, resetting "running" nodes to "pending"
 * so they get re-executed on resume.
 */
export function graphFromSnapshot(snap: Snapshot): TaskGraph {
  const graph = taskGraphBuilder.fromJSON(snap.graph as any)
  // Any node that was "running" when we crashed → revert to pending
  for (const node of graph.nodes.values()) {
    if (node.status === "running") {
      node.status     = "pending"
      node.startedAt  = undefined
      node.completedAt = undefined
    }
  }
  return graph
}
