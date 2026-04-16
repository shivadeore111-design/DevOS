// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/theme.ts — Phase 1 of Prompt 9.
//
// Single source of truth for all ▲IDEN visual tokens.
// Raw ANSI 24-bit escape codes only — no chalk, no ora (ESM-only).
// CommonJS-safe.

// ── Marks ─────────────────────────────────────────────────────────────────────

export const MARKS = {
  TRI:        '▲',
  TRI_O:      '△',
  ARROW:      '▸',
  DOT:        '●',
  DOT_O:      '○',
  DIAMOND:    '◆',
  DASH:       '─',
  // Category icons for /tools table
  CAT_FILE:   '≡',
  CAT_WEB:    '⊕',
  CAT_CODE:   '⚙',
  CAT_MEMORY: '◎',
  CAT_SYSTEM: '⬡',
  CAT_MEDIA:  '◈',
  CAT_DATA:   '◉',
  CAT_AI:     '◍',
} as const

// ── Colors ────────────────────────────────────────────────────────────────────

export const COLORS = {
  orange:  '#FF6B35',
  bgBase:  '#0D0D0D',
  dim:     '#666666',
  success: '#4CAF50',
  error:   '#F44336',
  warning: '#FFC107',
  white:   '#FFFFFF',
  blue:    '#5B9CF6',
  cyan:    '#4DD0E1',
  gold:    '#FFB800',
  red:     '#FF4D4D',
} as const

// ── ANSI primitives ───────────────────────────────────────────────────────────

/** Parse a '#RRGGBB' hex string into [r, g, b]. */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** 24-bit foreground color escape. */
export function fg(color: string): string {
  const [r, g, b] = hexToRgb(color)
  return `\x1b[38;2;${r};${g};${b}m`
}

/** 24-bit background color escape. */
export function bg(color: string): string {
  const [r, g, b] = hexToRgb(color)
  return `\x1b[48;2;${r};${g};${b}m`
}

export const RST  = '\x1b[0m'
export const BOLD = '\x1b[1m'
export const DIM  = '\x1b[2m'

export const ANSI = { fg, bg, RST, BOLD, DIM }

// ── Paint helpers ─────────────────────────────────────────────────────────────

function wrap(color: string) {
  return (s: string) => `${fg(color)}${s}${RST}`
}

export const paint = {
  orange:    wrap(COLORS.orange),
  dim:       (s: string) => `${DIM}${s}${RST}`,
  success:   wrap(COLORS.success),
  error:     wrap(COLORS.error),
  warning:   wrap(COLORS.warning),
  bold:      (s: string) => `${BOLD}${s}${RST}`,
  white:     wrap(COLORS.white),
  blue:      wrap(COLORS.blue),
  cyan:      wrap(COLORS.cyan),
  gold:      wrap(COLORS.gold),
  red:       wrap(COLORS.red),
  /** Inverse orange — orange background with dark text. */
  invOrange: (s: string) => `${bg(COLORS.orange)}${fg(COLORS.bgBase)}${s}${RST}`,
}

// ── Shorthand aliases ─────────────────────────────────────────────────────────

export const tri       = MARKS.TRI
export const triOrange = (): string => paint.orange(MARKS.TRI)
