// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/modelDiscovery.ts — Automatic local model discovery & scoring.
// Queries Ollama /api/tags, scores each model by capability profile,
// and assigns the best model per task type.

// ── Types ──────────────────────────────────────────────────────

interface ModelProfile {
  sizeGB:    number
  tier:      'small' | 'medium' | 'large' | 'xlarge'
  strengths: ('chat' | 'code' | 'reasoning' | 'fast')[]
}

// ── Known model profiles — matched by name prefix ──────────────

const MODEL_PROFILES: Record<string, ModelProfile> = {
  'gemma4':        { sizeGB: 9.6, tier: 'large',  strengths: ['chat', 'reasoning'] },
  'gemma3':        { sizeGB: 5,   tier: 'medium', strengths: ['chat'] },
  'llama3.3':      { sizeGB: 43,  tier: 'xlarge', strengths: ['chat', 'reasoning'] },
  'llama3.2':      { sizeGB: 2,   tier: 'small',  strengths: ['fast', 'chat'] },
  'llama3.1':      { sizeGB: 4.7, tier: 'medium', strengths: ['chat'] },
  'llama3':        { sizeGB: 4.7, tier: 'medium', strengths: ['chat'] },
  'mistral-nemo':  { sizeGB: 7.1, tier: 'medium', strengths: ['chat', 'reasoning'] },
  'mistral':       { sizeGB: 4.4, tier: 'medium', strengths: ['chat', 'fast'] },
  'qwen2.5-coder': { sizeGB: 9,   tier: 'large',  strengths: ['code'] },
  'qwen2.5':       { sizeGB: 4.7, tier: 'medium', strengths: ['chat', 'reasoning'] },
  'deepseek-coder':{ sizeGB: 9,   tier: 'large',  strengths: ['code'] },
  'deepseek-r1':   { sizeGB: 9,   tier: 'large',  strengths: ['reasoning'] },
  'phi4':          { sizeGB: 9,   tier: 'large',  strengths: ['reasoning', 'chat'] },
  'phi3':          { sizeGB: 2.2, tier: 'small',  strengths: ['fast', 'chat'] },
  'codellama':     { sizeGB: 4.7, tier: 'medium', strengths: ['code'] },
  'vicuna':        { sizeGB: 4,   tier: 'medium', strengths: ['chat'] },
}

// Skip these — they are embedding / vision models, not chat
const SKIP_PATTERNS = ['embed', 'nomic', 'mxbai', 'clip', 'whisper']

// ── Discovery result ────────────────────────────────────────────

export interface DiscoveredModels {
  planner:   string | null  // best reasoning model
  responder: string | null  // best general chat model
  coder:     string | null  // best code model
  fast:      string | null  // fastest / smallest model
  all:       string[]       // all available chat model names
}

// ── Main discovery function ─────────────────────────────────────

export async function discoverLocalModels(): Promise<DiscoveredModels> {
  try {
    const r = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(3000),
    })
    if (!r.ok) return emptyDiscovery()

    const { models } = await r.json() as { models: { name: string; size: number }[] }

    const chatModels = models.filter(m =>
      !SKIP_PATTERNS.some(skip => m.name.toLowerCase().includes(skip))
    )

    if (chatModels.length === 0) return emptyDiscovery()

    const scored = chatModels.map(m => ({
      name:    m.name,
      profile: getProfile(m.name),
    }))

    const bySize = (a: typeof scored[0], b: typeof scored[0]) =>
      b.profile.sizeGB - a.profile.sizeGB

    const planners = scored.filter(m =>
      m.profile.strengths.includes('reasoning') ||
      m.profile.tier === 'large' ||
      m.profile.tier === 'xlarge'
    )
    const coders = scored.filter(m => m.profile.strengths.includes('code'))
    const fast   = scored.filter(m =>
      m.profile.strengths.includes('fast') || m.profile.tier === 'small'
    )

    const bestBySize     = [...scored].sort(bySize)[0]?.name || null
    const bestPlanner    = [...planners].sort(bySize)[0]?.name || bestBySize
    const bestCoder      = [...coders].sort(bySize)[0]?.name  || bestBySize
    const bestFast       = [...fast].sort(
      (a, b) => a.profile.sizeGB - b.profile.sizeGB
    )[0]?.name || scored[scored.length - 1]?.name || null

    return {
      planner:   bestPlanner,
      responder: bestBySize,
      coder:     bestCoder,
      fast:      bestFast,
      all:       chatModels.map(m => m.name),
    }
  } catch {
    return emptyDiscovery()
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function getProfile(modelName: string): ModelProfile {
  const key = Object.keys(MODEL_PROFILES).find(k =>
    modelName.toLowerCase().startsWith(k)
  )
  return key ? MODEL_PROFILES[key] : { sizeGB: 4, tier: 'medium', strengths: ['chat'] }
}

function emptyDiscovery(): DiscoveredModels {
  return { planner: null, responder: null, coder: null, fast: null, all: [] }
}

// ── Timeout scaling by model size ───────────────────────────────
// gemma4:e4b / 70b models need up to 2 min on first token generation.

export function getOllamaTimeout(modelName: string): number {
  const n = modelName.toLowerCase()
  if (n.includes('70b') || n.includes('e4b') || n.includes('34b')) return 120_000
  if (n.includes('14b') || n.includes('12b') || n.includes('13b')) return  60_000
  return 30_000  // 8b and smaller
}
