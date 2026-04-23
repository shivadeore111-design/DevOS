/**
 * Phase 14b verification — confirm fixed /skills review lookup
 * Run: npx ts-node tests/verify-review-fix.ts
 */
import * as path from 'path'
import * as fs   from 'fs'
import { skillLoader, getSkillContent } from '../core/skillLoader'

const WORKSPACE_ROOT = 'C:/Users/shiva/DevOS'

function reviewLookup(id: string): { found: boolean; status?: string; filePath?: string; contentLen?: number; error?: string } {
  const cwd = WORKSPACE_ROOT
  const candidates = [
    path.join(cwd, 'skills', 'learned', 'pending',  id, 'SKILL.md'),
    path.join(cwd, 'skills', 'learned', 'approved', id, 'SKILL.md'),
    path.join(cwd, 'skills', 'installed',           id, 'SKILL.md'),
  ]
  const learnedTarget = candidates.find(p => fs.existsSync(p))
  if (learnedTarget) {
    const content = fs.readFileSync(learnedTarget, 'utf-8')
    const status  = learnedTarget.includes('pending') ? 'pending'
      : learnedTarget.includes('approved') ? 'approved' : 'installed'
    return { found: true, status, filePath: learnedTarget, contentLen: content.length }
  }

  const allSkills = (skillLoader as any).loadAllRaw ? (skillLoader as any).loadAllRaw() : skillLoader.loadAll()
  const found = allSkills.find((s: any) =>
    s.name === id ||
    path.basename(path.dirname(s.filePath)) === id ||
    s.name.toLowerCase() === id.toLowerCase() ||
    path.basename(path.dirname(s.filePath)).toLowerCase() === id.toLowerCase()
  )
  if (!found) return { found: false, error: `Skill "${id}" not found` }
  const content = getSkillContent(found.filePath)
  if (!content) return { found: false, error: `Skill "${id}" file unreadable` }
  return { found: true, status: 'built-in', filePath: found.filePath, contentLen: content.length }
}

const PASS = '✅'
const FAIL = '❌'

let passed = 0
let failed = 0

function test(label: string, actual: any, check: (v: any) => boolean) {
  const ok = check(actual)
  console.log(`  ${ok ? PASS : FAIL}  ${label}`)
  if (!ok) console.log(`       got: ${JSON.stringify(actual)}`)
  ok ? passed++ : failed++
}

console.log('\n── Phase 14b Verification ──────────────────────────────────\n')

// Scenario 1: built-in skill (arxiv)
const arxiv = reviewLookup('arxiv')
console.log('Scenario 1: arxiv (built-in skill)')
test('found === true',              arxiv.found,       v => v === true)
test('status === "built-in"',       arxiv.status,      v => v === 'built-in')
test('contentLen > 100',            arxiv.contentLen,  v => (v ?? 0) > 100)
test('filePath contains arxiv',     arxiv.filePath,    v => String(v).includes('arxiv'))
console.log()

// Scenario 2: another built-in skill (architecture-diagram)
const arch = reviewLookup('architecture-diagram')
console.log('Scenario 2: architecture-diagram (built-in skill)')
test('found === true',              arch.found,        v => v === true)
test('status === "built-in"',       arch.status,       v => v === 'built-in')
test('contentLen > 100',            arch.contentLen,   v => (v ?? 0) > 100)
console.log()

// Scenario 3: non-existent skill
const ghost = reviewLookup('does-not-exist-xyz-9999')
console.log('Scenario 3: non-existent skill')
test('found === false',             ghost.found,       v => v === false)
test('error contains "not found"',  ghost.error,       v => String(v ?? '').includes('not found'))
console.log()

// Scenario 4: cache population after 2 reviews
import { getSkillCacheStats } from '../core/skillLoader'
const stats = getSkillCacheStats()
console.log('Scenario 4: LRU cache populated')
test('cachedItems >= 2',            stats.size,        v => v >= 2)
test('maxItems === 50',             stats.max,         v => v === 50)
console.log()

console.log(`── Results: ${passed} passed, ${failed} failed ────────────────────────\n`)
process.exit(failed > 0 ? 1 : 0)
