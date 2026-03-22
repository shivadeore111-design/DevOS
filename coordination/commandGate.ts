// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/commandGate.ts — Pre-execution approval gate for dangerous actions
//
// Triggers before:
//   • Any rm/del on files outside the DevOS workspace
//   • Any production deploy action
//   • Any external API call with side effects (POST/PUT/DELETE to external hosts)
//
// CLI mode  → interactive Y/N prompt with 60s timeout
// API mode  → emits SSE 'approval_required', waits for POST /api/coordination/approve
//
// Delegates the actual approval flow to humanInTheLoop so that the same
// POST /api/coordination/approve and /reject endpoints handle both gates.

import * as path        from 'path'
import { humanInTheLoop } from './humanInTheLoop'
import { eventBus }       from '../core/eventBus'

// ── Danger detection ───────────────────────────────────────────

const WORKSPACE_ROOT = path.resolve(process.cwd(), 'workspace')

/** File-deletion patterns that are dangerous (outside workspace) */
const FILE_DELETE_PATTERNS = [
  /\brm\b.*\s(\/[^\s]+)/,          // rm /some/path
  /\bdel\b.*\s([A-Z]:\\[^\s]+)/i,  // del C:\path  (Windows)
  /\brmdir\b/i,
  /\bremove-item\b/i,               // PowerShell
  /fs\.rmSync|fs\.unlinkSync/,      // Node.js fs calls
]

/** Production deploy patterns */
const DEPLOY_PATTERNS = [
  /\bvercel\s+--prod\b/i,
  /\bnpm\s+run\s+deploy\b/i,
  /\bkubectl\s+apply\b/i,
  /\bdocker\s+push\b/i,
  /\bgcloud\s+app\s+deploy\b/i,
  /\bheroku\s+.*--app\b/i,
  /\baws\s+.*deploy\b/i,
  /\bterraform\s+apply\b/,
  /production.*deploy|deploy.*production/i,
]

/** External API side-effect patterns */
const EXTERNAL_API_PATTERNS = [
  /\baxios\.(post|put|delete|patch)\s*\(/i,
  /\bfetch\s*\(\s*['"]https?:\/\/(?!localhost)/i,
  /\bhttp\.(post|put|delete|patch)\s*\(/i,
  /\bmethod\s*:\s*['"]?(POST|PUT|DELETE|PATCH)/i,
  /\btwilio|sendgrid|stripe|mailgun|paypal\b/i,
]

// ── CommandGate class ──────────────────────────────────────────

class CommandGate {

  /**
   * Determine whether the proposed action requires human approval.
   * Returns the detected danger category, or null if safe to proceed.
   */
  detectDanger(action: string): 'file_delete' | 'production_deploy' | 'external_api' | null {
    // File delete outside workspace
    for (const pattern of FILE_DELETE_PATTERNS) {
      if (pattern.test(action)) {
        // If the action explicitly targets the workspace dir, allow it
        const wsNorm = WORKSPACE_ROOT.replace(/\\/g, '/')
        if (!action.includes(wsNorm) && !action.includes('workspace/')) {
          return 'file_delete'
        }
      }
    }

    // Production deploy
    for (const pattern of DEPLOY_PATTERNS) {
      if (pattern.test(action)) return 'production_deploy'
    }

    // External API with side effects
    for (const pattern of EXTERNAL_API_PATTERNS) {
      if (pattern.test(action)) return 'external_api'
    }

    return null
  }

  /**
   * Request approval if the action matches any danger pattern.
   * Returns true  → approved / safe (auto-approved if no danger detected).
   * Returns false → rejected.
   *
   * @param action   The command string or code snippet to evaluate.
   * @param reason   Why DevOS wants to perform this action.
   * @param taskId   The unique task ID (used to await approve/reject via API).
   */
  async requestApproval(action: string, reason: string, taskId?: string): Promise<boolean> {
    const danger = this.detectDanger(action)

    // No danger detected — auto-approve
    if (!danger) return true

    const descriptions: Record<string, string> = {
      file_delete:       '🗑️  Delete file(s) outside the workspace',
      production_deploy: '🚀 Deploy to production',
      external_api:      '🌐 External API call with side effects',
    }

    const actionDescription = `${descriptions[danger] ?? danger}: ${action.slice(0, 120)}`
    const approvalTaskId    = taskId ?? `gate_${Date.now()}`

    console.warn(`[CommandGate] ⚠️  Dangerous action detected (${danger}): ${action.slice(0, 80)}`)
    eventBus.emit('command_gate_triggered', { danger, action: action.slice(0, 200), taskId: approvalTaskId })

    // Delegate to humanInTheLoop which handles both CLI and API modes
    return humanInTheLoop.requestApproval(actionDescription, reason, approvalTaskId)
  }

  /**
   * Convenience: check if an action is dangerous without requesting approval.
   */
  isDangerous(action: string): boolean {
    return this.detectDanger(action) !== null
  }
}

export const commandGate = new CommandGate()
