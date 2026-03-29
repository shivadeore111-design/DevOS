// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/capabilityProfile.ts — Hardware-aware capability tier detection.
// Detects RAM, CPU cores, and GPU VRAM, maps to a capability tier,
// and persists a full capability profile to workspace/capability-profile.json.

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

export type HardwareTier = 'low' | 'mid' | 'high' | 'beast'

export interface CapabilityProfile {
  tier:            HardwareTier
  ramGB:           number
  cpuCores:        number
  hasGPU:          boolean
  gpuVRAM:         number
  localLLM:        boolean
  bestProvider:    string
  plannerModel:    string
  fastModel:       string
  responderModel:  string
  tools:           string[]
  persona:         'guided' | 'power'
  detectedAt:      number
}

const PROFILE_PATH = path.join(process.cwd(), 'workspace', 'capability-profile.json')

function detectTier(ramGB: number, gpuVRAM: number): HardwareTier {
  if (gpuVRAM >= 16 || ramGB >= 32) return 'beast'
  if (gpuVRAM >= 8  || ramGB >= 16) return 'high'
  if (gpuVRAM >= 4  || ramGB >= 8)  return 'mid'
  return 'low'
}

export async function buildCapabilityProfile(): Promise<CapabilityProfile> {
  // ── Detect RAM ──────────────────────────────────────────────
  let ramGB = 8
  try {
    const out = execSync('wmic computersystem get TotalPhysicalMemory /value', { timeout: 3000 }).toString()
    const match = out.match(/TotalPhysicalMemory=(\d+)/)
    if (match) ramGB = Math.round(parseInt(match[1]) / (1024 ** 3))
  } catch {}

  // ── Detect CPU cores ────────────────────────────────────────
  let cpuCores = 4
  try {
    const out = execSync('wmic cpu get NumberOfCores /value', { timeout: 3000 }).toString()
    const match = out.match(/NumberOfCores=(\d+)/)
    if (match) cpuCores = parseInt(match[1])
  } catch {}

  // ── Detect GPU VRAM ─────────────────────────────────────────
  let gpuVRAM = 0
  let hasGPU  = false
  try {
    const out = execSync('wmic path win32_VideoController get AdapterRAM /value', { timeout: 3000 }).toString()
    const match = out.match(/AdapterRAM=(\d+)/)
    if (match && parseInt(match[1]) > 0) {
      gpuVRAM = Math.round(parseInt(match[1]) / (1024 ** 3))
      hasGPU  = true
    }
  } catch {}

  const tier    = detectTier(ramGB, gpuVRAM)
  const localLLM = gpuVRAM >= 6

  const profile: CapabilityProfile = {
    tier,
    ramGB,
    cpuCores,
    hasGPU,
    gpuVRAM,
    localLLM,
    bestProvider:   'cerebras',
    plannerModel:   'llama-3.3-70b-versatile',
    fastModel:      'llama3.1-8b',
    responderModel: 'llama-3.3-70b-versatile',
    tools:          ['web', 'file', 'shell', 'browser', 'vision'],
    persona:        tier === 'low' ? 'guided' : 'power',
    detectedAt:     Date.now(),
  }

  fs.mkdirSync(path.dirname(PROFILE_PATH), { recursive: true })
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2))
  return profile
}

export function loadCapabilityProfile(): CapabilityProfile | null {
  try {
    if (!fs.existsSync(PROFILE_PATH)) return null
    return JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf-8'))
  } catch { return null }
}

export let capabilityProfile: CapabilityProfile | null = loadCapabilityProfile()
