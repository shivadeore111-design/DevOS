// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personal/alwaysOn.ts — Permanent background pilot manager
//
// 4 always-on pilots defined in config/pilots/:
//   startup-scout      — GitHub trending + ProductHunt + IndieHackers daily
//   market-monitor     — crypto/stocks alerts, competitive moves weekly
//   ai-researcher      — new AI tools and papers weekly
//   competitor-tracker — OpenClaw/OpenFang GitHub monitoring daily
//
// Pilots are registered in pilotRegistry (loaded from JSON on startup).
// AlwaysOn provides enable/disable/list/getStatus over them.

import { pilotRegistry } from '../devos/pilots/pilotRegistry'
import { pilotScheduler } from '../devos/pilots/pilotScheduler'
import { PilotManifest }  from '../devos/pilots/types'

// ── The 4 permanent agent IDs ─────────────────────────────────────────────

const ALWAYS_ON_AGENTS = [
  'startup-scout',
  'market-monitor',
  'ai-researcher',
  'competitor-tracker',
] as const

type AlwaysOnId = typeof ALWAYS_ON_AGENTS[number]

// ── Status ────────────────────────────────────────────────────────────────

type AgentStatus = 'running' | 'idle' | 'disabled'

// In-memory set of agents currently executing (set by pilotExecutor events)
const _running = new Set<string>()

export function markRunning(id: string, active: boolean): void {
  if (active) _running.add(id)
  else        _running.delete(id)
}

// ── AlwaysOn class ────────────────────────────────────────────────────────

class AlwaysOn {

  // ── Enable / Disable ─────────────────────────────────────────────────

  enableAgent(name: string): void {
    pilotRegistry.enable(name)
    console.log(`[AlwaysOn] ✅ Enabled: ${name}`)
  }

  disableAgent(name: string): void {
    pilotRegistry.disable(name)
    _running.delete(name)
    console.log(`[AlwaysOn] ⏹  Disabled: ${name}`)
  }

  // ── List ──────────────────────────────────────────────────────────────

  /** Returns all AlwaysOn pilot manifests (from registry, or registered stubs) */
  listAgents(): PilotManifest[] {
    return ALWAYS_ON_AGENTS
      .map(id => pilotRegistry.get(id))
      .filter((m): m is PilotManifest => m !== null)
  }

  // ── Status ────────────────────────────────────────────────────────────

  getStatus(name: string): AgentStatus {
    const manifest = pilotRegistry.get(name)
    if (!manifest || !manifest.enabled) return 'disabled'
    if (_running.has(name))             return 'running'
    return 'idle'
  }

  // ── Convenience: enable all or disable all ────────────────────────────

  enableAll(): void {
    ALWAYS_ON_AGENTS.forEach(id => this.enableAgent(id))
  }

  disableAll(): void {
    ALWAYS_ON_AGENTS.forEach(id => this.disableAgent(id))
  }

  // ── Status summary (for CLI + dawn report) ────────────────────────────

  summary(): Array<{ id: string; name: string; status: AgentStatus; schedule: string }> {
    return ALWAYS_ON_AGENTS.map(id => {
      const m = pilotRegistry.get(id)
      return {
        id,
        name:     m?.name    ?? id,
        status:   this.getStatus(id),
        schedule: m?.schedule ?? '(no schedule)',
      }
    })
  }
}

export const alwaysOn = new AlwaysOn()
