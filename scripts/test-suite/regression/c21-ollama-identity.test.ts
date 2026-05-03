// ============================================================
// C21 Ollama Identity Context Regression Tests
// scripts/test-suite/regression/c21-ollama-identity.test.ts
//
// Proves C21 fix: SOUL.md ships in npm package, copies on
// first install, protectedContext.ts has MINIMUM_SOUL fallback,
// and direct_response bypasses are eliminated.
//
// All source-text + filesystem checks — no LLM calls.
// ============================================================

import fs   from 'fs'
import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()
const POSTINSTALL_SRC  = fs.readFileSync(path.join(CWD, 'scripts', 'postinstall.js'), 'utf-8')
const SERVER_SRC       = fs.readFileSync(path.join(CWD, 'api', 'server.ts'), 'utf-8')
const PROTCTX_SRC      = fs.readFileSync(path.join(CWD, 'core', 'protectedContext.ts'), 'utf-8')

// ─────────────────────────────────────────────────────────────────────────────
// Group AA — Regression: C21 Ollama identity context injection
// ─────────────────────────────────────────────────────────────────────────────

export async function groupAA(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[AA] Regression — C21 Ollama identity context injection${C.reset}`)
  const results = []

  // ── AA-01: workspace-templates/SOUL.md exists ─────────────────────────────
  results.push(await runTest('AA-01', 'AA',
    'workspace-templates/SOUL.md exists', () => {
      const soulPath = path.join(CWD, 'workspace-templates', 'SOUL.md')
      if (!fs.existsSync(soulPath))
        return 'workspace-templates/SOUL.md not found — must ship in npm package'
    }
  ))

  // ── AA-02: SOUL.md contains "You are Aiden" or equivalent ─────────────────
  results.push(await runTest('AA-02', 'AA',
    'SOUL.md template contains Aiden identity', () => {
      const soulPath = path.join(CWD, 'workspace-templates', 'SOUL.md')
      if (!fs.existsSync(soulPath)) return 'SOUL.md not found'
      const content = fs.readFileSync(soulPath, 'utf-8')
      if (!content.includes('Aiden'))
        return 'SOUL.md does not mention "Aiden"'
    }
  ))

  // ── AA-03: SOUL.md contains honesty rules ─────────────────────────────────
  results.push(await runTest('AA-03', 'AA',
    'SOUL.md template contains honesty rules', () => {
      const soulPath = path.join(CWD, 'workspace-templates', 'SOUL.md')
      if (!fs.existsSync(soulPath)) return 'SOUL.md not found'
      const content = fs.readFileSync(soulPath, 'utf-8').toLowerCase()
      if (!content.includes('never fabricate') && !content.includes('never claim') && !content.includes('never fake'))
        return 'SOUL.md missing honesty rules (no "never fabricate/claim/fake" found)'
    }
  ))

  // ── AA-04: postinstall.js has SOUL.md copy block ──────────────────────────
  results.push(await runTest('AA-04', 'AA',
    'postinstall.js has SOUL.md copy logic', () => {
      if (!POSTINSTALL_SRC.includes('SOUL.md'))
        return 'postinstall.js does not mention SOUL.md'
      if (!POSTINSTALL_SRC.includes('soulSrc') || !POSTINSTALL_SRC.includes('soulDst'))
        return 'postinstall.js missing soulSrc/soulDst variables'
    }
  ))

  // ── AA-05: postinstall.js SOUL.md copy is idempotent ──────────────────────
  results.push(await runTest('AA-05', 'AA',
    'postinstall.js SOUL.md copy is idempotent (checks !existsSync)', () => {
      if (!POSTINSTALL_SRC.includes('!fs.existsSync(soulDst)'))
        return 'postinstall.js SOUL.md copy does not check !fs.existsSync(soulDst)'
    }
  ))

  // ── AA-06: initWorkspaceDefaults has SOUL.md template copy ────────────────
  results.push(await runTest('AA-06', 'AA',
    'api/server.ts initWorkspaceDefaults copies SOUL.md from template', () => {
      if (!SERVER_SRC.includes('soulTarget') || !SERVER_SRC.includes('soulTemplate'))
        return 'initWorkspaceDefaults missing soulTarget/soulTemplate variables'
      if (!SERVER_SRC.includes("'workspace', 'SOUL.md'") && !SERVER_SRC.includes("SOUL.md"))
        return 'initWorkspaceDefaults does not reference SOUL.md'
    }
  ))

  // ── AA-07: protectedContext.ts has MINIMUM_SOUL fallback constant ─────────
  results.push(await runTest('AA-07', 'AA',
    'protectedContext.ts has MINIMUM_SOUL constant', () => {
      if (!PROTCTX_SRC.includes('const MINIMUM_SOUL'))
        return 'MINIMUM_SOUL constant not found in protectedContext.ts'
    }
  ))

  // ── AA-08: protectedContext.ts applies MINIMUM_SOUL when soul is empty ────
  results.push(await runTest('AA-08', 'AA',
    'protectedContext.ts applies MINIMUM_SOUL fallback for empty soul', () => {
      if (!PROTCTX_SRC.includes("key === 'soul' && !content"))
        return 'MINIMUM_SOUL fallback condition not found'
      if (!PROTCTX_SRC.includes('content = MINIMUM_SOUL'))
        return 'MINIMUM_SOUL assignment not found'
    }
  ))

  // ── AA-09: direct_response bypasses eliminated ────────────────────────────
  results.push(await runTest('AA-09', 'AA',
    'direct_response paths route through streamChat (no raw bypass)', () => {
      // The old pattern was: plan.direct_response word-by-word streaming
      // After C21, all paths go through streamChat
      if (SERVER_SRC.includes("plan.direct_response.split(' ')"))
        return 'raw direct_response word-by-word streaming still present — should route through streamChat'
      // Old pattern: fullReply = plan.direct_response (in the non-execution branch)
      if (SERVER_SRC.includes('fullReply = plan.direct_response'))
        return 'fullReply = plan.direct_response assignment still present — should route through streamChat'
    }
  ))

  // ── AA-10: MINIMUM_SOUL contains tool list ────────────────────────────────
  results.push(await runTest('AA-10', 'AA',
    'MINIMUM_SOUL contains real tool names', () => {
      if (!PROTCTX_SRC.includes('shell_exec') || !PROTCTX_SRC.includes('file_write'))
        return 'MINIMUM_SOUL missing tool names (shell_exec, file_write)'
    }
  ))

  // ── AA-11: MINIMUM_SOUL contains honesty rules ───────────────────────────
  results.push(await runTest('AA-11', 'AA',
    'MINIMUM_SOUL contains honesty rules', () => {
      if (!PROTCTX_SRC.includes('Never fabricate') && !PROTCTX_SRC.includes('Never claim actions'))
        return 'MINIMUM_SOUL missing honesty rules'
    }
  ))

  return summarize('AA', 'C21 Ollama identity context injection', results)
}
