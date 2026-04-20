// scripts/test-providers.mjs — provider key health check
// Run: node scripts/test-providers.mjs

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Load .env manually
const envRaw = readFileSync(join(ROOT, '.env'), 'utf-8')
const env = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.+)$/)
  if (m) env[m[1]] = m[2].trim()
}

const BOA_KEY        = env.BOA_API_KEY
const GROQ_KEYS      = [env.GROQ_API_KEY, env.GROQ_API_KEY_2, env.GROQ_API_KEY_3, env.GROQ_API_KEY_4]
const GEMINI_KEYS    = [env.GEMINI_API_KEY, env.GEMINI_API_KEY_2, env.GEMINI_API_KEY_3, env.GEMINI_API_KEY_4]
const OR_KEYS        = [env.OPENROUTER_API_KEY, env.OPENROUTER_API_KEY_2, env.OPENROUTER_API_KEY_3, env.OPENROUTER_API_KEY_4]

const ACCOUNTS = ['shivadeore111', 'Devosxprojects', 'Mohaqart', 'vie9']

async function testGroq(key, label) {
  const t0 = Date.now()
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
      signal: AbortSignal.timeout(12000),
    })
    const data = await res.json()
    const ms = Date.now() - t0
    if (data.choices?.[0]) return { label, status: 'OK', ms, model: 'llama-3.3-70b-versatile' }
    return { label, status: 'ERROR', ms, error: data.error?.message || JSON.stringify(data).slice(0,80) }
  } catch (e) {
    return { label, status: 'FAILED', ms: Date.now() - t0, error: e.message }
  }
}

async function testGemini(key, label) {
  const t0 = Date.now()
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] }),
        signal: AbortSignal.timeout(15000),
      }
    )
    const data = await res.json()
    const ms = Date.now() - t0
    if (data.candidates?.[0]) return { label, status: 'OK', ms, model: 'gemini-2.5-flash' }
    return { label, status: 'ERROR', ms, error: data.error?.message || JSON.stringify(data).slice(0,80) }
  } catch (e) {
    return { label, status: 'FAILED', ms: Date.now() - t0, error: e.message }
  }
}

async function testOpenRouter(key, label) {
  const t0 = Date.now()
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'DevOS',
      },
      body: JSON.stringify({ model: 'openrouter/free', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
      signal: AbortSignal.timeout(25000),
    })
    const data = await res.json()
    const ms = Date.now() - t0
    if (data.choices?.[0]) return { label, status: 'OK', ms, model: 'openrouter/free' }
    return { label, status: 'ERROR', ms, error: data.error?.message || JSON.stringify(data).slice(0,80) }
  } catch (e) {
    return { label, status: 'FAILED', ms: Date.now() - t0, error: e.message }
  }
}

async function testBOA(key, label) {
  const t0 = Date.now()
  try {
    const res = await fetch('https://api.boa.chat/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gemini-3-flash', messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json()
    const ms = Date.now() - t0
    if (data.choices?.[0]) return { label, status: 'OK', ms, model: 'gemini-3-flash' }
    return { label, status: 'ERROR', ms, error: data.error?.message || JSON.stringify(data).slice(0,80) }
  } catch (e) {
    return { label, status: 'FAILED', ms: Date.now() - t0, error: e.message }
  }
}

// Run all tests in parallel
console.log('\nTesting all providers...\n')

const tests = [
  // BOA
  testBOA(BOA_KEY, 'boa-1'),
  // Groq x4
  ...GROQ_KEYS.map((k, i) => testGroq(k, `groq-${i+1} (${ACCOUNTS[i]})`)),
  // Gemini x4
  ...GEMINI_KEYS.map((k, i) => testGemini(k, `gemini-${i+1} (${ACCOUNTS[i]})`)),
  // OpenRouter x4
  ...OR_KEYS.map((k, i) => testOpenRouter(k, `openrouter-${i+1} (${ACCOUNTS[i]})`)),
]

const results = await Promise.all(tests)

// Print table
const PAD = 38
console.log('Provider'.padEnd(PAD) + 'Status'.padEnd(10) + 'Latency'.padEnd(12) + 'Model')
console.log('-'.repeat(80))
for (const r of results) {
  const latency = r.status === 'OK' ? `${r.ms}ms` : '-'
  const extra   = r.status !== 'OK' ? ` (${r.error || ''})` : ''
  console.log(r.label.padEnd(PAD) + r.status.padEnd(10) + latency.padEnd(12) + (r.model || '') + extra)
}

// Summary
const ok     = results.filter(r => r.status === 'OK')
const failed = results.filter(r => r.status !== 'OK')
console.log(`\nTotal: ${results.length}  Working: ${ok.length}  Failed: ${failed.length}`)

if (ok.length > 0) {
  const fastest = ok.sort((a, b) => a.ms - b.ms)[0]
  console.log(`\nFastest: ${fastest.label} — ${fastest.ms}ms`)
}
