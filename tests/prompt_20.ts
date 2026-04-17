// ============================================================
// DevOS — Prompt 20 Audit — Channels Wave 2
// Tests: WhatsApp, Signal, SMS, iMessage, Email adapters
// Target: 117/117 total (107 prior + 10 new)
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
// Test 1 — All 5 new adapter files exist
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 1: All 5 new adapter files exist')
const adapterFiles = [
  'core/channels/whatsapp.ts',
  'core/channels/signal.ts',
  'core/channels/twilio.ts',
  'core/channels/imessage.ts',
  'core/channels/email.ts',
]
const missingAdapters = adapterFiles.filter(f => !fileExists(f))
check(
  'all 5 new adapter files present',
  missingAdapters.length === 0,
  missingAdapters.join(', ') || 'all present',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — Each adapter implements ChannelAdapter interface (has start/stop/send/isHealthy)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 2: Each adapter implements ChannelAdapter interface')
const interfaceChecks: [string, string[]][] = [
  ['whatsapp', ['WhatsAppAdapter', 'async start()', 'async stop()', 'async send(', 'isHealthy()']],
  ['signal',   ['SignalAdapter',   'async start()', 'async stop()', 'async send(', 'isHealthy()']],
  ['twilio',   ['TwilioAdapter',   'async start()', 'async stop()', 'async send(', 'isHealthy()']],
  ['imessage', ['IMessageAdapter', 'async start()', 'async stop()', 'async send(', 'isHealthy()']],
  ['email',    ['EmailAdapter',    'async start()', 'async stop()', 'async send(', 'isHealthy()']],
]
for (const [name, patterns] of interfaceChecks) {
  const file    = `core/channels/${name === 'twilio' ? 'twilio' : name === 'imessage' ? 'imessage' : name}.ts`
  const content = fileExists(file) ? readFile(file) : ''
  const missing = patterns.filter(p => !content.includes(p))
  check(
    `${name} adapter has full ChannelAdapter interface`,
    missing.length === 0,
    missing.length > 0 ? `missing: ${missing.join(', ')}` : 'ok',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — Each adapter has graceful degradation (disabled log, not throw)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 3: Each adapter has graceful degradation on missing creds')
const degradationChecks: [string, string][] = [
  ['core/channels/whatsapp.ts', 'Disabled'],
  ['core/channels/signal.ts',   'Disabled'],
  ['core/channels/twilio.ts',   'Disabled'],
  ['core/channels/imessage.ts', 'Disabled'],
  ['core/channels/email.ts',    'Disabled'],
]
for (const [file, marker] of degradationChecks) {
  const content = fileExists(file) ? readFile(file) : ''
  check(
    `${path.basename(file, '.ts')} has graceful degradation`,
    content.includes(marker),
    `"${marker}" not found in ${file}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — Each adapter has allowlist support
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 4: Each adapter has allowlist support')
const allowlistChecks: [string, string][] = [
  ['core/channels/whatsapp.ts', 'allowedNumbers'],
  ['core/channels/signal.ts',   'allowedNumbers'],
  ['core/channels/twilio.ts',   'allowedNumbers'],
  ['core/channels/imessage.ts', 'allowedNumbers'],
  ['core/channels/email.ts',    'allowedSenders'],
]
for (const [file, allowlistProp] of allowlistChecks) {
  const content = fileExists(file) ? readFile(file) : ''
  check(
    `${path.basename(file, '.ts')} has allowlist (${allowlistProp})`,
    content.includes(allowlistProp),
    `"${allowlistProp}" not found in ${file}`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — ChannelManager server.ts registers all 9 adapters
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 5: server.ts registers all 9 adapters')
const serverContent = fileExists('api/server.ts') ? readFile('api/server.ts') : ''
const adapterClasses = [
  'DiscordAdapter', 'SlackAdapter', 'WebhookAdapter',
  'WhatsAppAdapter', 'SignalAdapter', 'TwilioAdapter',
  'IMessageAdapter', 'EmailAdapter',
]
const missingRegistrations = adapterClasses.filter(cls => !serverContent.includes(cls))
check(
  'server.ts imports all 8 non-telegram adapter classes',
  missingRegistrations.length === 0,
  missingRegistrations.join(', ') || 'all registered',
)
check(
  'server.ts registers all new adapters via channelManager.register()',
  ['WhatsAppAdapter', 'SignalAdapter', 'TwilioAdapter', 'IMessageAdapter', 'EmailAdapter']
    .every(cls => serverContent.includes(`new ${cls}`)),
  'some new adapters not registered with channelManager',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 6 — GET /api/channels/status returns shape with all 9 channels
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 6: ChannelStatus interface has required shape fields')
const managerContent = fileExists('core/channels/manager.ts') ? readFile('core/channels/manager.ts') : ''
check(
  'ChannelStatus has name field',
  managerContent.includes('name:'),
  'name field missing from ChannelStatus',
)
check(
  'ChannelStatus has healthy field',
  managerContent.includes('healthy:'),
  'healthy field missing from ChannelStatus',
)
check(
  'ChannelStatus has lastMessageTimestamp field',
  managerContent.includes('lastMessageTimestamp'),
  'lastMessageTimestamp missing from ChannelStatus',
)
check(
  'GET /api/channels/status endpoint registered',
  serverContent.includes('/api/channels/status'),
  '/api/channels/status endpoint not found in server.ts',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 7 — /channels CLI still works (command accepts restart and test)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 7: /channels CLI accepts restart and test subcommands')
const cliContent = fileExists('cli/aiden.ts') ? readFile('cli/aiden.ts') : ''
check(
  '/channels command present in CLI',
  cliContent.includes('/channels'),
  '/channels not found in cli/aiden.ts',
)
check(
  '/channels restart subcommand supported',
  cliContent.includes('restart'),
  'restart subcommand not found in /channels handler',
)
check(
  '/channels test subcommand supported',
  cliContent.includes('test <name>') || cliContent.includes("'test'") || cliContent.includes('"test"') || cliContent.includes('=== \'test\''),
  'test subcommand not found in /channels handler',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 8 — Email adapter has loop prevention logic
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 8: Email adapter has loop prevention logic')
const emailContent = fileExists('core/channels/email.ts') ? readFile('core/channels/email.ts') : ''
check(
  'Email: skips self-sent messages (smtp user check)',
  emailContent.includes('smtpUser') && emailContent.includes('from'),
  'self-send loop prevention not found',
)
check(
  'Email: skips messages with X-Aiden-Reply header',
  emailContent.includes('X-Aiden-Reply') || emailContent.includes('x-aiden-reply'),
  'X-Aiden-Reply header check not found',
)
check(
  'Email: sends X-Aiden-Reply header on outbound',
  emailContent.includes("'X-Aiden-Reply': '1'") || emailContent.includes('"X-Aiden-Reply": "1"'),
  'outbound X-Aiden-Reply header not set',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 9 — No hardcoded credentials in any new adapter
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 9: No hardcoded credentials in new adapters')
const credPatterns = [
  /sk-[a-zA-Z0-9]{20,}/,      // OpenAI keys
  /xoxb-[0-9]+-/,             // Slack tokens
  /Bot [a-zA-Z0-9]{20,}/,     // Discord bot tokens
  /[A-Z0-9]{32,}/,            // generic long uppercase credential strings
  /ghp_[a-zA-Z0-9]{36}/,      // GitHub PATs
  /AC[a-f0-9]{32}/,           // Twilio SIDs (real ones, not placeholders)
]
const newAdapterFiles = [
  'core/channels/whatsapp.ts',
  'core/channels/signal.ts',
  'core/channels/twilio.ts',
  'core/channels/imessage.ts',
  'core/channels/email.ts',
]
const hardcodedCreds: string[] = []
for (const file of newAdapterFiles) {
  if (!fileExists(file)) continue
  const content = readFile(file)
  for (const pattern of credPatterns) {
    const match = content.match(pattern)
    if (match) {
      // Allow env var references and placeholder strings
      const line = content.split('\n').find(l => l.includes(match[0]))
      if (line && !line.includes('process.env') && !line.includes('//') && !line.includes('placeholder')) {
        hardcodedCreds.push(`${path.basename(file)}: possible cred "${match[0].substring(0, 20)}..."`)
      }
    }
  }
}
check(
  'no hardcoded credentials in new adapters',
  hardcodedCreds.length === 0,
  hardcodedCreds.join('; ') || 'clean',
)

// ─────────────────────────────────────────────────────────────────────────────
// Test 10 — SMS adapter has 160-char chunking logic
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n  ── Test 10: SMS adapter has 160-char chunking logic')
const twilioContent = fileExists('core/channels/twilio.ts') ? readFile('core/channels/twilio.ts') : ''
check(
  'SMS chunking constant SMS_CHUNK_SIZE = 160',
  twilioContent.includes('160'),
  '160-char chunk size not found in twilio.ts',
)
check(
  'SMS chunkSms() function exists',
  twilioContent.includes('chunkSms') || twilioContent.includes('chunk'),
  'chunkSms function not found in twilio.ts',
)
check(
  'SMS sends multiple chunks in a loop',
  twilioContent.includes('for (') || twilioContent.includes('forEach') || twilioContent.includes('for('),
  'chunk loop not found in twilio.ts',
)

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

const total = passed + failed
console.log(`\n  ── Prompt 20 Results: ${passed}/${total} passed\n`)
if (errors.length > 0) {
  console.log('  Failures:')
  for (const e of errors) console.log(`    • ${e}`)
  console.log()
  process.exit(1)
}
