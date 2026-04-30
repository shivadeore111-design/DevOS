// core/registryValidator.ts
// v3.19 Phase 1, Commit 7 — throw-mode registry invariant guard.
//
// All 13 hand-maintained tool-name lists have been replaced with
// TOOL_REGISTRY-derived values in Commits 4-6.  This validator now THROWS
// on any remaining drift so startup fails fast if a future edit introduces
// a hand-maintained list that diverges from TOOL_REGISTRY.
//
// Checks retained (all should produce zero findings):
//   1. ALLOWED_TOOLS vs TOOL_REGISTRY
//   2. VALID_TOOLS vs TOOL_REGISTRY
//   3. MCP SAFE_TOOLS — entries with no handler
//   4. MCP DESTRUCTIVE_TOOLS — entries with no handler
//   5. CLI TOOL_NAMES count vs TOOL_DESCRIPTIONS
//   6-8. PARALLEL_SAFE / SEQUENTIAL_ONLY / NO_RETRY_TOOLS vs TOOL_REGISTRY metadata

import { TOOL_REGISTRY, TOOL_DESCRIPTIONS, TOOLS }            from './toolRegistry'
import { ALLOWED_TOOLS, VALID_TOOLS,
         NO_RETRY_TOOLS, PARALLEL_SAFE, SEQUENTIAL_ONLY }      from './agentLoop'
import { SAFE_TOOLS, DESTRUCTIVE_TOOLS }                       from '../api/mcp'
import * as fs   from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..')

// ── helpers ──────────────────────────────────────────────────────────────────

function readSrc(rel: string): string {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf-8') } catch { return '' }
}

const _violations: string[] = []

function warn(msg: string): void {
  _violations.push(msg)
  console.warn(`[RegistryValidator] WARN ${msg}`)
}

// ── main ─────────────────────────────────────────────────────────────────────

export function validateRegistry(): void {
  _violations.length = 0  // reset for idempotent calls
  const registryKeys  = new Set(Object.keys(TOOL_REGISTRY))
  const toolHandlers  = new Set(Object.keys(TOOLS))
  const descKeys      = Object.keys(TOOL_DESCRIPTIONS)

  // ── 1. ALLOWED_TOOLS vs TOOL_REGISTRY ──────────────────────────────────────
  // ALLOWED_TOOLS spreads SLASH_MIRROR_TOOL_NAMES which are external tools, not
  // in TOOL_REGISTRY — filter those out when looking for registry gaps.
  const allowedSet    = new Set(ALLOWED_TOOLS)
  const missingAllowed = [...registryKeys].filter(k => !allowedSet.has(k))
  if (missingAllowed.length > 0) {
    warn(`ALLOWED_TOOLS missing ${missingAllowed.length} entries from TOOL_REGISTRY: ` +
         missingAllowed.join(', '))
  }
  const extraAllowed = ALLOWED_TOOLS.filter(k => !registryKeys.has(k) && !k.startsWith('/'))
  if (extraAllowed.length > 0) {
    warn(`ALLOWED_TOOLS has ${extraAllowed.length} entries not in TOOL_REGISTRY: ` +
         extraAllowed.join(', '))
  }

  // ── 2. VALID_TOOLS vs TOOL_REGISTRY ────────────────────────────────────────
  const validSet     = new Set(VALID_TOOLS)
  const missingValid = [...registryKeys].filter(k => !validSet.has(k))
  if (missingValid.length > 0) {
    warn(`VALID_TOOLS missing ${missingValid.length} entries from TOOL_REGISTRY: ` +
         missingValid.join(', '))
  }
  const extraValid = VALID_TOOLS.filter(k => !registryKeys.has(k) && !k.startsWith('/'))
  if (extraValid.length > 0) {
    warn(`VALID_TOOLS has ${extraValid.length} entries not in TOOL_REGISTRY: ` +
         extraValid.join(', '))
  }

  // ── 3. SAFE_TOOLS — entries with no handler in TOOLS ───────────────────────
  const safeNoHandler = SAFE_TOOLS.filter(k => !toolHandlers.has(k))
  if (safeNoHandler.length > 0) {
    warn(`MCP SAFE_TOOLS contains ${safeNoHandler.length} tool(s) with no handler in TOOLS: ` +
         safeNoHandler.join(', '))
  }

  // ── 4. DESTRUCTIVE_TOOLS — entries with no handler in TOOLS ────────────────
  const destNoHandler = DESTRUCTIVE_TOOLS.filter(k => !toolHandlers.has(k))
  if (destNoHandler.length > 0) {
    warn(`MCP DESTRUCTIVE_TOOLS contains ${destNoHandler.length} tool(s) with no handler in TOOLS: ` +
         destNoHandler.join(', '))
  }

  // ── 5. CLI TOOL_NAMES count vs TOOL_DESCRIPTIONS ───────────────────────────
  // Parse the static array from cli/aiden.ts — count only, no full import.
  const cliSrc = readSrc('cli/aiden.ts')
  const toolNamesMatch = cliSrc.match(/const TOOL_NAMES: string\[\] = \[([\s\S]*?)\]/)
  if (toolNamesMatch) {
    const cliEntries = (toolNamesMatch[1].match(/'[^']+'/g) || []).length
    const descCount  = descKeys.length
    if (cliEntries !== descCount) {
      const delta = descCount - cliEntries
      warn(`CLI TOOL_NAMES has ${cliEntries} entries, TOOL_DESCRIPTIONS has ${descCount} ` +
           `— ${Math.abs(delta)} entries ${delta > 0 ? 'behind' : 'ahead'}`)
    }
  }

  // ── 6. PARALLEL_SAFE vs TOOL_REGISTRY[parallel='safe'] ─────────────────────
  const regParSafe    = Object.entries(TOOL_REGISTRY)
    .filter(([, m]) => m.parallel === 'safe').map(([k]) => k)
  const missingParSafe = regParSafe.filter(k => !PARALLEL_SAFE.has(k))
  const extraParSafe   = [...PARALLEL_SAFE].filter(k => !registryKeys.has(k))
  if (missingParSafe.length > 0) {
    warn(`PARALLEL_SAFE missing ${missingParSafe.length} entries from TOOL_REGISTRY[parallel=safe]: ` +
         missingParSafe.join(', '))
  }
  if (extraParSafe.length > 0) {
    warn(`PARALLEL_SAFE has ${extraParSafe.length} entries not in TOOL_REGISTRY: ` +
         extraParSafe.join(', '))
  }

  // ── 7. SEQUENTIAL_ONLY vs TOOL_REGISTRY[parallel='sequential'] ─────────────
  const regSeqOnly     = Object.entries(TOOL_REGISTRY)
    .filter(([, m]) => m.parallel === 'sequential').map(([k]) => k)
  const missingSeqOnly = regSeqOnly.filter(k => !SEQUENTIAL_ONLY.has(k))
  const extraSeqOnly   = [...SEQUENTIAL_ONLY].filter(k => !registryKeys.has(k))
  if (missingSeqOnly.length > 0) {
    warn(`SEQUENTIAL_ONLY missing ${missingSeqOnly.length} entries from TOOL_REGISTRY[parallel=sequential]: ` +
         missingSeqOnly.join(', '))
  }
  if (extraSeqOnly.length > 0) {
    warn(`SEQUENTIAL_ONLY has ${extraSeqOnly.length} entries not in TOOL_REGISTRY: ` +
         extraSeqOnly.join(', '))
  }

  // ── 8. NO_RETRY_TOOLS vs TOOL_REGISTRY[retry=false] ────────────────────────
  const regNoRetry     = Object.entries(TOOL_REGISTRY)
    .filter(([, m]) => m.retry === false).map(([k]) => k)
  const missingNoRetry = regNoRetry.filter(k => !NO_RETRY_TOOLS.has(k))
  const extraNoRetry   = [...NO_RETRY_TOOLS].filter(k => !registryKeys.has(k))
  if (missingNoRetry.length > 0) {
    warn(`NO_RETRY_TOOLS missing ${missingNoRetry.length} entries from TOOL_REGISTRY[retry=false]: ` +
         missingNoRetry.join(', '))
  }
  if (extraNoRetry.length > 0) {
    warn(`NO_RETRY_TOOLS has ${extraNoRetry.length} entries not in TOOL_REGISTRY: ` +
         extraNoRetry.join(', '))
  }

  // ── Throw on any violations ────────────────────────────────────────────────
  if (_violations.length > 0) {
    throw new Error(
      `[RegistryValidator] ${_violations.length} registry invariant(s) violated — ` +
      `fix before deploying:\n` +
      _violations.map((v, i) => `  ${i + 1}. ${v}`).join('\n')
    )
  }
}
