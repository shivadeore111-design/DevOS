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

// ── Ollama chat-model detection (checks API, not GPU) ────────

async function detectOllamaLocalLLM(): Promise<boolean> {
  try {
    const r = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2000),
    })
    if (!r.ok) return false
    const data = await r.json() as any
    const hasChat = data.models?.some((m: any) =>
      !m.name.includes('embed') &&
      !m.name.includes('nomic') &&
      !m.name.includes('mxbai')
    )
    return hasChat || false
  } catch { return false }
}

export async function buildCapabilityProfile(): Promise<CapabilityProfile> {
  // ── Detect RAM (CIM — wmic deprecated on Windows 11) ────────
  let ramGB = 8
  try {
    const out = execSync(
      'powershell -command "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"',
      { timeout: 5000 },
    ).toString().trim()
    const bytes = parseInt(out)
    if (!isNaN(bytes) && bytes > 0) ramGB = Math.round(bytes / (1024 ** 3))
  } catch {}

  // ── Detect CPU cores ────────────────────────────────────────
  let cpuCores = 4
  try {
    const out = execSync(
      'powershell -command "Get-CimInstance Win32_Processor | Select-Object -ExpandProperty NumberOfCores"',
      { timeout: 5000 },
    ).toString().trim()
    const n = parseInt(out)
    if (!isNaN(n) && n > 0) cpuCores = n
  } catch {}

  // ── Detect GPU VRAM ─────────────────────────────────────────
  // Strategy: nvidia-smi first (accurate), then CIM AdapterRAM
  // Note: Win32_VideoController.AdapterRAM is a 32-bit field and
  // overflows for GPUs with >4GB VRAM (e.g. GTX 1060 6GB reports 4GB or 0)
  let gpuVRAM   = 0
  let hasGPU    = false
  let gpuName   = ''
  // Try nvidia-smi first — most accurate source
  try {
    const smiOut = execSync(
      'nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits',
      { timeout: 4000 },
    ).toString().trim()
    const lines = smiOut.split('\n').filter(l => l.trim())
    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim())
      if (parts.length >= 2) {
        const vramMB = parseInt(parts[1])
        if (!isNaN(vramMB) && vramMB > 0) {
          const vram = Math.round(vramMB / 1024)
          if (vram > gpuVRAM) {
            gpuVRAM = vram
            gpuName = parts[0]
            hasGPU  = true
          }
        }
      }
    }
  } catch { /* nvidia-smi not available — fall through to CIM */ }
  // CIM fallback for non-NVIDIA or when nvidia-smi unavailable
  if (!hasGPU) {
    try {
      const out = execSync(
        'powershell -command "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM | ConvertTo-Json -Compress"',
        { timeout: 5000 },
      ).toString().trim()
      const parsed = JSON.parse(out.startsWith('[') ? out : `[${out}]`)
      for (const gpu of parsed) {
        // AdapterRAM is uint32 — anything < 128MB is likely an overflow or integrated
        const rawBytes = gpu.AdapterRAM || 0
        const vram = rawBytes > 0 ? Math.round(rawBytes / (1024 ** 3)) : 0
        if (vram > gpuVRAM) {
          gpuVRAM = vram
          gpuName = gpu.Name || ''
          hasGPU  = true
        } else if (gpu.Name && !hasGPU) {
          // GPU exists even if VRAM unreadable
          gpuName = gpu.Name
          hasGPU  = true
        }
      }
    } catch {}
  }

  // ── Detect local LLM via Ollama API ─────────────────────────
  const localLLM = await detectOllamaLocalLLM()

  const tier = detectTier(ramGB, gpuVRAM)
  console.log(`[Capability] Tier: ${tier} | RAM: ${ramGB}GB | GPU: ${gpuName || (hasGPU ? `${gpuVRAM}GB` : 'none')} | Local LLM: ${localLLM}`)

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
