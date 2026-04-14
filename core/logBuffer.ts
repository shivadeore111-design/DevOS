// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/logBuffer.ts — In-process circular log buffer with
// console.log interception.  Parses [Tag] prefixes into
// source labels and classifies log level from keywords.

// ── Types ──────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string   // ISO-8601
  level:     'info' | 'warn' | 'error' | 'debug'
  source:    string   // e.g. "LLM", "Tool", "Memory" …
  message:   string
}

// ── LogBuffer class ────────────────────────────────────────────

export class LogBuffer {
  private entries: LogEntry[] = []
  private readonly maxSize: number

  constructor(maxSize = 500) {
    this.maxSize = maxSize
  }

  add(entry: LogEntry): void {
    this.entries.push(entry)
    if (this.entries.length > this.maxSize) {
      this.entries.shift()   // drop oldest
    }
  }

  /** Return the most-recent `n` entries (default: all). */
  getRecent(n?: number): LogEntry[] {
    if (n === undefined || n >= this.entries.length) return [...this.entries]
    return this.entries.slice(this.entries.length - n)
  }

  clear(): void {
    this.entries = []
  }

  get size(): number {
    return this.entries.length
  }
}

// ── Singleton ─────────────────────────────────────────────────

export const logBuffer = new LogBuffer(500)

// ── Console.log interception ──────────────────────────────────
// Patches console.log / warn / error so every call is also
// stored in logBuffer.  The original method is still called.
//
// Format recognised: "[Tag] rest of message"
// Anything matching that pattern has its Tag extracted as the
// `source`.  All other messages use source "System".

const _TAG_RE = /^\[([^\]]{1,30})\]\s*/

function extractSource(msg: string): { source: string; message: string } {
  const m = msg.match(_TAG_RE)
  if (m) return { source: m[1], message: msg.slice(m[0].length) }
  return { source: 'System', message: msg }
}

function classifyLevel(
  consoleMethod: 'log' | 'warn' | 'error',
  msg: string,
): LogEntry['level'] {
  if (consoleMethod === 'error') return 'error'
  if (consoleMethod === 'warn')  return 'warn'
  const lower = msg.toLowerCase()
  if (lower.includes('error') || lower.includes('fail')) return 'error'
  if (lower.includes('warn'))                             return 'warn'
  if (lower.includes('debug') || lower.includes('trace')) return 'debug'
  return 'info'
}

function intercept(method: 'log' | 'warn' | 'error'): void {
  const original = console[method].bind(console)
  console[method] = (...args: any[]) => {
    original(...args)   // always pass through

    try {
      const raw   = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
      const { source, message } = extractSource(raw)
      logBuffer.add({
        timestamp: new Date().toISOString(),
        level:     classifyLevel(method, raw),
        source,
        message,
      })
    } catch {
      // never let buffer errors crash the process
    }
  }
}

intercept('log')
intercept('warn')
intercept('error')
