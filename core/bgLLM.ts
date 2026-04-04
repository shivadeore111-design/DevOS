// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/bgLLM.ts — Lightweight LLM caller for background agents.
// Tries Cerebras first (fast, free), falls back to Ollama.
// All calls tracked as system cost (not counted toward user budget).
// Separated from agentLoop.ts to avoid circular imports.

import fs   from 'fs'
import path from 'path'
import { costTracker } from './costTracker'

const CONFIG_PATH = path.join(process.cwd(), 'config', 'devos.config.json')

// ── Config helpers ─────────────────────────────────────────────

function getCerebrasKey(): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as any
    const api = (cfg.providers?.apis ?? []).find((a: any) => a.provider === 'cerebras' && a.enabled)
    if (!api) return ''
    const key = api.key as string
    return key.startsWith('env:')
      ? (process.env[key.replace('env:', '')] || '')
      : key
  } catch {
    return ''
  }
}

function getOllamaModel(): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as any
    return cfg.model?.activeModel || 'mistral:7b'
  } catch {
    return 'mistral:7b'
  }
}

// ── callBgLLM ─────────────────────────────────────────────────
// Simple single-turn LLM call for background agents.
// Uses Cerebras → Ollama fallback. Always system cost.

export async function callBgLLM(
  prompt:   string,
  traceId?: string,
): Promise<string> {
  // Try Cerebras
  const key = getCerebrasKey()
  if (key) {
    try {
      const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model:      'llama3.1-8b',
          messages:   [{ role: 'user', content: prompt }],
          stream:     false,
          max_tokens: 2000,
        }),
        signal: AbortSignal.timeout(30_000),
      })
      if (r.ok) {
        const d = await r.json() as any
        const text         = d?.choices?.[0]?.message?.content || ''
        const inputTokens  = d?.usage?.prompt_tokens     ?? 0
        const outputTokens = d?.usage?.completion_tokens ?? 0
        try {
          costTracker.trackUsage('cerebras', 'llama3.1-8b', inputTokens, outputTokens, traceId, true)
        } catch {}
        if (text) return text
      }
    } catch {}
  }

  // Fallback: Ollama
  try {
    const ollamaModel = getOllamaModel()
    const r = await fetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:   ollamaModel,
        stream:  false,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (r.ok) {
      const d    = await r.json() as any
      const text = d?.message?.content || ''
      try {
        costTracker.trackUsage(
          'ollama', ollamaModel,
          d?.prompt_eval_count ?? 0,
          d?.eval_count        ?? 0,
          traceId, true,
        )
      } catch {}
      return text
    }
  } catch (e: any) {
    console.error('[bgLLM] Ollama fallback failed:', e.message)
  }

  return ''
}
