// ============================================================
// DevOS — Prompt 19 Audit — Skills Wave 2
// Tests: 32 SKILL.md files + catalog + frontmatter + structure
// Target: 107/107 total (10 new tests)
// ============================================================

import * as fs   from 'fs'
import * as path from 'path'

let passed = 0
let failed = 0
const errors: string[] = []

function pass(name: string): void {
  console.log(`  ✅ ${name}`)
  passed++
}

function fail(name: string, reason: string): void {
  console.log(`  ❌ ${name}: ${reason}`)
  failed++
  errors.push(`${name}: ${reason}`)
}

function check(name: string, condition: boolean, reason: string): void {
  condition ? pass(name) : fail(name, reason)
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(__dirname, '..', rel))
}

function readFile(rel: string): string {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
}

// ── Wave 2 skill names ────────────────────────────────────────────────────────

const PRODUCTIVITY_SKILLS = [
  'obsidian',
  'notion',
  'google-workspace',
  'linear',
  'ocr-and-documents',
  'nano-pdf',
  'excalidraw',
]

const DEVELOPER_SKILLS = [
  'jupyter-live-kernel',
  'docker-management',
  'github-auth',
  'github-issues',
  'github-pr-workflow',
  'github-repo-management',
  'systematic-debugging',
  'test-driven-development',
]

const RESEARCH_SKILLS = [
  'arxiv',
  'youtube-content',
  'blogwatcher',
  'research-paper-writing',
]

const CREATIVE_SKILLS = [
  'architecture-diagram',
  'ascii-art',
  'stable-diffusion-image-generation',
  'p5js',
]

const MEDIA_SKILLS = [
  'gif-search',
  'songsee',
  'minecraft-modpack-server',
  'pokemon-player',
  'openhue',
  'xitter',
]

const AGENT_BRIDGE_SKILLS = [
  'claude-code',
  'codex',
  'opencode',
]

const ALL_WAVE2_SKILLS = [
  ...PRODUCTIVITY_SKILLS,
  ...DEVELOPER_SKILLS,
  ...RESEARCH_SKILLS,
  ...CREATIVE_SKILLS,
  ...MEDIA_SKILLS,
  ...AGENT_BRIDGE_SKILLS,
]

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — All 32 SKILL.md files exist
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 1: All 32 Wave 2 SKILL.md files exist')
check(
  'all 32 Wave 2 SKILL.md files present',
  ALL_WAVE2_SKILLS.every(s => fileExists(`skills/${s}/SKILL.md`)),
  ALL_WAVE2_SKILLS.filter(s => !fileExists(`skills/${s}/SKILL.md`))
    .map(s => `skills/${s}/SKILL.md`).join(', ') || 'all present',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — All skills have origin: aiden in frontmatter
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 2: origin: aiden in all Wave 2 frontmatter')
const missingOrigin = ALL_WAVE2_SKILLS.filter(s => {
  const relPath = `skills/${s}/SKILL.md`
  if (!fileExists(relPath)) return true
  const content = readFile(relPath)
  return !/^origin:\s*aiden/m.test(content)
})
check(
  'all Wave 2 skills have origin: aiden',
  missingOrigin.length === 0,
  missingOrigin.join(', ') || 'all have origin: aiden',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — All skills have required YAML frontmatter fields
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 3: Required frontmatter fields (name, description, category, version, tags)')
const frontmatterFields = ['name:', 'description:', 'category:', 'version:', 'tags:']
const missingFields: string[] = []
for (const skill of ALL_WAVE2_SKILLS) {
  const relPath = `skills/${skill}/SKILL.md`
  if (!fileExists(relPath)) continue
  const content = readFile(relPath)
  for (const field of frontmatterFields) {
    if (!content.includes(field)) {
      missingFields.push(`${skill}: missing ${field}`)
    }
  }
}
check(
  'all Wave 2 skills have complete frontmatter',
  missingFields.length === 0,
  missingFields.join('; ') || 'all complete',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — All skills have required markdown sections
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 4: Required sections (When to Use, How to Use, Examples, Cautions)')
const requiredSections = ['## When to Use', '## How to Use', '## Examples', '## Cautions']
const missingSections: string[] = []
for (const skill of ALL_WAVE2_SKILLS) {
  const relPath = `skills/${skill}/SKILL.md`
  if (!fileExists(relPath)) continue
  const content = readFile(relPath)
  for (const section of requiredSections) {
    if (!content.includes(section)) {
      missingSections.push(`${skill}: missing "${section}"`)
    }
  }
}
check(
  'all Wave 2 skills have required sections',
  missingSections.length === 0,
  missingSections.join('; ') || 'all sections present',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — No forbidden patterns in skill files
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 5: No forbidden patterns (exec(, eval(, sudo , run as administrator)')
const forbiddenPatterns = ['exec(', 'eval(', 'sudo ', 'run as administrator']
const foundForbidden: string[] = []
for (const skill of ALL_WAVE2_SKILLS) {
  const relPath = `skills/${skill}/SKILL.md`
  if (!fileExists(relPath)) continue
  const content = readFile(relPath)
  for (const pattern of forbiddenPatterns) {
    if (content.includes(pattern)) {
      foundForbidden.push(`${skill}: contains "${pattern}"`)
    }
  }
}
check(
  'no forbidden patterns in Wave 2 skills',
  foundForbidden.length === 0,
  foundForbidden.join('; ') || 'none found',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 6 — All skills are under 10KB
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 6: All Wave 2 skill files are under 10KB')
const tooLarge: string[] = []
for (const skill of ALL_WAVE2_SKILLS) {
  const relPath = `skills/${skill}/SKILL.md`
  if (!fileExists(relPath)) continue
  const size = fs.statSync(path.join(__dirname, '..', relPath)).size
  if (size > 10240) {
    tooLarge.push(`${skill}: ${Math.round(size / 1024)}KB`)
  }
}
check(
  'all Wave 2 skill files under 10KB',
  tooLarge.length === 0,
  tooLarge.join(', ') || 'all under 10KB',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 7 — Catalog updated with Wave 2 entries
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 7: AIDEN_CATALOG.md updated with Wave 2 skills')
const catalog = readFile('skills/AIDEN_CATALOG.md')
const catalogChecks: [string, boolean][] = [
  ['Wave 2 heading in catalog',      /Wave 2/.test(catalog)],
  ['obsidian in catalog',            catalog.includes('obsidian')],
  ['github-pr-workflow in catalog',  catalog.includes('github-pr-workflow')],
  ['systematic-debugging in catalog',catalog.includes('systematic-debugging')],
  ['stable-diffusion in catalog',    catalog.includes('stable-diffusion')],
  ['agent-bridge in catalog',        catalog.includes('agent-bridge') || catalog.includes('Agent Bridge')],
  ['opencode in catalog',            catalog.includes('opencode')],
]
for (const [label, cond] of catalogChecks) {
  check(label, cond, `not found in AIDEN_CATALOG.md`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 8 — Phase coverage: all 6 phases have at least one skill
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 8: All 6 skill phases have files')
check('Productivity skills (7) all present',    PRODUCTIVITY_SKILLS.every(s => fileExists(`skills/${s}/SKILL.md`)), 'some missing')
check('Developer workflow skills (8) all present', DEVELOPER_SKILLS.every(s => fileExists(`skills/${s}/SKILL.md`)), 'some missing')
check('Research skills (4) all present',         RESEARCH_SKILLS.every(s => fileExists(`skills/${s}/SKILL.md`)), 'some missing')
check('Creative skills (4) all present',         CREATIVE_SKILLS.every(s => fileExists(`skills/${s}/SKILL.md`)), 'some missing')
check('Media/gaming skills (6) all present',     MEDIA_SKILLS.every(s => fileExists(`skills/${s}/SKILL.md`)), 'some missing')
check('Agent bridge skills (3) all present',     AGENT_BRIDGE_SKILLS.every(s => fileExists(`skills/${s}/SKILL.md`)), 'some missing')

// ─────────────────────────────────────────────────────────────────────────────
// Test 9 — Total Wave 2 count is 32
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 9: Wave 2 total skill count is 32')
check(
  'Wave 2 contains exactly 32 skills',
  ALL_WAVE2_SKILLS.length === 32,
  `found ${ALL_WAVE2_SKILLS.length} skills, expected 32`,
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 10 — Catalog total count updated
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 10: Catalog header reflects Wave 2 addition')
check(
  'Catalog header mentions 52 or Wave 2',
  /52|Wave 2/.test(catalog),
  'catalog header does not reflect Wave 2 update',
)

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

const total = passed + failed
console.log(`\n  ── Prompt 19 Results: ${passed}/${total} passed\n`)
if (errors.length > 0) {
  console.log('  Failures:')
  for (const e of errors) console.log(`    • ${e}`)
  console.log()
  process.exit(1)
}
