// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/machineId.ts — Hardware-bound machine identifier
//
// Derives a stable, anonymised 16-char hex ID from the BIOS UUID
// (via wmic on Windows) with a hostname+username fallback.
// The ID is one-way hashed — the raw UUID never leaves the machine.

import { execSync } from 'child_process'
import crypto       from 'crypto'
import os           from 'os'

export function getMachineId(): string {
  try {
    const out  = execSync('wmic csproduct get UUID /value', { timeout: 3000 }).toString()
    const uuid = out.match(/UUID=([^\s]+)/)?.[1]?.trim() || ''
    if (uuid && uuid !== 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF') {
      return crypto.createHash('sha256').update(uuid).digest('hex').slice(0, 16)
    }
  } catch {}

  // Fallback: hostname + username (works on Linux/macOS too)
  const fallback = `${os.hostname()}-${os.userInfo().username}`
  return crypto.createHash('sha256').update(fallback).digest('hex').slice(0, 16)
}
