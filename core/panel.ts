// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/panel.ts — Phase 4 of Prompt 9.
//
// Two pure renderers:
//   panel()  — double-line box with optional title + body sections
//   table()  — compact Unicode table with typed column defs
//
// All widths use visLen() to strip ANSI codes before measuring,
// so colored cell content pads correctly.

import { COLORS, fg, bg, RST, BOLD, DIM, paint } from './theme'

// ── ANSI strip / visLen ───────────────────────────────────────────────────────

const ANSI_RE = /\x1b\[[0-9;]*m/g

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}

export function visLen(s: string): number {
  return stripAnsi(s).length
}

// ── Terminal width ────────────────────────────────────────────────────────────

export function cols(): number {
  return process.stdout.columns || 80
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export interface PanelOpts {
  /** Panel title shown in top border. */
  title?:   string
  /** Body lines (may contain ANSI). */
  lines:    string[]
  /** Total outer width (defaults to terminal width - 2). */
  width?:   number
  /** Accent color hex for border (defaults to orange). */
  accent?:  string
}

/**
 * Render a double-line bordered box.
 *
 * ```
 * ╔═ ▲IDEN Help ══════════╗
 * ║  line1                ║
 * ╚═══════════════════════╝
 * ```
 */
export function panel(opts: PanelOpts): string {
  const { title, lines, accent = COLORS.orange } = opts
  const width  = opts.width ?? Math.max(50, Math.min(cols() - 2, 100))
  const inner  = width - 4   // 2 border chars + 2 padding spaces
  const acc    = fg(accent)
  const border = (s: string) => `${acc}${s}${RST}`

  // Top border
  let top: string
  if (title) {
    const titleStr  = ` ${BOLD}${title}${RST}${acc} `
    const titleVis  = visLen(titleStr)
    const fillRight = Math.max(0, width - 1 - titleVis)
    top = border(`╔═`) + titleStr + border(`${'═'.repeat(fillRight)}╗`)
  } else {
    top = border(`╔${'═'.repeat(inner + 4)}╗`)
  }

  // Body lines
  const bodyLines = lines.map(line => {
    const vl      = visLen(line)
    const pad     = Math.max(0, inner - vl)
    return `${border('║')}  ${line}${' '.repeat(pad)}  ${border('║')}`
  })

  // Bottom border
  const bottom = border(`╚${'═'.repeat(inner + 4)}╝`)

  return [top, ...bodyLines, bottom].join('\n')
}

// ── Table ─────────────────────────────────────────────────────────────────────

export type ColAlign = 'left' | 'right' | 'center'

export interface ColDef {
  header:  string
  /** Fixed char width (visible). If omitted, column fills remaining space. */
  width?:  number
  align?:  ColAlign
  /** Pre-color every cell with this hex color. */
  color?:  string
}

function padCell(text: string, width: number, align: ColAlign = 'left'): string {
  const vl  = visLen(text)
  const pad = Math.max(0, width - vl)
  if (align === 'right')  return ' '.repeat(pad) + text
  if (align === 'center') {
    const l = Math.floor(pad / 2)
    const r = pad - l
    return ' '.repeat(l) + text + ' '.repeat(r)
  }
  return text + ' '.repeat(pad)
}

/**
 * Render a Unicode box-drawing table.
 *
 * ```
 * ┏━━━━┳━━━━━━━━━━━┳━━━━━━━━━━┓
 * ┃  # ┃ Name      ┃ Desc     ┃
 * ┣━━━━╋━━━━━━━━━━━╋━━━━━━━━━━┫
 * ┃  1 ┃ tool_name ┃ desc...  ┃
 * ┗━━━━┻━━━━━━━━━━━┻━━━━━━━━━━┛
 * ```
 */
export function table(cols_: ColDef[], rows: string[][]): string {
  const termW = cols() - 2

  // Resolve flex column (the one without a fixed width)
  const fixedTotal = cols_.reduce((n, c) => n + (c.width ?? 0) + 1, 1) // separators
  const flexIdx    = cols_.findIndex(c => c.width === undefined)
  const resolvedCols: ColDef[] = cols_.map((c, i) => {
    if (i !== flexIdx || c.width !== undefined) return c
    return { ...c, width: Math.max(8, termW - fixedTotal) }
  })

  const widths = resolvedCols.map(c => c.width!)

  // Border helpers
  const ac  = fg(COLORS.orange)
  const b   = (s: string) => `${ac}${s}${RST}`
  const sep = (l: string, m: string, r: string, bar: string) =>
    b(l) + widths.map(w => b(bar.repeat(w + 2))).join(b(m)) + b(r)

  const topRow    = sep('┏', '┳', '┓', '━')
  const midRow    = sep('┣', '╋', '┫', '━')
  const botRow    = sep('┗', '┻', '┛', '━')

  // Header row
  const headerCells = resolvedCols.map((c, i) =>
    paint.invOrange(` ${padCell(c.header, widths[i])} `)
  )
  const headerRow = b('┃') + headerCells.join(b('┃')) + b('┃')

  // Data rows
  const dataRows = rows.map(row => {
    const cells = resolvedCols.map((c, i) => {
      const raw  = row[i] ?? ''
      const cell = c.color ? `${fg(c.color)}${raw}${RST}` : raw
      return ` ${padCell(cell, widths[i])} `
    })
    return b('┃') + cells.join(b('┃')) + b('┃')
  })

  return [topRow, headerRow, midRow, ...dataRows, botRow].join('\n')
}
