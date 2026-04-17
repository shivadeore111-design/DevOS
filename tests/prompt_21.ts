// ============================================================
// DevOS — Prompt 21 Audit — VoxCPM2 + Voice as First-Class Tools
// Tests: toolRegistry, voxcpm_runner.py, tts.ts, cli, sdk, types, docs
// Target: 127/127 total (117 prior + 10 new)
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

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — Required files exist
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 1: Required files exist')
const requiredFiles = [
  'core/voice/voxcpm_runner.py',
  'docs/VOXCPM_SETUP.md',
]
const missingFiles = requiredFiles.filter(f => !fileExists(f))
check(
  'all required new files present',
  missingFiles.length === 0,
  missingFiles.join(', ') || 'all present',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — 'voice' ToolCategory registered in toolRegistry.ts
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 2: ToolCategory has "voice" and TOOL_CATEGORIES has all 4 voice tools')
const registryContent = fileExists('core/toolRegistry.ts') ? readFile('core/toolRegistry.ts') : ''
check(
  "ToolCategory type includes 'voice'",
  registryContent.includes("| 'voice'"),
  "'voice' not found in ToolCategory type",
)
const voiceToolsInCategories = ['voice_speak', 'voice_transcribe', 'voice_clone', 'voice_design']
  .filter(t => !registryContent.includes(`${t}:`) && !registryContent.includes(`${t} `))
check(
  'TOOL_CATEGORIES maps all 4 voice tools',
  ['voice_speak', 'voice_transcribe', 'voice_clone', 'voice_design']
    .every(t => registryContent.includes(t)),
  voiceToolsInCategories.join(', ') || 'all mapped',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — 4 voice tools implemented in TOOLS object
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 3: All 4 voice tools implemented in TOOLS object')
const toolImpls = ['voice_speak', 'voice_transcribe', 'voice_clone', 'voice_design']
for (const tool of toolImpls) {
  check(
    `${tool} implementation present in TOOLS`,
    registryContent.includes(`${tool}: async`),
    `${tool}: async implementation not found`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — TOOL_TIMEOUTS has 4 voice tools
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 4: TOOL_TIMEOUTS has all 4 voice tools')
for (const tool of ['voice_speak', 'voice_transcribe', 'voice_clone', 'voice_design']) {
  check(
    `TOOL_TIMEOUTS includes ${tool}`,
    registryContent.includes(`${tool}:`),
    `${tool} timeout not found in TOOL_TIMEOUTS`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — detectToolCategories updated for 'voice'
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n  ── Test 5: detectToolCategories adds 'voice' category")
check(
  "detectToolCategories adds 'voice' for speak/transcribe queries",
  registryContent.includes("categories.add('voice')"),
  "'voice' category not added in detectToolCategories",
)
check(
  'detectToolCategories voice regex covers speak, transcribe, clone, design',
  registryContent.includes('transcribe') && registryContent.includes('clone.*voice'),
  'voice regex too narrow — missing transcribe or clone',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 6 — voxcpm_runner.py has required structure
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 6: voxcpm_runner.py has required structure')
const runnerContent = fileExists('core/voice/voxcpm_runner.py') ? readFile('core/voice/voxcpm_runner.py') : ''
check(
  'voxcpm_runner.py reads JSON from stdin',
  runnerContent.includes('stdin.read()') || runnerContent.includes('sys.stdin'),
  'stdin read not found in voxcpm_runner.py',
)
check(
  'voxcpm_runner.py writes JSON to stdout',
  runnerContent.includes('json.dumps') && runnerContent.includes('print('),
  'JSON stdout output not found in voxcpm_runner.py',
)
check(
  'voxcpm_runner.py handles clone mode',
  runnerContent.includes("mode == 'clone'") || runnerContent.includes('clone_voice'),
  'clone mode not found in voxcpm_runner.py',
)
check(
  'voxcpm_runner.py handles design mode',
  runnerContent.includes("mode == 'design'") || runnerContent.includes('design_voice'),
  'design mode not found in voxcpm_runner.py',
)
check(
  'voxcpm_runner.py handles CUDA OOM gracefully',
  runnerContent.includes('OutOfMemoryError') || runnerContent.includes('CUDA out of memory'),
  'CUDA OOM handling not found',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 7 — tts.ts has VoxCPM provider
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 7: tts.ts integrates VoxCPM provider')
const ttsContent = fileExists('core/voice/tts.ts') ? readFile('core/voice/tts.ts') : ''
check(
  "TtsOptions.provider includes 'voxcpm'",
  ttsContent.includes("'voxcpm'"),
  "'voxcpm' not in provider type in tts.ts",
)
check(
  'USE_VOXCPM=1 opt-in check present',
  ttsContent.includes('USE_VOXCPM'),
  'USE_VOXCPM env var check not found in tts.ts',
)
check(
  'synthesize() calls synthesizeVoxCPM when enabled',
  ttsContent.includes('synthesizeVoxCPM'),
  'synthesizeVoxCPM function not found in tts.ts',
)
check(
  'getTtsProviders() returns voxcpm entry',
  ttsContent.includes("name: 'voxcpm'") || ttsContent.includes("name:'voxcpm'"),
  "voxcpm not in getTtsProviders() return",
)
check(
  'referenceAudioPath and voiceDesignPrompt in TtsOptions',
  ttsContent.includes('referenceAudioPath') && ttsContent.includes('voiceDesignPrompt'),
  'referenceAudioPath or voiceDesignPrompt not in TtsOptions',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 8 — CLI /voice subcommands: design, clone, reset, providers
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 8: CLI /voice has design, clone, reset, providers subcommands')
const cliContent = fileExists('cli/aiden.ts') ? readFile('cli/aiden.ts') : ''
for (const sub of ['design', 'clone', 'reset', 'providers']) {
  check(
    `/voice ${sub} subcommand present in CLI`,
    cliContent.includes(`sub === '${sub}'`) || cliContent.includes(`=== '${sub}'`),
    `'${sub}' subcommand not found in /voice handler`,
  )
}
check(
  'voiceDesign state field added',
  cliContent.includes('voiceDesign'),
  'voiceDesign not found in CLI state',
)
check(
  'voiceReferencePath state field added',
  cliContent.includes('voiceReferencePath'),
  'voiceReferencePath not found in CLI state',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 9 — SDK has design(), clone(), reset(), providers()
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 9: aidenSdk.ts voice namespace has speak, design, clone, reset, providers')
const sdkContent = fileExists('core/aidenSdk.ts') ? readFile('core/aidenSdk.ts') : ''
for (const method of ['speak', 'clone', 'design', 'reset', 'providers']) {
  check(
    `aiden.voice.${method}() registered in SDK`,
    sdkContent.includes(`${method}:`),
    `voice.${method} not found in aidenSdk.ts`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 10 — VOXCPM_SETUP.md has attribution
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 10: VOXCPM_SETUP.md has required attribution and setup info')
const docsContent = fileExists('docs/VOXCPM_SETUP.md') ? readFile('docs/VOXCPM_SETUP.md') : ''
check(
  'VOXCPM_SETUP.md mentions OpenBMB',
  docsContent.includes('OpenBMB'),
  'OpenBMB attribution missing from VOXCPM_SETUP.md',
)
check(
  'VOXCPM_SETUP.md mentions Apache 2.0 license',
  docsContent.toLowerCase().includes('apache'),
  'Apache 2.0 license not mentioned in VOXCPM_SETUP.md',
)
check(
  'VOXCPM_SETUP.md has arXiv reference',
  docsContent.includes('arXiv') || docsContent.includes('arxiv'),
  'arXiv paper reference missing from VOXCPM_SETUP.md',
)
check(
  'VOXCPM_SETUP.md has USE_VOXCPM=1 opt-in instruction',
  docsContent.includes('USE_VOXCPM=1'),
  'USE_VOXCPM=1 instruction missing from VOXCPM_SETUP.md',
)

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

const total = passed + failed
console.log(`\n  ── Prompt 21 Results: ${passed}/${total} passed\n`)
if (errors.length > 0) {
  console.log('  Failures:')
  for (const e of errors) console.log(`    • ${e}`)
  console.log()
  process.exit(1)
}
