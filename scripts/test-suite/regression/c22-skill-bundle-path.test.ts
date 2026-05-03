// ============================================================
// C22 Skill Bundle Path Mismatch Regression Tests
// scripts/test-suite/regression/c22-skill-bundle-path.test.ts
//
// Proves C22 fix: SkillLoader uses AIDEN_USER_DATA fallback
// instead of bare process.cwd(), and initWorkspaceDefaults()
// copies starter skills from workspace-templates/skills/ to
// workspace/skills/learned/ on first boot (idempotent).
//
// All source-text checks — no LLM calls.
// ============================================================

import fs   from 'fs'
import path from 'path'
import { runTest, summarize, printResult, C, GroupSummary } from '../utils'

const CWD = process.cwd()
const SKILLLOADER_SRC = fs.readFileSync(path.join(CWD, 'core', 'skillLoader.ts'), 'utf-8')
const SERVER_SRC      = fs.readFileSync(path.join(CWD, 'api', 'server.ts'), 'utf-8')

// ─────────────────────────────────────────────────────────────────────────────
// Group AB — Regression: C22 Skill bundle path mismatch
// ─────────────────────────────────────────────────────────────────────────────

export async function groupAB(): Promise<GroupSummary> {
  console.log(`\n${C.bold}[AB] Regression — C22 Skill bundle path mismatch${C.reset}`)
  const results = []

  // ── AB-01: SkillLoader uses AIDEN_USER_DATA fallback ─────────────────────
  results.push(await runTest('AB-01', 'AB',
    'SkillLoader constructor uses AIDEN_USER_DATA', () => {
      if (!SKILLLOADER_SRC.includes('process.env.AIDEN_USER_DATA'))
        return 'SkillLoader does not reference AIDEN_USER_DATA — skills will scan wrong dir on npx installs'
    }
  ))

  // ── AB-02: SkillLoader does NOT use bare process.cwd() for skillsDirs ────
  results.push(await runTest('AB-02', 'AB',
    'SkillLoader does not use bare process.cwd() in skillsDirs', () => {
      // The constructor should assign root = AIDEN_USER_DATA || cwd, then use root.
      // Bare process.cwd() inside path.join for skillsDirs is the old bug.
      const constructorMatch = SKILLLOADER_SRC.match(/constructor\(\)[^}]*this\.skillsDirs\s*=\s*\[([\s\S]*?)\]/m)
      if (constructorMatch) {
        const dirsBlock = constructorMatch[1]
        if (dirsBlock.includes('process.cwd()'))
          return 'SkillLoader skillsDirs still uses bare process.cwd() — should use root variable'
      }
    }
  ))

  // ── AB-03: SkillLoader root variable exists ──────────────────────────────
  results.push(await runTest('AB-03', 'AB',
    'SkillLoader constructor defines root variable with AIDEN_USER_DATA', () => {
      const hasRoot = /const\s+root\s*=\s*process\.env\.AIDEN_USER_DATA\s*\|\|\s*process\.cwd\(\)/.test(SKILLLOADER_SRC)
      if (!hasRoot)
        return 'Missing: const root = process.env.AIDEN_USER_DATA || process.cwd()'
    }
  ))

  // ── AB-04: initWorkspaceDefaults has skill copy block using PACKAGE_ROOT ──
  results.push(await runTest('AB-04', 'AB',
    'initWorkspaceDefaults() copies skills from PACKAGE_ROOT/workspace-templates/', () => {
      if (!SERVER_SRC.includes('workspace-templates') || !SERVER_SRC.includes('starter skills'))
        return 'initWorkspaceDefaults() missing skill template copy block'
      if (!SERVER_SRC.includes('skillTemplateSrc'))
        return 'Missing skillTemplateSrc variable in initWorkspaceDefaults()'
      if (!SERVER_SRC.includes('PACKAGE_ROOT'))
        return 'Missing PACKAGE_ROOT — skill templates must be sourced from npm package dir, not WORKSPACE_ROOT'
    }
  ))

  // ── AB-05: Skill copy targets learned/ subdirectory ──────────────────────
  results.push(await runTest('AB-05', 'AB',
    'Skill copy targets workspace/skills/learned/', () => {
      // The copy destination should be workspace/skills/learned/ so SkillLoader picks them up
      const copyBlock = SERVER_SRC.match(/skillDst\s*=\s*path\.join\(WORKSPACE_ROOT,\s*'workspace',\s*'skills',\s*'learned'\)/)
      if (!copyBlock)
        return 'Skill copy destination should be workspace/skills/learned/'
    }
  ))

  // ── AB-06: Skill copy is idempotent (existsSync check) ──────────────────
  results.push(await runTest('AB-06', 'AB',
    'Skill copy is idempotent — checks for existing skills', () => {
      // Should check hasExisting before copying
      if (!SERVER_SRC.includes('hasExisting'))
        return 'Missing idempotency check (hasExisting) in skill copy block'
      // Should check individual skill dirs too
      if (!SERVER_SRC.includes('!fs.existsSync(to)'))
        return 'Missing per-skill existsSync check in copy loop'
    }
  ))

  // ── AB-07: Skill copy iterates workspace-templates/skills/ dirs ──────────
  results.push(await runTest('AB-07', 'AB',
    'Skill copy iterates template skill directories', () => {
      if (!SERVER_SRC.includes('readdirSync(skillTemplateSrc'))
        return 'Missing readdirSync on skillTemplateSrc'
      if (!SERVER_SRC.includes('cpSync'))
        return 'Missing fs.cpSync for recursive skill directory copy'
    }
  ))

  // ── AB-08: workspace-templates/skills/ has skill directories ─────────────
  results.push(await runTest('AB-08', 'AB',
    'workspace-templates/skills/ contains bundled skill directories', () => {
      const templatesDir = path.join(CWD, 'workspace-templates', 'skills')
      if (!fs.existsSync(templatesDir))
        return 'workspace-templates/skills/ directory does not exist'
      const entries = fs.readdirSync(templatesDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
      if (entries.length < 30)
        return `Expected 30+ skill template dirs, found ${entries.length}`
    }
  ))

  // ── AB-09: SkillLoader does NOT filter dirs by existsSync at construction ──
  results.push(await runTest('AB-09', 'AB',
    'SkillLoader skillsDirs not filtered by existsSync (init-order safe)', () => {
      // The old .filter(d => existsSync(d)) caused dirs created by
      // initWorkspaceDefaults() AFTER SkillLoader import to be missed.
      const constructorBlock = SKILLLOADER_SRC.match(/this\.skillsDirs\s*=\s*\[[\s\S]*?\](\s*\.filter)?/)
      if (constructorBlock && constructorBlock[1]) {
        return 'SkillLoader skillsDirs still has .filter() — dirs created after import will be missed'
      }
    }
  ))

  // ── AB-10: PACKAGE_ROOT defined with __dirname resolution ─────────────────
  results.push(await runTest('AB-10', 'AB',
    'PACKAGE_ROOT resolves npm package dir via __dirname', () => {
      if (!SERVER_SRC.includes('PACKAGE_ROOT'))
        return 'PACKAGE_ROOT constant not found in api/server.ts'
      if (!SERVER_SRC.includes('__dirname'))
        return 'PACKAGE_ROOT should resolve via __dirname (npm package location)'
    }
  ))

  // ── AB-11: skillTemplateSrc uses PACKAGE_ROOT not WORKSPACE_ROOT ─────────
  results.push(await runTest('AB-11', 'AB',
    'skillTemplateSrc sourced from PACKAGE_ROOT (not WORKSPACE_ROOT)', () => {
      const srcLine = SERVER_SRC.match(/skillTemplateSrc\s*=\s*path\.join\((\w+),/)
      if (!srcLine)
        return 'skillTemplateSrc path.join not found'
      if (srcLine[1] !== 'PACKAGE_ROOT')
        return `skillTemplateSrc uses ${srcLine[1]} instead of PACKAGE_ROOT — will fail when AIDEN_USER_DATA differs from npm dir`
    }
  ))

  for (const r of results) printResult(r)
  return summarize('AB', 'C22 Skill bundle path mismatch', results)
}
