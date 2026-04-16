// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/spinner.ts — Phase 6 of Prompt 9.
//
// Pulsing triangle spinner using ▲ △ alternation.
// Hides cursor on start, restores on stop.

import { fg, RST, COLORS } from './theme'

/** Animation frames: solid ↔ outline triangle in orange. */
export const SPINNER_FRAMES: string[] = [
  `${fg(COLORS.orange)}▲${RST}`,
  `${fg(COLORS.dim ?? '#666666')}△${RST}`,
  `${fg(COLORS.orange)}▲${RST}`,
  `${fg(COLORS.dim ?? '#666666')}△${RST}`,
]

/** Raw frame strings for legacy callers that manage their own color. */
export const SPINNER_FRAMES_RAW = ['▲', '△', '▲', '△']

// ── Spinner class ─────────────────────────────────────────────────────────────

export class Spinner {
  private timer:   ReturnType<typeof setInterval> | null = null
  private frame    = 0
  private label:   string

  constructor(label = '') {
    this.label = label
  }

  start(intervalMs = 150): void {
    if (this.timer) return
    process.stdout.write('\x1b[?25l') // hide cursor
    this.render()
    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % SPINNER_FRAMES.length
      this.render()
    }, intervalMs)
  }

  private render(): void {
    const f = SPINNER_FRAMES[this.frame]
    process.stdout.write(`\r\x1b[K  ${f}  ${this.label}`)
  }

  /** Update the label while running. */
  update(label: string): void {
    this.label = label
    this.render()
  }

  stop(finalLine = ''): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    process.stdout.write('\r\x1b[K') // clear line
    process.stdout.write('\x1b[?25h') // restore cursor
    if (finalLine) process.stdout.write(finalLine + '\n')
  }
}
