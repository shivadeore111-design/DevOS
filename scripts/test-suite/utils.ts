// ============================================================
// Aiden Audit Test Suite — Shared Utilities
// scripts/test-suite/utils.ts
// ============================================================

import fs   from 'fs'
import path from 'path'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Verdict = 'PASS' | 'FAIL' | 'WARN' | 'SKIP'

export interface TestResult {
  id:         string
  group:      string
  desc:       string
  verdict:    Verdict
  durationMs: number
  detail?:    string
}

export interface GroupSummary {
  id:      string
  name:    string
  results: TestResult[]
  pass:    number
  fail:    number
  warn:    number
  skip:    number
}

export interface ReportMeta {
  version:   string
  timestamp: string
  phase:     string
  totalPass: number
  totalFail: number
  totalWarn: number
  totalSkip: number
  totalMs:   number
  costUsd?:  number
}

// ── ANSI colours ──────────────────────────────────────────────────────────────

export const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  dim:    '\x1b[2m',
  bold:   '\x1b[1m',
  grey:   '\x1b[90m',
}

// ── Test runners ──────────────────────────────────────────────────────────────

/**
 * Run a test.  fn returning undefined = PASS, returning string = FAIL with
 * that message, throwing = FAIL with error message.
 */
export async function runTest(
  id:    string,
  group: string,
  desc:  string,
  fn:    () => void | string | undefined | Promise<void | string | undefined>,
): Promise<TestResult> {
  const start = Date.now()
  try {
    const result = await Promise.resolve(fn())
    const durationMs = Date.now() - start
    if (typeof result === 'string') {
      return { id, group, desc, verdict: 'FAIL', durationMs, detail: result }
    }
    return { id, group, desc, verdict: 'PASS', durationMs }
  } catch (e: any) {
    return { id, group, desc, verdict: 'FAIL', durationMs: Date.now() - start, detail: String(e?.message ?? e) }
  }
}

/**
 * Like runTest but downgrades failures to WARN (non-critical checks).
 */
export async function runWarn(
  id:    string,
  group: string,
  desc:  string,
  fn:    () => void | string | undefined | Promise<void | string | undefined>,
): Promise<TestResult> {
  const r = await runTest(id, group, desc, fn)
  if (r.verdict === 'FAIL') return { ...r, verdict: 'WARN' }
  return r
}

/** Create a skipped test result. */
export function skip(id: string, group: string, desc: string, reason?: string): TestResult {
  return { id, group, desc, verdict: 'SKIP', durationMs: 0, detail: reason }
}

// ── Summarize a group ─────────────────────────────────────────────────────────

export function summarize(id: string, name: string, results: TestResult[]): GroupSummary {
  return {
    id, name, results,
    pass: results.filter(r => r.verdict === 'PASS').length,
    fail: results.filter(r => r.verdict === 'FAIL').length,
    warn: results.filter(r => r.verdict === 'WARN').length,
    skip: results.filter(r => r.verdict === 'SKIP').length,
  }
}

// ── Console output ────────────────────────────────────────────────────────────

export function printResult(r: TestResult): void {
  const icon = r.verdict === 'PASS' ? `${C.green}✅ PASS${C.reset}`
    : r.verdict === 'WARN'          ? `${C.yellow}⚠️  WARN${C.reset}`
    : r.verdict === 'SKIP'          ? `${C.dim}⏭  SKIP${C.reset}`
    : `${C.red}❌ FAIL${C.reset}`
  const ms  = `${C.grey}(${r.durationMs}ms)${C.reset}`
  const det = r.detail ? `${C.grey} — ${r.detail}${C.reset}` : ''
  console.log(`  ${icon} ${C.dim}[${r.id}]${C.reset} ${r.desc} ${ms}${det}`)
}

// ── Key redaction ─────────────────────────────────────────────────────────────

const KEY_PATTERNS: RegExp[] = [
  // common API key prefixes
  /\b(sk-|gsk_|AIza|boa-|nvapi-|Bearer\s+)[A-Za-z0-9_\-]{8,}/g,
  // env-var references
  /env:[A-Z_]{3,}/g,
]

export function redactKeys(text: string): string {
  let out = text
  for (const p of KEY_PATTERNS) out = out.replace(p, '[REDACTED]')
  return out
}

/** Returns true if any live env-var API key value appears in the text. */
export function hasKeyLeak(text: string): boolean {
  const sensitiveKeys = Object.keys(process.env).filter(k =>
    k.includes('API_KEY') || k.includes('TOKEN') || k.includes('SECRET')
  )
  for (const k of sensitiveKeys) {
    const v = process.env[k]
    if (v && v.length >= 8 && text.includes(v)) return true
  }
  return false
}

// ── Report persistence ────────────────────────────────────────────────────────

export function saveReport(
  groups: GroupSummary[],
  meta:   ReportMeta,
): { mdPath: string; jsonPath: string } {
  const dir = path.join(process.cwd(), 'docs', 'test-reports')
  fs.mkdirSync(dir, { recursive: true })

  const slug    = meta.timestamp.replace(/[:.]/g, '-').replace('T', '_')
  const mdPath  = path.join(dir, `audit-${slug}.md`)
  const jsonPath = path.join(dir, `audit-${slug}.json`)

  const allResults = groups.flatMap(g => g.results)
  const top10Fail  = allResults.filter(r => r.verdict === 'FAIL').slice(0, 10)

  // ── Markdown ───────────────────────────────────────────────────────────────
  const lines: string[] = [
    `# Aiden Audit Report — v${meta.version}`,
    '',
    `**Phase:** ${meta.phase}  `,
    `**Date:** ${meta.timestamp}  `,
    `**Result:** ${meta.totalPass} pass / ${meta.totalFail} fail / ${meta.totalWarn} warn / ${meta.totalSkip} skip  `,
    `**Duration:** ${meta.totalMs}ms  `,
    meta.costUsd !== undefined ? `**API cost:** \$${meta.costUsd.toFixed(4)}  ` : '',
    '',
    '## Group Summary',
    '',
    '| Group | Name | Pass | Fail | Warn | Skip |',
    '|-------|------|------|------|------|------|',
    ...groups.map(g => `| ${g.id} | ${g.name} | ${g.pass} | ${g.fail} | ${g.warn} | ${g.skip} |`),
    '',
    '## All Results',
    '',
    '| ID | Group | Description | Verdict | ms | Detail |',
    '|----|-------|-------------|---------|-----|--------|',
    ...allResults.map(r =>
      `| ${r.id} | ${r.group} | ${r.desc} | **${r.verdict}** | ${r.durationMs} | ${redactKeys(r.detail ?? '')} |`
    ),
  ]

  if (top10Fail.length > 0) {
    lines.push('', '## Top Failures', '')
    for (const r of top10Fail) {
      lines.push(`- **[${r.id}]** ${r.desc}: ${redactKeys(r.detail ?? 'no detail')}`)
    }
  }

  const mdContent = lines.join('\n')

  if (hasKeyLeak(mdContent)) {
    console.error('[report] ⚠️  API key detected in report — forcibly redacted before save')
  }

  fs.writeFileSync(mdPath,   redactKeys(mdContent), 'utf-8')
  fs.writeFileSync(jsonPath, JSON.stringify({ meta, groups }, null, 2), 'utf-8')

  return { mdPath, jsonPath }
}
