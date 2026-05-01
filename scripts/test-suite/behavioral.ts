import 'dotenv/config'

// ============================================================
// Aiden Layer 2 Behavioral Audit Suite
// scripts/test-suite/behavioral.ts
//
// Usage:
//   npx ts-node scripts/test-suite/behavioral.ts            → full run
//   npx ts-node scripts/test-suite/behavioral.ts --dry-run  → verify no crashes
//   npx ts-node scripts/test-suite/behavioral.ts --no-save  → skip report write
//   npx ts-node scripts/test-suite/behavioral.ts --cat B1   → single category
//
// 50 prompts, 10 categories, real side-effect verification.
// ============================================================

import * as fs   from 'fs'
import * as path from 'path'
import { C, GroupSummary, TestResult, saveReport, printResult } from './utils'
import { startServer, stopServer } from './server-control'

// ── Import categories ─────────────────────────────────────────────────────────
import * as cat01 from './behavioral/01-tool-honesty'
import * as cat02 from './behavioral/02-file-ops'
import * as cat03 from './behavioral/03-web-research'
import * as cat04 from './behavioral/04-system-control'
import * as cat05 from './behavioral/05-memory'
import * as cat06 from './behavioral/06-multi-step'
import * as cat07 from './behavioral/07-safety'
import * as cat08 from './behavioral/08-realtime-state'
import * as cat09 from './behavioral/09-subagent'
import * as cat10 from './behavioral/10-skills-usecases'

// ── Args ──────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2)
const isDry   = args.includes('--dry-run')
const noSave  = args.includes('--no-save')
const catArg  = args.find(a => /^B\d+$/.test(a))  // e.g. --cat B3 or just B3

const ALL_CATEGORIES: { id: string; runner: () => Promise<GroupSummary> }[] = [
  { id: 'B1',  runner: cat01.run },
  { id: 'B2',  runner: cat02.run },
  { id: 'B3',  runner: cat03.run },
  { id: 'B4',  runner: cat04.run },
  { id: 'B5',  runner: cat05.run },
  { id: 'B6',  runner: cat06.run },
  { id: 'B7',  runner: cat07.run },
  { id: 'B8',  runner: cat08.run },
  { id: 'B9',  runner: cat09.run },
  { id: 'B10', runner: cat10.run },
]

const CATEGORY_NAMES: Record<string, string> = {
  B1:  'Tool Dispatch Honesty',
  B2:  'File Operations',
  B3:  'Web Research',
  B4:  'System Control',
  B5:  'Memory Continuity',
  B6:  'Multi-Step Plans',
  B7:  'Safety / Refusals',
  B8:  'Real-Time State',
  B9:  'Subagent / Delegation',
  B10: 'Skills / Use Cases',
}

// ── Cost estimation (rough: 3 Aiden turns/prompt × $0.003/turn) ───────────────
const EST_COST_PER_PROMPT = 0.003
const HARD_CAP_USD        = 2.00
let   promptsRun          = 0

function estimatedCost(): number { return promptsRun * EST_COST_PER_PROMPT }
function overBudget(): boolean   { return estimatedCost() > HARD_CAP_USD }

// ── Banner ────────────────────────────────────────────────────────────────────

function printBanner() {
  const mode = isDry ? 'DRY RUN' : catArg ? `Single: ${catArg}` : 'Full Suite (50 prompts)'
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════╗${C.reset}`)
  console.log(`${C.bold}${C.cyan}║   Aiden Layer 2 — Behavioral Audit Suite         ║${C.reset}`)
  console.log(`${C.bold}${C.cyan}║   ${mode.padEnd(46)}║${C.reset}`)
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════╝${C.reset}\n`)
}

// ── Summary table ─────────────────────────────────────────────────────────────

function printSummaryTable(groups: GroupSummary[]) {
  console.log(`\n${C.bold}═══ Category Summary ═══${C.reset}`)
  console.log('─'.repeat(72))
  const header = `  ${'Cat'.padEnd(6)} ${'Name'.padEnd(24)} ${'Pass'.padEnd(6)} ${'Rough'.padEnd(7)} ${'Fail'.padEnd(6)} ${'Skip'.padEnd(6)}`
  console.log(`${C.bold}${header}${C.reset}`)
  console.log('─'.repeat(72))
  for (const g of groups) {
    const pass  = g.pass  > 0 ? `${C.green}${String(g.pass).padEnd(6)}${C.reset}` : `${C.dim}0     ${C.reset}`
    const rough = g.warn  > 0 ? `${C.yellow}${String(g.warn).padEnd(7)}${C.reset}` : `${C.dim}0      ${C.reset}`
    const fail  = g.fail  > 0 ? `${C.red}${String(g.fail).padEnd(6)}${C.reset}`   : `${C.dim}0     ${C.reset}`
    const skip  = g.skip  > 0 ? `${C.dim}${String(g.skip).padEnd(6)}${C.reset}`   : `${C.dim}0     ${C.reset}`
    console.log(`  ${C.bold}${g.id.padEnd(6)}${C.reset} ${(CATEGORY_NAMES[g.id] || g.name).padEnd(24)} ${pass}${rough}${fail}${skip}`)
  }
  console.log('─'.repeat(72))
}

// ── Top issues ────────────────────────────────────────────────────────────────

interface Issue {
  id:       string
  group:    string
  desc:     string
  verdict:  string
  detail:   string
  severity: 'BLOCKER' | 'MAJOR' | 'MINOR' | 'COSMETIC'
}

function classifyIssues(groups: GroupSummary[]): Issue[] {
  const issues: Issue[] = []
  for (const g of groups) {
    for (const r of g.results) {
      if (r.verdict === 'PASS') continue
      const detail = r.detail ?? ''
      const isDangerous = detail.startsWith('DANGEROUS')

      let severity: Issue['severity']
      if (isDangerous || g.id === 'B7') {
        severity = 'BLOCKER'
      } else if (['B1','B2','B4','B5','B6'].includes(g.id) && r.verdict === 'FAIL') {
        severity = 'MAJOR'
      } else if (r.verdict === 'FAIL') {
        severity = 'MINOR'
      } else {
        severity = 'COSMETIC'
      }

      issues.push({ id: r.id, group: g.id, desc: r.desc, verdict: r.verdict, detail, severity })
    }
  }
  // Sort: BLOCKER > MAJOR > MINOR > COSMETIC, then by group
  const rank = { BLOCKER: 0, MAJOR: 1, MINOR: 2, COSMETIC: 3 }
  return issues.sort((a,b) => rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id))
}

function printTopIssues(issues: Issue[]) {
  if (issues.length === 0) { console.log(`\n  ${C.green}${C.bold}No issues found!${C.reset}`); return }
  const top = issues.slice(0, 15)
  console.log(`\n${C.bold}Top ${top.length} Issues (of ${issues.length} total)${C.reset}`)
  console.log('─'.repeat(72))
  for (const i of top) {
    const sev = i.severity === 'BLOCKER' ? `${C.red}[BLOCKER]${C.reset}` :
                i.severity === 'MAJOR'   ? `${C.yellow}[MAJOR]${C.reset}` :
                i.severity === 'MINOR'   ? `${C.cyan}[MINOR]${C.reset}` :
                                           `${C.dim}[COSMETIC]${C.reset}`
    const ver = i.verdict === 'FAIL' ? `${C.red}FAIL${C.reset}` : `${C.yellow}WARN${C.reset}`
    console.log(`  ${sev} ${C.bold}[${i.id}]${C.reset} ${ver} — ${i.desc}`)
    if (i.detail) console.log(`         ${C.grey}${i.detail.slice(0, 100)}${C.reset}`)
  }
  console.log('─'.repeat(72))
}

// ── Extended report format for behavioral ─────────────────────────────────────

function saveBehavioralReport(groups: GroupSummary[], meta: {
  version: string; timestamp: string; totalMs: number;
  totalPass: number; totalFail: number; totalWarn: number; totalSkip: number;
  estimatedCostUsd: number; issues: Issue[];
}): { mdPath: string; jsonPath: string } {
  const dir    = path.join(process.cwd(), 'docs', 'test-reports')
  fs.mkdirSync(dir, { recursive: true })
  const slug   = meta.timestamp.replace(/[:.]/g, '-').replace('T', '_')
  const mdPath  = path.join(dir, `behavioral-${slug}.md`)
  const jsonPath = path.join(dir, `behavioral-${slug}.json`)

  const allResults = groups.flatMap(g => g.results)

  const lines = [
    `# Aiden Behavioral Audit Report — v${meta.version}`,
    '',
    `**Suite:** Layer 2 Behavioral (50 prompts, 10 categories)  `,
    `**Date:** ${meta.timestamp}  `,
    `**Result:** ${meta.totalPass} pass / ${meta.totalFail} fail / ${meta.totalWarn} rough / ${meta.totalSkip} skip  `,
    `**Duration:** ${(meta.totalMs / 1000).toFixed(1)}s  `,
    `**Estimated cost:** ~\$${meta.estimatedCostUsd.toFixed(4)}  `,
    '',
    '## Category Summary',
    '',
    '| Category | Name | Pass | Rough | Fail | Skip |',
    '|----------|------|------|-------|------|------|',
    ...groups.map(g => `| ${g.id} | ${CATEGORY_NAMES[g.id] || g.name} | ${g.pass} | ${g.warn} | ${g.fail} | ${g.skip} |`),
    '',
    '## Top Issues by Severity',
    '',
    ...meta.issues.slice(0, 15).map(i =>
      `- **[${i.severity}]** \`${i.id}\` ${i.desc}: ${i.detail.slice(0, 120)}`
    ),
    '',
    '## All Results',
    '',
    '| ID | Category | Description | Verdict | ms | Detail |',
    '|----|----------|-------------|---------|-----|--------|',
    ...allResults.map(r =>
      `| ${r.id} | ${r.group} | ${r.desc} | **${r.verdict}** | ${r.durationMs} | ${(r.detail ?? '').replace(/\|/g,'│').slice(0, 80)} |`
    ),
  ]

  fs.writeFileSync(mdPath,   lines.join('\n'), 'utf-8')
  fs.writeFileSync(jsonPath, JSON.stringify({ meta, groups }, null, 2), 'utf-8')
  return { mdPath, jsonPath }
}

// ── Dry run ───────────────────────────────────────────────────────────────────

async function dryRun() {
  console.log(`${C.yellow}DRY RUN — verifying imports and structure only${C.reset}\n`)
  for (const cat of ALL_CATEGORIES) {
    console.log(`  ${C.green}✓${C.reset} ${cat.id} imported: ${CATEGORY_NAMES[cat.id]}`)
  }
  console.log(`\n  ${C.green}✓${C.reset} server-control imported`)
  console.log(`  ${C.green}✓${C.reset} All 10 categories verified`)
  console.log(`\n${C.bold}Dry run complete — no crashes${C.reset}\n`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const version   = (() => { try { return JSON.parse(fs.readFileSync('package.json','utf-8')).version } catch { return 'unknown' } })()
  const startTime = Date.now()

  printBanner()

  if (isDry) { await dryRun(); return }

  // ── Start server ──────────────────────────────────────────────────────────
  console.log(`${C.bold}Starting Aiden server...${C.reset}`)
  try {
    await startServer()
  } catch (e: any) {
    console.error(`${C.red}Failed to start server: ${e.message}${C.reset}`)
    process.exit(2)
  }

  // ── Run categories ────────────────────────────────────────────────────────
  const cats = catArg
    ? ALL_CATEGORIES.filter(c => c.id === catArg)
    : ALL_CATEGORIES

  if (cats.length === 0) {
    console.error(`${C.red}Unknown category: ${catArg}${C.reset}`)
    await stopServer()
    process.exit(2)
  }

  const allGroups: GroupSummary[] = []

  for (const cat of cats) {
    if (overBudget()) {
      console.error(`\n${C.red}Hard cap exceeded (\$${HARD_CAP_USD}) — aborting remaining categories${C.reset}`)
      break
    }
    try {
      const group = await cat.runner()
      allGroups.push(group)
      promptsRun += group.results.length
    } catch (e: any) {
      console.error(`${C.red}Category ${cat.id} crashed: ${e.message}${C.reset}`)
      allGroups.push({
        id:      cat.id,
        name:    CATEGORY_NAMES[cat.id],
        results: [{ id: `${cat.id}-CRASH`, group: cat.id, desc: 'Category runner crashed', verdict: 'FAIL', durationMs: 0, detail: String(e?.message) }],
        pass: 0, fail: 1, warn: 0, skip: 0,
      })
    }
  }

  // ── Stop server ───────────────────────────────────────────────────────────
  await stopServer()

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalPass = allGroups.reduce((n,g) => n + g.pass, 0)
  const totalFail = allGroups.reduce((n,g) => n + g.fail, 0)
  const totalWarn = allGroups.reduce((n,g) => n + g.warn, 0)
  const totalSkip = allGroups.reduce((n,g) => n + g.skip, 0)
  const totalMs   = Date.now() - startTime

  printSummaryTable(allGroups)

  const issues = classifyIssues(allGroups)
  printTopIssues(issues)

  // ── Final verdict ─────────────────────────────────────────────────────────
  console.log()
  const blockers = issues.filter(i => i.severity === 'BLOCKER').length
  if (blockers > 0) {
    console.log(`  ${C.red}${C.bold}🔴 ${blockers} BLOCKERS — safety or dangerous failures require immediate fix${C.reset}`)
  }
  const verdict = totalFail === 0 && blockers === 0
    ? `${C.green}${C.bold}✅ PASS — ${totalPass} passed, ${totalWarn} rough${C.reset}`
    : `${C.red}${C.bold}❌ ${totalFail} FAILED — ${totalPass} passed, ${totalWarn} rough, ${totalSkip} skipped${C.reset}`
  console.log(`  ${verdict}`)
  console.log(`  ${C.cyan}Estimated cost: ~\$${estimatedCost().toFixed(4)}${C.reset}`)
  console.log(`  ${C.grey}Total time: ${(totalMs/1000).toFixed(1)}s${C.reset}\n`)

  // ── Save report ───────────────────────────────────────────────────────────
  if (!noSave) {
    const { mdPath, jsonPath } = saveBehavioralReport(allGroups, {
      version, timestamp: new Date().toISOString(), totalMs,
      totalPass, totalFail, totalWarn, totalSkip,
      estimatedCostUsd: estimatedCost(), issues,
    })
    console.log(`  ${C.bold}Report saved:${C.reset}`)
    console.log(`    MD   → ${mdPath}`)
    console.log(`    JSON → ${jsonPath}\n`)
  }

  process.exit(totalFail > 0 || blockers > 0 ? 1 : 0)
}

main().catch(e => {
  console.error(`${C.red}Fatal:${C.reset}`, e)
  process.exit(2)
})
