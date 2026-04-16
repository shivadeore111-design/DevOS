// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/statusBar.ts — Phase 3 of Prompt 9.
//
// Renders a compact one-line status bar after each AI turn:
//
//   ▲ groq · llama-3.3-70b │ 12.4K/128K │ ▓▓▓░░░░░░░ 10% │ 23m │ ●3
//
// All values come from a StatusBarOpts struct so the renderer
// is pure (no global state reads).

import { MARKS, COLORS, fg, RST, DIM, BOLD, paint } from './theme'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StatusBarOpts {
  provider:    string
  model:       string
  /** Raw character count used so far in session context. */
  ctxUsed:     number
  /** Max context window in characters (default 160 000). */
  ctxMax:      number
  /** Pre-computed 0-99 percentage (avoids double-division). */
  ctxPercent:  number
  /** Total elapsed ms since session start. */
  elapsedMs:   number
  /** Number of in-flight async tasks (0 = no indicator). */
  asyncCount:  number
  privateMode?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BAR_WIDTH = 10

/** Build a filled/empty bar string of fixed width. */
function ctxBar(pct: number): string {
  const filled = Math.round((pct / 100) * BAR_WIDTH)
  return '▓'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
}

/** Color the context percentage: green < 60%, yellow < 85%, red ≥ 85%. */
function ctxColor(pct: number): string {
  if (pct < 60) return fg(COLORS.success)
  if (pct < 85) return fg(COLORS.warning)
  return fg(COLORS.error)
}

/** Format elapsed ms as e.g. "2s", "1m 23s", "1h 2m". */
function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60)   return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60)   return rem > 0 ? `${m}m ${rem}s` : `${m}m`
  const h = Math.floor(m / 60)
  const remM = m % 60
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`
}

/** Compact human-readable context size: "12.4K", "1.2M". */
function fmtCtx(chars: number): string {
  if (chars < 1000)        return `${chars}`
  if (chars < 1_000_000)   return `${(chars / 1000).toFixed(1)}K`
  return `${(chars / 1_000_000).toFixed(1)}M`
}

/** Format max context window: 160 000 → "160K". */
function fmtMax(chars: number): string {
  if (chars < 1000)        return `${chars}`
  if (chars < 1_000_000)   return `${Math.round(chars / 1000)}K`
  return `${(chars / 1_000_000).toFixed(1)}M`
}

// ── Renderer ──────────────────────────────────────────────────────────────────

/**
 * Render the one-line status bar.
 * Returns the string WITHOUT a trailing newline.
 */
export function renderStatusBar(opts: StatusBarOpts): string {
  const {
    provider, model, ctxUsed, ctxMax, ctxPercent,
    elapsedMs, asyncCount, privateMode,
  } = opts

  const SEP  = `${DIM} │ ${RST}`
  const triC = `${fg(COLORS.orange)}${MARKS.TRI}${RST}`

  // Provider · model
  const providerModel = `${triC} ${DIM}${provider} · ${RST}${BOLD}${model}${RST}`

  // Context bar
  const cc    = ctxColor(ctxPercent)
  const ctxPart = `${cc}${ctxBar(ctxPercent)}${RST} ${cc}${fmtCtx(ctxUsed)}/${fmtMax(ctxMax)}${RST}`

  // Elapsed
  const elapsed = `${DIM}${fmtElapsed(elapsedMs)}${RST}`

  // Async tasks
  const asyncPart = asyncCount > 0
    ? `${SEP}${fg(COLORS.warning)}${MARKS.DOT}${asyncCount}${RST}`
    : ''

  // Private mode tag
  const privPart = privateMode ? `${SEP}${fg(COLORS.warning)}[private]${RST}` : ''

  return `  ${providerModel}${SEP}${ctxPart}${SEP}${elapsed}${asyncPart}${privPart}`
}
