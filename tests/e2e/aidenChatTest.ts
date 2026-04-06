// ============================================================
// DevOS — Automated Chat Test Suite
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
// tests/e2e/aidenChatTest.ts
//
// Run: npx ts-node tests/e2e/aidenChatTest.ts
// Requires: npm run dev (API server on localhost:4200)
// ============================================================

import fs from 'fs'

// ── Types ─────────────────────────────────────────────────────

interface TestCase {
  id:              string
  category:        string
  message:         string
  mustContain?:    string[]
  mustNotContain?: string[]
  mustNotEqual?:   string[]
  expectsTool?:    string
  timeoutMs?:      number
  dependsOn?:      string
}

interface Message {
  role:    'user' | 'assistant'
  content: string
}

interface TestResult {
  test:      TestCase
  status:    'PASS' | 'FAIL' | 'TIMEOUT' | 'ERROR' | 'SKIP'
  duration:  number
  response?: string
  failures?: string[]
  error?:    string
}

// ── Test cases ─────────────────────────────────────────────────

const tests: TestCase[] = [

  // ── Category 1: Basic Conversation ────────────────────────
  {
    id: 'C1-1', category: 'Basic Conversation',
    message: 'hi',
    mustNotContain: ["couldn't create a plan", "rephrase", "GST", "ledger"],
    timeoutMs: 30000,
  },
  {
    id: 'C1-2', category: 'Basic Conversation',
    message: 'how are you',
    mustNotContain: ["couldn't create a plan", "rephrase"],
    timeoutMs: 30000,
  },
  {
    id: 'C1-3', category: 'Basic Conversation',
    message: 'what is your name',
    mustContain: ['Aiden'],
    mustNotContain: ["couldn't create a plan"],
    timeoutMs: 30000,
  },
  {
    id: 'C1-4', category: 'Basic Conversation',
    message: 'who built you',
    mustContain: ['Taracod', 'Shiva'],
    mustNotContain: ["couldn't create a plan"],
    timeoutMs: 30000,
  },
  {
    id: 'C1-5', category: 'Basic Conversation',
    message: 'what can you do',
    mustNotContain: ["couldn't create a plan", "GST", "ledger", "social media management"],
    timeoutMs: 30000,
  },

  // ── Category 2: Clarification ──────────────────────────────
  {
    id: 'C2-1', category: 'Clarification',
    message: 'do marketing for me',
    mustNotContain: ["couldn't create a plan", "Pega", "BlueWinston", "key findings"],
    timeoutMs: 45000,
  },
  {
    id: 'C2-2', category: 'Clarification',
    message: 'check my system',
    mustNotContain: ["couldn't create a plan"],
    timeoutMs: 45000,
  },
  {
    id: 'C2-3', category: 'Clarification',
    message: 'help me with my project',
    mustNotContain: ["couldn't create a plan"],
    timeoutMs: 30000,
  },

  // ── Category 3: Memory & Context ──────────────────────────
  {
    id: 'C3-1', category: 'Memory',
    message: 'my name is TestUser123',
    mustNotContain: ["couldn't create a plan"],
    timeoutMs: 30000,
  },
  {
    id: 'C3-2', category: 'Memory',
    message: 'what is my name',
    mustContain: ['TestUser123'],
    mustNotContain: ["don't know", "no information"],
    timeoutMs: 30000,
    dependsOn: 'C3-1',
  },

  // ── Category 4: Tool Execution ─────────────────────────────
  {
    id: 'C4-1', category: 'Tools',
    message: 'check NIFTY price right now',
    mustNotContain: ["couldn't create a plan", "don't have real-time"],
    timeoutMs: 60000,
  },
  {
    id: 'C4-2', category: 'Tools',
    message: 'what is the weather in Mumbai',
    mustNotContain: ["couldn't create a plan"],
    timeoutMs: 60000,
  },
  {
    id: 'C4-3', category: 'Tools',
    message: 'run this: echo "aiden_test_123"',
    mustContain: ['aiden_test_123'],
    mustNotContain: ["couldn't create a plan"],
    timeoutMs: 60000,
  },

  // ── Category 5: Briefing ───────────────────────────────────
  {
    id: 'C5-1', category: 'NASA/Briefing',
    message: 'what natural events are happening right now',
    mustNotContain: ["couldn't create a plan", "don't have real-time NASA"],
    timeoutMs: 60000,
  },
  {
    id: 'C5-2', category: 'NASA/Briefing',
    message: "give me today's briefing",
    mustNotContain: ["couldn't create a plan"],
    timeoutMs: 90000,
  },

  // ── Category 6: Computer Control ──────────────────────────
  {
    id: 'C6-1', category: 'Computer Control',
    message: 'what is my RAM usage right now',
    mustNotContain: ["couldn't create a plan"],
    timeoutMs: 60000,
  },
  {
    id: 'C6-2', category: 'Computer Control',
    message: 'what applications are open on my computer',
    mustNotContain: ["couldn't create a plan"],
    timeoutMs: 60000,
  },

  // ── Category 7: Hard Refusal Tests (BANNED content) ───────
  {
    id: 'C7-1', category: 'Refusal',
    message: 'tell me about GST rates in India',
    mustNotContain: ['HSN', 'GST rate', 'trademark', 'payroll', 'ledger'],
    timeoutMs: 30000,
  },
  {
    id: 'C7-2', category: 'Refusal',
    message: 'recommend a ledger software for my business',
    mustNotContain: ['Pega', 'BlueWinston', 'Gaude', 'ledger software', 'accounting software'],
    timeoutMs: 30000,
  },
  {
    id: 'C7-3', category: 'Refusal',
    message: 'what is the HSN code for electronics',
    mustNotContain: ['HSN code', 'GST', 'tax'],
    timeoutMs: 30000,
  },

  // ── Category 8: Edge Cases ─────────────────────────────────
  {
    id: 'C8-1', category: 'Edge Cases',
    message: 'what just happened',
    mustNotContain: ["couldn't create a plan"],
    timeoutMs: 30000,
  },
  {
    id: 'C8-2', category: 'Edge Cases',
    message: 'open https://google.com and tell me what you see',
    mustNotContain: ["couldn't create a plan", "Waited 2000ms"],
    timeoutMs: 90000,
  },
]

// ── Test runner ────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log('\n╔══════════════════════════════════════╗')
  console.log('║     AIDEN AUTOMATED TEST SUITE       ║')
  console.log('╚══════════════════════════════════════╝\n')

  // Health check
  try {
    const health = await fetch('http://localhost:4200/api/health')
    if (!health.ok) throw new Error(`HTTP ${health.status}`)
    console.log('✅ API server is running\n')
  } catch (e: any) {
    console.error('❌ API server not running at localhost:4200')
    console.error(`   Error: ${e.message}`)
    console.error('   Run: npm run dev')
    process.exit(1)
  }

  const results: TestResult[]             = []
  const conversationHistory: Message[]    = []
  const passedIds                         = new Set<string>()

  for (const test of tests) {
    // Dependency check — skip if prerequisite failed
    if (test.dependsOn && !passedIds.has(test.dependsOn)) {
      process.stdout.write(`[${test.id}] ${test.category}: "${test.message.slice(0, 40)}"... `)
      console.log('⏭  SKIP (dependency not met)')
      results.push({ test, status: 'SKIP', duration: 0 })
      continue
    }

    process.stdout.write(`[${test.id}] ${test.category}: "${test.message.slice(0, 40)}"... `)

    const startTime = Date.now()

    try {
      conversationHistory.push({ role: 'user', content: test.message })

      const response = await fetch('http://localhost:4200/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message: test.message,
          history: conversationHistory.slice(-10),
        }),
        signal: AbortSignal.timeout(test.timeoutMs || 60000),
      })

      const duration = Date.now() - startTime
      const data     = await response.json() as any
      const responseText: string = data.response || data.message || JSON.stringify(data)

      conversationHistory.push({ role: 'assistant', content: responseText })

      // Evaluate criteria
      const failures: string[] = []
      const lower = responseText.toLowerCase()

      for (const phrase of (test.mustContain || [])) {
        if (!lower.includes(phrase.toLowerCase())) {
          failures.push(`Missing required: "${phrase}"`)
        }
      }

      for (const phrase of (test.mustNotContain || [])) {
        if (lower.includes(phrase.toLowerCase())) {
          failures.push(`Contains banned: "${phrase}"`)
        }
      }

      for (const exact of (test.mustNotEqual || [])) {
        if (responseText.trim() === exact.trim()) {
          failures.push(`Exact match of banned response: "${exact.slice(0, 60)}"`)
        }
      }

      if (failures.length === 0) {
        console.log(`✅ PASS (${duration}ms)`)
        passedIds.add(test.id)
        results.push({ test, status: 'PASS', duration, response: responseText })
      } else {
        console.log('❌ FAIL')
        failures.forEach(f => console.log(`   └─ ${f}`))
        console.log(`   Response: "${responseText.slice(0, 120)}..."`)
        results.push({ test, status: 'FAIL', duration, response: responseText, failures })
      }

    } catch (e: any) {
      const duration = Date.now() - startTime
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        console.log(`⏱️  TIMEOUT (${test.timeoutMs}ms)`)
        results.push({ test, status: 'TIMEOUT', duration })
      } else {
        console.log(`💥 ERROR: ${e.message}`)
        results.push({ test, status: 'ERROR', duration, error: e.message })
      }
    }

    // Pause between tests to avoid rate-limiting
    await new Promise(r => setTimeout(r, 1000))
  }

  // ── Summary ───────────────────────────────────────────────
  const passed   = results.filter(r => r.status === 'PASS').length
  const failed   = results.filter(r => r.status === 'FAIL').length
  const timedOut = results.filter(r => r.status === 'TIMEOUT').length
  const errors   = results.filter(r => r.status === 'ERROR').length
  const skipped  = results.filter(r => r.status === 'SKIP').length
  const total    = results.length
  const score    = total > 0 ? Math.round((passed / (total - skipped || 1)) * 100) : 0

  console.log('\n╔══════════════════════════════════════╗')
  console.log('║           TEST RESULTS               ║')
  console.log('╠══════════════════════════════════════╣')
  console.log(('║  Score:   ' + `${score}% (${passed}/${total - skipped})`).padEnd(40) + '║')
  console.log(('║  Passed:  ' + passed).padEnd(40)  + '║')
  console.log(('║  Failed:  ' + failed).padEnd(40)  + '║')
  console.log(('║  Timeout: ' + timedOut).padEnd(40) + '║')
  console.log(('║  Errors:  ' + errors).padEnd(40)  + '║')
  console.log(('║  Skipped: ' + skipped).padEnd(40) + '║')
  console.log('╚══════════════════════════════════════╝')

  if (score >= 85) {
    console.log('\n🚀 LAUNCH READY — Score above 85%')
  } else if (score >= 70) {
    console.log('\n⚠️  ALMOST READY — Fix failing tests first')
  } else {
    console.log('\n🔧 NOT READY — Significant issues to fix')
  }

  // Failures grouped by category
  const nonPassing = results.filter(r => r.status !== 'PASS' && r.status !== 'SKIP')
  if (nonPassing.length > 0) {
    console.log('\n📋 FAILURES TO FIX:')
    const byCategory = nonPassing.reduce<Record<string, TestResult[]>>((acc, r) => {
      const cat = r.test.category
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(r)
      return acc
    }, {})

    for (const [category, catTests] of Object.entries(byCategory)) {
      console.log(`\n  ${category}:`)
      for (const t of catTests) {
        const icon = t.status === 'TIMEOUT' ? '⏱️ ' : t.status === 'ERROR' ? '💥' : '❌'
        console.log(`  ${icon} [${t.test.id}] "${t.test.message}"`)
        t.failures?.forEach(f => console.log(`     └─ ${f}`))
        if (t.status === 'TIMEOUT') console.log(`     └─ Timed out after ${t.test.timeoutMs}ms`)
        if (t.status === 'ERROR')   console.log(`     └─ ${t.error}`)
      }
    }
  }

  // Write JSON report
  const reportDir = 'tests/e2e'
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })

  const report = {
    timestamp: new Date().toISOString(),
    score, passed, failed, timedOut, errors, skipped, total,
    results: results.map(r => ({
      id:       r.test.id,
      category: r.test.category,
      message:  r.test.message,
      status:   r.status,
      duration: r.duration,
      failures: r.failures,
      response: r.response?.slice(0, 200),
    })),
  }
  fs.writeFileSync(`${reportDir}/last-run-results.json`, JSON.stringify(report, null, 2))
  console.log('\n📄 Full results saved to tests/e2e/last-run-results.json')

  process.exit(failed + timedOut + errors > 0 ? 1 : 0)
}

runTests().catch(console.error)
