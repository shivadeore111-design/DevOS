// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/doctor.ts — System health checks for DevOS subsystems.
//
// Sprint 23 addition: ComputerUse Memory health check via MemoryStrategy.
//
// NOTE: This is the sandbox stub. The full implementation (with LLM provider,
// Docker, database, and tool-registry checks) lives at C:\Users\shiva\DevOS\core\doctor.ts
// and will be merged on the host machine.

import { memoryStrategy } from './memoryStrategy'

// ── Types ────────────────────────────────────────────────────

export interface DoctorCheckResult {
  name:    string
  status:  'ok' | 'warn' | 'error'
  message: string
  detail?: Record<string, unknown>
}

export interface DoctorReport {
  timestamp: string
  checks:    DoctorCheckResult[]
  healthy:   boolean
}

// ── Individual checks ─────────────────────────────────────────

/**
 * Sprint 23 — ComputerUse Memory check.
 * Verifies that the memory store is readable and reports key stats.
 */
async function checkComputerUseMemory(): Promise<DoctorCheckResult> {
  try {
    const stats = memoryStrategy.stats()
    const status = stats.total === 0 ? 'warn' : 'ok'
    return {
      name:   'ComputerUse Memory',
      status,
      message: stats.total === 0
        ? 'Memory store is empty — no computer-use sessions recorded yet'
        : `Memory store healthy — ${stats.total} goal(s), avg success rate ${(stats.avgSuccessRate * 100).toFixed(1)}%`,
      detail: {
        totalGoals:      stats.total,
        avgSuccessRate:  stats.avgSuccessRate,
        topGoals:        stats.topGoals,
      },
    }
  } catch (err: any) {
    return {
      name:    'ComputerUse Memory',
      status:  'error',
      message: `Memory store unavailable: ${err?.message ?? 'unknown error'}`,
    }
  }
}

// ── Doctor runner ─────────────────────────────────────────────

export async function runDoctor(): Promise<DoctorReport> {
  const checks = await Promise.all([
    checkComputerUseMemory(),
    // Additional checks (LLM, Docker, DB, etc.) live in the full host implementation.
  ])

  return {
    timestamp: new Date().toISOString(),
    checks,
    healthy: checks.every(c => c.status !== 'error'),
  }
}
