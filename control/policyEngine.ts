// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// control/policyEngine.ts — Load and enforce config/policies.json

import * as fs   from "fs"
import * as path from "path"

const POLICY_PATH = path.join(__dirname, "../config/policies.json")

export interface Policy {
  blockedCommands:         string[]
  blockedPaths:            string[]
  maxRetries:              number
  maxRuntimeMs:            number
  maxMemoryMb:             number
  requireApprovalAboveRisk: string
  autoExecuteBelow:        number
  autoExecuteConfidence:   boolean
}

export interface PolicyCheckResult {
  allowed: boolean
  reason?: string
}

export class PolicyEngine {
  private policy: Policy

  constructor() {
    this.policy = this.load()
  }

  // ── Public API ──────────────────────────────────────────

  check(action: any): PolicyCheckResult {
    const command = (action.command ?? "").toLowerCase()
    const filePath = (action.path ?? "").replace(/\//g, "\\")

    // ── Blocked commands ─────────────────────────────────
    for (const blocked of this.policy.blockedCommands) {
      if (command.includes(blocked.toLowerCase())) {
        return { allowed: false, reason: `Blocked command: "${blocked}"` }
      }
    }

    // ── Blocked paths ────────────────────────────────────
    for (const blocked of this.policy.blockedPaths) {
      const normalised = blocked.replace(/\//g, "\\")
      if (filePath.toLowerCase().startsWith(normalised.toLowerCase())) {
        return { allowed: false, reason: `Blocked path: "${blocked}"` }
      }
    }

    return { allowed: true }
  }

  getPolicy(): Policy {
    return { ...this.policy }
  }

  reload(): void {
    this.policy = this.load()
    console.log("[PolicyEngine] Policy reloaded from disk")
  }

  // ── Internal ────────────────────────────────────────────

  private load(): Policy {
    try {
      const raw = fs.readFileSync(POLICY_PATH, "utf8")
      return JSON.parse(raw) as Policy
    } catch (err) {
      console.warn("[PolicyEngine] Failed to load policies.json — using defaults:", err)
      return {
        blockedCommands:         ["rm -rf", "format", "shutdown", "DROP DATABASE", "DROP TABLE"],
        blockedPaths:            ["C:\\Windows", "C:\\System32"],
        maxRetries:              5,
        maxRuntimeMs:            1_800_000,
        maxMemoryMb:             2048,
        requireApprovalAboveRisk: "high",
        autoExecuteBelow:        0.8,
        autoExecuteConfidence:   true,
      }
    }
  }
}

export const policyEngine = new PolicyEngine()
