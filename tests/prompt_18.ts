// ============================================================
// DevOS — Prompt 18 Audit — 4 Missing Tools
// Tests: clarify, todo, cronjob, vision_analyze
// Target: 97/97 total (8 new tests)
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

// ── File content helpers ───────────────────────────────────────────────────────

function readFile(rel: string): string {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(__dirname, '..', rel))
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — Manager modules exist
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 1: Manager modules exist')
check(
  'core/clarifyBus.ts exists',
  fileExists('core/clarifyBus.ts'),
  'file not found',
)
check(
  'core/todoManager.ts exists',
  fileExists('core/todoManager.ts'),
  'file not found',
)
check(
  'core/cronManager.ts exists',
  fileExists('core/cronManager.ts'),
  'file not found',
)
check(
  'core/visionAnalyze.ts exists',
  fileExists('core/visionAnalyze.ts'),
  'file not found',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — Tools registered in toolRegistry.ts
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 2: Tools registered in toolRegistry.ts')
const registry = readFile('core/toolRegistry.ts')

check(
  'clarify tool defined in TOOLS',
  /clarify:\s*async/.test(registry),
  'clarify: async not found in TOOLS',
)
check(
  'todo tool defined in TOOLS',
  /todo:\s*async/.test(registry),
  'todo: async not found in TOOLS',
)
check(
  'cronjob tool defined in TOOLS',
  /cronjob:\s*async/.test(registry),
  'cronjob: async not found in TOOLS',
)
check(
  'vision_analyze tool defined in TOOLS',
  /vision_analyze:\s*async/.test(registry),
  'vision_analyze: async not found in TOOLS',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — TOOL_CATEGORIES entries
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 3: TOOL_CATEGORIES entries')
check(
  "clarify in TOOL_CATEGORIES with 'interaction'",
  /clarify:\s*\[.*interaction/.test(registry),
  'clarify TOOL_CATEGORIES entry missing or wrong category',
)
check(
  "todo in TOOL_CATEGORIES with 'interaction'",
  /todo:\s*\[.*interaction/.test(registry),
  'todo TOOL_CATEGORIES entry missing or wrong category',
)
check(
  "cronjob in TOOL_CATEGORIES with 'system'",
  /cronjob:\s*\[.*system/.test(registry),
  'cronjob TOOL_CATEGORIES entry missing or wrong category',
)
check(
  "vision_analyze in TOOL_CATEGORIES with 'screen'",
  /vision_analyze:\s*\[.*screen/.test(registry),
  'vision_analyze TOOL_CATEGORIES entry missing or wrong category',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — ToolCategory union includes 'interaction'
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 4: ToolCategory union includes interaction')
check(
  "ToolCategory union includes 'interaction'",
  /\|\s*'interaction'/.test(registry),
  "ToolCategory union does not include 'interaction'",
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — agentLoop.ts ALLOWED_TOOLS and VALID_TOOLS updated
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 5: agentLoop.ts ALLOWED_TOOLS + VALID_TOOLS')
const agentLoop = readFile('core/agentLoop.ts')
const allowedSection = (() => {
  const idx = agentLoop.indexOf('const ALLOWED_TOOLS')
  return idx >= 0 ? agentLoop.slice(idx, idx + 800) : ''
})()
const validSection = (() => {
  const idx = agentLoop.indexOf('const VALID_TOOLS')
  return idx >= 0 ? agentLoop.slice(idx, idx + 800) : ''
})()

check(
  'clarify in ALLOWED_TOOLS',
  allowedSection.includes("'clarify'"),
  'clarify not found in ALLOWED_TOOLS',
)
check(
  'vision_analyze in ALLOWED_TOOLS',
  allowedSection.includes("'vision_analyze'"),
  'vision_analyze not found in ALLOWED_TOOLS',
)
check(
  'clarify in VALID_TOOLS',
  validSection.includes("'clarify'"),
  'clarify not found in VALID_TOOLS',
)
check(
  'vision_analyze in VALID_TOOLS',
  validSection.includes("'vision_analyze'"),
  'vision_analyze not found in VALID_TOOLS',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 6 — SDK TOOL_SDK_MAP entries
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 6: aidenSdk.ts TOOL_SDK_MAP entries')
const sdk = readFile('core/aidenSdk.ts')
check(
  "todo namespace in TOOL_SDK_MAP",
  /namespace:\s*'todo'/.test(sdk),
  "todo namespace not found in TOOL_SDK_MAP",
)
check(
  "cron namespace in TOOL_SDK_MAP",
  /namespace:\s*'cron'/.test(sdk),
  "cron namespace not found in TOOL_SDK_MAP",
)
check(
  "vision namespace in TOOL_SDK_MAP",
  /namespace:\s*'vision'/.test(sdk),
  "vision namespace not found in TOOL_SDK_MAP",
)
check(
  "clarify top-level method in buildSdkRuntime",
  /clarify:\s*async/.test(sdk),
  "clarify async method not found in buildSdkRuntime",
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 7 — Type definitions
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 7: types/aiden-sdk.d.ts updated')
const types = readFile('types/aiden-sdk.d.ts')
check(
  'AidenTodo interface defined',
  /interface AidenTodo/.test(types),
  'AidenTodo not found in aiden-sdk.d.ts',
)
check(
  'AidenCron interface defined',
  /interface AidenCron/.test(types),
  'AidenCron not found in aiden-sdk.d.ts',
)
check(
  'AidenVisionAnalyze interface defined',
  /interface AidenVisionAnalyze/.test(types),
  'AidenVisionAnalyze not found in aiden-sdk.d.ts',
)
check(
  'todo, cron, vision on AidenSDK',
  /todo:\s*AidenTodo/.test(types) && /cron:\s*AidenCron/.test(types) && /vision:\s*AidenVisionAnalyze/.test(types),
  'todo/cron/vision not all present on AidenSDK interface',
)
check(
  'clarify() on AidenSDK',
  /clarify\s*\(/.test(types),
  'clarify() method not found on AidenSDK interface',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 8 — CLI commands registered
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 8: CLI commands in cli/aiden.ts')
const cli = readFile('cli/aiden.ts')
check(
  "'/todo' in COMMANDS array",
  /COMMANDS\s*=\s*\[[\s\S]*?'\/todo'/.test(cli),
  "'/todo' not found in COMMANDS array",
)
check(
  "'/cron' in COMMANDS array",
  /COMMANDS\s*=\s*\[[\s\S]*?'\/cron'/.test(cli),
  "'/cron' not found in COMMANDS array",
)
check(
  "'/vision' in COMMANDS array",
  /COMMANDS\s*=\s*\[[\s\S]*?'\/vision'/.test(cli),
  "'/vision' not found in COMMANDS array",
)
check(
  "'/todo' handler exists",
  /command\s*===\s*'\/todo'/.test(cli),
  "'/todo' command handler not found",
)
check(
  "'/cron' handler exists",
  /command\s*===\s*'\/cron'/.test(cli),
  "'/cron' command handler not found",
)
check(
  "'/vision' handler exists",
  /command\s*===\s*'\/vision'/.test(cli),
  "'/vision' command handler not found",
)
check(
  "'/todo' in COMMAND_DETAIL",
  /['"]\/todo['"]/.test(cli),
  "'/todo' not found in COMMAND_DETAIL",
)
check(
  "'/cron' in COMMAND_DETAIL",
  /['"]\/cron['"]/.test(cli),
  "'/cron' not found in COMMAND_DETAIL",
)
check(
  "'/vision' in COMMAND_DETAIL",
  /['"]\/vision['"]/.test(cli),
  "'/vision' not found in COMMAND_DETAIL",
)
check(
  "clarifyBus registered in main()",
  /registerClarifyHandler/.test(cli),
  "registerClarifyHandler not found in cli/aiden.ts",
)

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

const total = passed + failed
console.log(`\n  ── Prompt 18 Results: ${passed}/${total} passed\n`)
if (errors.length > 0) {
  console.log('  Failures:')
  for (const e of errors) console.log(`    • ${e}`)
  console.log()
  process.exit(1)
}
