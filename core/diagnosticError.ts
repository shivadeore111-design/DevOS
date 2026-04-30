// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/diagnosticError.ts — C4 of v3.19 Phase 3.
// Pure function — no side effects, no imports.

export type DiagnosticInfo = {
  tool: string
  provider?: string
  retries: number
  fallbackTried?: { name: string; outcome: 'success' | 'failure' }
  error: string
  suggestion?: string
}

export function buildDiagnostic(info: DiagnosticInfo): string {
  const lines: string[] = [
    `Couldn't ${info.tool}: ${info.error}`,
    `Provider: ${info.provider ?? 'unknown'}, retries: ${info.retries}`,
  ]
  if (info.fallbackTried) {
    lines.push(`Fell back to ${info.fallbackTried.name} → ${info.fallbackTried.outcome}`)
  }
  if (info.suggestion) {
    lines.push(`Suggestion: ${info.suggestion}`)
  }
  return lines.join('\n')
}
