// ============================================================
// Aiden Audit Test Suite — Main Runner
// scripts/test-suite.ts
//
// Usage:
//   npx ts-node scripts/test-suite.ts           → Phase 1 only  (free)
//   npx ts-node scripts/test-suite.ts --full    → Phase 1 + Phase 2
//   npx ts-node scripts/test-suite.ts --api     → Phase 2 only
//   npx ts-node scripts/test-suite.ts --no-save → skip report write
// ============================================================

import { saveReport, C, GroupSummary, ReportMeta } from './test-suite/utils'
import { runPhase1 }                               from './test-suite/no-api'
import { runPhase2 }                               from './test-suite/api'
import fs   from 'fs'
import path from 'path'

// ── Parse args ────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2)
const doFull  = args.includes('--full')
const apiOnly = args.includes('--api')
const noSave  = args.includes('--no-save')

const runP1 = !apiOnly
const runP2 = doFull || apiOnly

// ── Version ───────────────────────────────────────────────────────────────────

function getVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'))
    return pkg.version ?? 'unknown'
  } catch { return 'unknown' }
}

// ── Print banner ──────────────────────────────────────────────────────────────

function printBanner(version: string) {
  const phase = runP1 && runP2 ? 'Phase 1 + 2' : runP2 ? 'Phase 2 (API)' : 'Phase 1 (no-API)'
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.cyan}║       Aiden v${version.padEnd(5)} — Audit Test Suite      ║${C.reset}`)
  console.log(`${C.bold}${C.cyan}║  ${phase.padEnd(44)}║${C.reset}`)
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════╝${C.reset}\n`)
}

// ── Print group summary ───────────────────────────────────────────────────────

function printGroupSummary(groups: GroupSummary[]) {
  console.log(`\n${C.bold}Group Summary${C.reset}`)
  console.log('─'.repeat(60))
  for (const g of groups) {
    const p = g.pass  > 0 ? `${C.green}${g.pass} pass${C.reset}`  : `${C.dim}0 pass${C.reset}`
    const f = g.fail  > 0 ? `  ${C.red}${g.fail} fail${C.reset}`  : ''
    const w = g.warn  > 0 ? `  ${C.yellow}${g.warn} warn${C.reset}` : ''
    const s = g.skip  > 0 ? `  ${C.dim}${g.skip} skip${C.reset}`  : ''
    const label = `[${g.id}] ${g.name}`
    console.log(`  ${C.bold}${label.padEnd(34)}${C.reset} ${p}${f}${w}${s}`)
  }
  console.log('─'.repeat(60))
}

// ── Print top failures ────────────────────────────────────────────────────────

function printTopFailures(groups: GroupSummary[]) {
  const fails = groups.flatMap(g => g.results).filter(r => r.verdict === 'FAIL')
  if (fails.length === 0) return
  const top = fails.slice(0, 10)
  console.log(`\n${C.bold}${C.red}Top Failures (${fails.length} total)${C.reset}`)
  console.log('─'.repeat(60))
  for (const r of top) {
    console.log(`  ${C.red}❌${C.reset} ${C.bold}[${r.id}]${C.reset} ${r.desc}`)
    if (r.detail) console.log(`       ${C.grey}${r.detail}${C.reset}`)
  }
  console.log('─'.repeat(60))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const version   = getVersion()
  const startTime = Date.now()
  printBanner(version)

  const allGroups: GroupSummary[] = []
  let costUsd: number | undefined

  // Phase 1
  if (runP1) {
    const p1groups = await runPhase1()
    allGroups.push(...p1groups)
  }

  // Phase 2
  if (runP2) {
    const { groups, costUsd: cost } = await runPhase2()
    allGroups.push(...groups)
    costUsd = cost
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalPass = allGroups.reduce((n, g) => n + g.pass, 0)
  const totalFail = allGroups.reduce((n, g) => n + g.fail, 0)
  const totalWarn = allGroups.reduce((n, g) => n + g.warn, 0)
  const totalSkip = allGroups.reduce((n, g) => n + g.skip, 0)
  const totalMs   = Date.now() - startTime

  printGroupSummary(allGroups)
  printTopFailures(allGroups)

  // ── Final verdict ─────────────────────────────────────────────────────────
  console.log()
  const verdict = totalFail === 0
    ? `${C.bold}${C.green}✅  ALL CLEAR — ${totalPass} passed, ${totalWarn} warnings, ${totalSkip} skipped${C.reset}`
    : `${C.bold}${C.red}❌  ${totalFail} FAILED — ${totalPass} passed, ${totalWarn} warnings, ${totalSkip} skipped${C.reset}`
  console.log(`  ${verdict}`)
  if (costUsd !== undefined) {
    console.log(`  ${C.cyan}Phase 2 API cost: \$${costUsd.toFixed(4)}${C.reset}`)
  }
  console.log(`  ${C.grey}Total time: ${totalMs}ms${C.reset}\n`)

  // ── Save report ───────────────────────────────────────────────────────────
  if (!noSave && allGroups.length > 0) {
    const timestamp = new Date().toISOString()
    const phase     = runP1 && runP2 ? 'full' : runP2 ? 'api' : 'no-api'
    const meta: ReportMeta = {
      version,
      timestamp,
      phase,
      totalPass,
      totalFail,
      totalWarn,
      totalSkip,
      totalMs,
      ...(costUsd !== undefined ? { costUsd } : {}),
    }
    const { mdPath, jsonPath } = saveReport(allGroups, meta)
    console.log(`  ${C.bold}Report saved:${C.reset}`)
    console.log(`    MD  → ${mdPath}`)
    console.log(`    JSON→ ${jsonPath}\n`)
  }

  process.exit(totalFail > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(`${C.red}Fatal error:${C.reset}`, err)
  process.exit(2)
})
