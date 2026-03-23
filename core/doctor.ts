// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/doctor.ts — System health checks for DevOS subsystems.
//
// Sprint 23: ComputerUse Memory check via MemoryStrategy.
// Sprint 24: Hardware Detection + First-boot Setup checks.
//
// NOTE: This is the sandbox stub. The full implementation (with LLM provider,
// Docker, database, and tool-registry checks) lives at C:\Users\shiva\DevOS\core\doctor.ts
// and will be merged on the host machine.

import { memoryStrategy }              from './memoryStrategy'
import { detectHardware }              from './hardwareDetector'
import { isSetupComplete }             from './setupWizard'

// ── Types ────────────────────────────────────────────────────

export interface DoctorCheckResult {
  name:    string
  status:  'ok' | 'warn' | 'error'
  message: string
  detail?: string | Record<string, unknown>
}

export interface DoctorReport {
  timestamp: string
  checks:    DoctorCheckResult[]
  healthy:   boolean
}

// ── Individual checks ─────────────────────────────────────────

/**
 * Sprint 23 — ComputerUse Memory check.
 */
async function checkComputerUseMemory(): Promise<DoctorCheckResult> {
  try {
    const stats  = memoryStrategy.stats()
    const status = stats.total === 0 ? 'warn' : 'ok'
    return {
      name:   'ComputerUse Memory',
      status,
      message: stats.total === 0
        ? 'Memory store is empty — no computer-use sessions recorded yet'
        : `Memory store healthy — ${stats.total} goal(s), avg success rate ${(stats.avgSuccessRate * 100).toFixed(1)}%`,
      detail: {
        totalGoals:     stats.total,
        avgSuccessRate: stats.avgSuccessRate,
        topGoals:       stats.topGoals,
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
  const checks: DoctorCheckResult[] = []

  // Sprint 23 — ComputerUse Memory
  checks.push(await checkComputerUseMemory())

  // Sprint 24 — Hardware Detection
  const hw = detectHardware()
  checks.push({
    name:    'Hardware Detection',
    status:  hw.gpu !== 'Unknown GPU' ? 'ok' : 'warn',
    message: hw.gpu !== 'Unknown GPU'
      ? `GPU detected: ${hw.gpu}`
      : 'GPU not detected — model recommendations may be suboptimal',
    detail:  `${hw.gpu} · ${hw.vramGB}GB VRAM · ${hw.ramGB}GB RAM · ${hw.platform}`,
  })

  // Sprint 24 — First-boot Setup
  const setupDone = isSetupComplete()
  checks.push({
    name:    'First-boot Setup',
    status:  setupDone ? 'ok' : 'warn',
    message: setupDone ? 'Setup complete' : 'Run: devos setup',
    detail:  setupDone ? 'Setup complete' : 'Run: devos setup',
  })

  // Additional checks (LLM, Docker, DB, etc.) live in the full host implementation.

  return {
    timestamp: new Date().toISOString(),
    checks,
    healthy:   checks.every(c => c.status !== 'error'),
  }
}
