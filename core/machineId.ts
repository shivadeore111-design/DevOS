// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/machineId.ts — Hardware-bound machine identifier
//
// Derives a stable, anonymised ID from multiple hardware identifiers
// (CPU, disk, baseboard, OS serial) via wmic with PowerShell fallback.
// All values are one-way hashed — raw hardware IDs never leave the machine.
//
// Strategy:
//   1. Try wmic for each hardware value (fast, widely available)
//   2. Fall back to PowerShell CimInstance if wmic is missing/disabled (Win 11)
//   3. Final fallback: hostname + username hash (cross-platform)

import { execSync } from 'child_process'
import crypto       from 'crypto'
import os           from 'os'

// ── Internal helpers ──────────────────────────────────────────

function tryWmic(query: string): string {
  try {
    const out = execSync(`wmic ${query} /value`, {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const match = out.match(/=([^\r\n]+)/)
    const val = match?.[1]?.trim() || ''
    return val === 'To Be Filled By O.E.M.' ? '' : val
  } catch {
    return ''
  }
}

function tryPowerShell(expression: string): string {
  try {
    const out = execSync(
      `powershell -NoProfile -NonInteractive -Command "${expression}"`,
      { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const val = out.trim()
    return val === 'To Be Filled By O.E.M.' ? '' : val
  } catch {
    return ''
  }
}

/** Try wmic first; fall back to PowerShell if wmic returns nothing. */
function getHardwareValue(wmicQuery: string, psExpression: string): string {
  const v = tryWmic(wmicQuery)
  if (v) return v
  return tryPowerShell(psExpression)
}

// ── Public API ────────────────────────────────────────────────

/**
 * Returns a stable, anonymised 20-char machine ID (prefix: mch_).
 * Derived from CPU + disk + baseboard + OS serial — all SHA-256 hashed.
 */
export function getMachineId(): string {
  try {
    const cpuId   = getHardwareValue(
      'cpu get ProcessorId',
      '(Get-CimInstance Win32_Processor | Select-Object -First 1).ProcessorId',
    )
    const diskId  = getHardwareValue(
      'diskdrive get SerialNumber',
      '(Get-CimInstance Win32_DiskDrive | Select-Object -First 1).SerialNumber',
    )
    const boardId = getHardwareValue(
      'baseboard get SerialNumber',
      '(Get-CimInstance Win32_BaseBoard).SerialNumber',
    )
    const winId   = getHardwareValue(
      'os get SerialNumber',
      '(Get-CimInstance Win32_OperatingSystem).SerialNumber',
    )

    const combined = `${cpuId}|${diskId}|${boardId}|${winId}`

    // If we got at least one real hardware value, use it
    if (combined !== '|||') {
      return 'mch_' + crypto.createHash('sha256').update(combined).digest('hex').slice(0, 16)
    }
  } catch {
    // fall through to fallback
  }

  // Fallback: hostname + username (cross-platform, Linux/macOS safe)
  const fallback = `${os.hostname()}-${os.userInfo().username}`
  return 'mch_' + crypto.createHash('sha256').update(fallback).digest('hex').slice(0, 16)
}

/**
 * Returns the human-readable machine name (COMPUTERNAME env var or os.hostname()).
 */
export function getMachineName(): string {
  return process.env.COMPUTERNAME || os.hostname()
}
