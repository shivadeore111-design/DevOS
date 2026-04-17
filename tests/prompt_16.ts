// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_16.ts — 8 zero-cost audits for Prompt 16
// (Discord + Slack + Webhook channel adapters).
// Run via:  npm run test:audit
// No LLM. No network. No side effects.

import path from 'path'
import fs   from 'fs'
import { test, assert, assertIncludes, runAll, appendAuditLog } from './harness'

const ROOT      = process.cwd()
const ADAPTER   = path.join(ROOT, 'core', 'channels', 'adapter.ts')
const DISCORD   = path.join(ROOT, 'core', 'channels', 'discord.ts')
const SLACK     = path.join(ROOT, 'core', 'channels', 'slack.ts')
const WEBHOOK   = path.join(ROOT, 'core', 'channels', 'webhook.ts')
const MANAGER   = path.join(ROOT, 'core', 'channels', 'manager.ts')
const CLI       = path.join(ROOT, 'cli', 'aiden.ts')

// ── Test 1 — ChannelAdapter interface exists with all members ─────────────────
test('p16: ChannelAdapter interface has name, start, stop, send, isHealthy', () => {
  const content = fs.readFileSync(ADAPTER, 'utf-8')
  assert(content.includes('export interface ChannelAdapter'), 'adapter.ts must export ChannelAdapter interface')
  assertIncludes(content, 'name',       'ChannelAdapter must have name property')
  assertIncludes(content, 'start()',    'ChannelAdapter must have start() method')
  assertIncludes(content, 'stop()',     'ChannelAdapter must have stop() method')
  assertIncludes(content, 'send(',      'ChannelAdapter must have send() method')
  assertIncludes(content, 'isHealthy()', 'ChannelAdapter must have isHealthy() method')
})

// ── Test 2 — Discord adapter has required structure ───────────────────────────
test('p16: Discord adapter has DISCORD_BOT_TOKEN, discord.js import, graceful degradation', () => {
  const content = fs.readFileSync(DISCORD, 'utf-8')
  assert(
    content.includes('DISCORD_BOT_TOKEN'),
    'discord.ts must read DISCORD_BOT_TOKEN env var',
  )
  assert(
    content.includes("from 'discord.js'") || content.includes('from "discord.js"'),
    'discord.ts must import from discord.js',
  )
  // Graceful degradation: must NOT throw/exit on missing token — must log and return
  assert(
    content.includes("'[Discord] Disabled") || content.includes('"[Discord] Disabled'),
    'discord.ts must log disabled message when token is missing (graceful degradation)',
  )
  assert(
    !content.match(/if\s*\(!\s*this\.token\s*\)\s*\{[^}]*throw/),
    'discord.ts must not throw on missing token',
  )
})

// ── Test 3 — Slack adapter has required structure ─────────────────────────────
test('p16: Slack adapter has SLACK_BOT_TOKEN, @slack/bolt import, signing secret', () => {
  const content = fs.readFileSync(SLACK, 'utf-8')
  assert(
    content.includes('SLACK_BOT_TOKEN'),
    'slack.ts must read SLACK_BOT_TOKEN env var',
  )
  assert(
    content.includes("from '@slack/bolt'") || content.includes('from "@slack/bolt"'),
    'slack.ts must import from @slack/bolt',
  )
  assert(
    content.includes('SLACK_SIGNING_SECRET') || content.includes('signingSecret'),
    'slack.ts must reference SLACK_SIGNING_SECRET (request signature verification)',
  )
  // Graceful degradation
  assert(
    content.includes("'[Slack] Disabled") || content.includes('"[Slack] Disabled'),
    'slack.ts must log disabled message when credentials are missing (graceful degradation)',
  )
})

// ── Test 4 — Webhook adapter has HMAC verification ───────────────────────────
test('p16: Webhook adapter has WEBHOOK_SECRET, HMAC, and signature header check', () => {
  const content = fs.readFileSync(WEBHOOK, 'utf-8')
  assert(
    content.includes('WEBHOOK_SECRET'),
    'webhook.ts must read WEBHOOK_SECRET env var',
  )
  assert(
    content.includes('createHmac') || content.includes('HMAC'),
    'webhook.ts must use crypto.createHmac for signature generation',
  )
  assert(
    content.includes('x-aiden-signature') || content.includes('X-Aiden-Signature'),
    'webhook.ts must check X-Aiden-Signature header',
  )
  // Graceful degradation: returns 503 when secret not set
  assert(
    content.includes('503') || content.includes("'[Webhook] Disabled") || content.includes('"[Webhook] Disabled'),
    'webhook.ts must gracefully disable when WEBHOOK_SECRET is missing',
  )
})

// ── Test 5 — ChannelManager class exists with required methods ────────────────
test('p16: ChannelManager class has register, startAll, getStatus', () => {
  const content = fs.readFileSync(MANAGER, 'utf-8')
  assert(content.includes('class ChannelManager'), 'manager.ts must define class ChannelManager')
  assert(
    content.includes('register(') || content.includes('register ('),
    'ChannelManager must have register() method',
  )
  assert(
    content.includes('startAll(') || content.includes('startAll ('),
    'ChannelManager must have startAll() method',
  )
  assert(
    content.includes('getStatus(') || content.includes('getStatus ('),
    'ChannelManager must have getStatus() method',
  )
})

// ── Test 6 — /channels CLI command registered ─────────────────────────────────
test('p16: /channels command is in CLI COMMANDS array', () => {
  const content = fs.readFileSync(CLI, 'utf-8')
  assert(
    content.includes("'/channels'"),
    "cli/aiden.ts COMMANDS must contain '/channels'",
  )
  assert(
    content.includes("command === '/channels'"),
    'handleCommand must have /channels branch',
  )
})

// ── Test 7 — No crash-on-missing-credentials in adapter config loading ────────
test('p16: no process.exit or uncaught throw in adapter config loading sections', () => {
  for (const [name, file] of [['discord', DISCORD], ['slack', SLACK], ['webhook', WEBHOOK]] as const) {
    const content = fs.readFileSync(file, 'utf-8')
    // Check that start() returns early (not throws) when credentials absent
    // Pattern: the token check must be followed by a return, not throw
    assert(
      !content.includes('process.exit('),
      `${name}.ts must not call process.exit() — graceful degradation only`,
    )
    // Ensure the "disabled" path ends in a return, not a throw
    const throwInTokenGuard = /if\s*\(![^)]+token[^)]*\)[^}]*throw/.test(content)
    assert(
      !throwInTokenGuard,
      `${name}.ts must not throw when credentials are missing`,
    )
  }
})

// ── Test 8 — Allowlist enforcement present in all three adapters ──────────────
test('p16: ALLOWED_ env var used in discord, slack, and webhook adapters', () => {
  const discordContent = fs.readFileSync(DISCORD, 'utf-8')
  const slackContent   = fs.readFileSync(SLACK,   'utf-8')
  const webhookContent = fs.readFileSync(WEBHOOK, 'utf-8')

  assert(
    discordContent.includes('DISCORD_ALLOWED_'),
    'discord.ts must reference DISCORD_ALLOWED_ env vars for allowlist enforcement',
  )
  assert(
    slackContent.includes('SLACK_ALLOWED_'),
    'slack.ts must reference SLACK_ALLOWED_ env vars for allowlist enforcement',
  )
  assert(
    webhookContent.includes('WEBHOOK_ALLOWED_'),
    'webhook.ts must reference WEBHOOK_ALLOWED_ env vars for allowlist enforcement',
  )
})

// ── Run ───────────────────────────────────────────────────────────────────────

;(async () => {
  const results = await runAll()
  const logPath = path.join(ROOT, 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  process.exit(failed > 0 ? 1 : 0)
})()
