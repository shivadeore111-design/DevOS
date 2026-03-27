// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/stressTest.ts — 20-task internal stress test.
//
// Usage:
//   1. Start DevOS:  npx ts-node index.ts serve
//   2. In a new terminal: npm run stress-test
//
// Pass criteria: >= 90% of tests pass (keyword match >= 50% AND response length > 20)

import * as fs from 'fs'
import * as http from 'http'

const BASE      = 'http://localhost:4200'
const SESSION   = `stress_${Date.now()}`

interface TestCase {
  name:             string
  message:          string
  expectedKeywords: string[]
  timeoutMs:        number
}

const TEST_CASES: TestCase[] = [
  {
    name:             'Capabilities query',
    message:          'what tools and capabilities do you have',
    expectedKeywords: ['web_search', 'tools', 'files'],
    timeoutMs:        12000,
  },
  {
    name:             'Basic web search',
    message:          'search the web for latest AI news',
    expectedKeywords: ['ai', 'news'],
    timeoutMs:        30000,
  },
  {
    name:             'Weather query',
    message:          'what is the weather in Mumbai India right now',
    expectedKeywords: ['mumbai', '°'],
    timeoutMs:        25000,
  },
  {
    name:             'Stock data',
    message:          'get NSE top gainers today',
    expectedKeywords: ['nse', 'gain'],
    timeoutMs:        30000,
  },
  {
    name:             'Create a file',
    message:          'create a file called test_devos_55.txt in my workspace folder with content: DevOS Sprint 55 stress test passed',
    expectedKeywords: ['test_devos_55', 'created', 'written'],
    timeoutMs:        25000,
  },
  {
    name:             'Research and save',
    message:          'research what is quantum computing in 3 sentences and save to workspace/quantum_55.txt',
    expectedKeywords: ['quantum', 'saved', 'workspace'],
    timeoutMs:        70000,
  },
  {
    name:             'Memory reference',
    message:          'what files did we just create in this conversation',
    expectedKeywords: ['test_devos_55', 'quantum'],
    timeoutMs:        12000,
  },
  {
    name:             'System info',
    message:          'what are my system specs — CPU, RAM, OS',
    expectedKeywords: ['ram', 'cpu', 'gb'],
    timeoutMs:        20000,
  },
  {
    name:             'Python execution',
    message:          'run a python script that prints the first 7 fibonacci numbers',
    expectedKeywords: ['1', '2', '3', '5', '8'],
    timeoutMs:        35000,
  },
  {
    name:             'Deep research',
    message:          'do deep research on large language models and give me a 3 sentence summary',
    expectedKeywords: ['language', 'model', 'training'],
    timeoutMs:        100000,
  },
  {
    name:             'Read a file',
    message:          'read the file workspace/quantum_55.txt and tell me what it says',
    expectedKeywords: ['quantum'],
    timeoutMs:        20000,
  },
  {
    name:             'Math via Python',
    message:          'calculate compound interest on 100000 rupees at 8% for 10 years using python',
    expectedKeywords: ['215', 'interest'],
    timeoutMs:        35000,
  },
  {
    name:             'PowerShell list files',
    message:          'run a powershell command to list files in the current directory',
    expectedKeywords: ['package.json', 'index'],
    timeoutMs:        20000,
  },
  {
    name:             'Take screenshot',
    message:          'take a screenshot of my screen',
    expectedKeywords: ['screenshot', 'saved'],
    timeoutMs:        20000,
  },
  {
    name:             'Knowledge base empty state',
    message:          'search my knowledge base for anything about trading strategies',
    expectedKeywords: ['knowledge', 'trading'],
    timeoutMs:        15000,
  },
  {
    name:             'Fetch URL',
    message:          'fetch the content from https://httpbin.org/get and tell me what you see',
    expectedKeywords: ['httpbin', 'url'],
    timeoutMs:        25000,
  },
  {
    name:             'Run Node.js UUID',
    message:          "run a node.js script that generates a random UUID using crypto.randomUUID() and prints it",
    expectedKeywords: ['-'],
    timeoutMs:        35000,
  },
  {
    name:             'Conversation context recall',
    message:          'what did we research earlier in this conversation',
    expectedKeywords: ['quantum', 'language'],
    timeoutMs:        12000,
  },
  {
    name:             'Graceful error handling',
    message:          'read the file C:\\nonexistent_path\\fake_file_xyz_devos.txt and tell me what happens',
    expectedKeywords: ['not found', 'error', 'exist'],
    timeoutMs:        15000,
  },
  {
    name:             'Direct factual answer (no tools)',
    message:          'what is the capital of Japan',
    expectedKeywords: ['tokyo'],
    timeoutMs:        10000,
  },
]

interface TestResult {
  name:             string
  passed:           boolean
  response:         string
  duration:         number
  error?:           string
  missingKeywords?: string[]
  keywordScore:     number
}

// ── HTTP SSE reader ───────────────────────────────────────────

function readSSE(url: string, body: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let   fullResponse = ''
    const timer        = setTimeout(() => reject(new Error(`SSE timeout after ${timeoutMs}ms`)), timeoutMs)

    const req = http.request(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      res.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n').filter((l: string) => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.token)           fullResponse += data.token
            if (data.done === true) { clearTimeout(timer); resolve(fullResponse) }
          } catch {}
        }
      })
      res.on('end',   () => { clearTimeout(timer); resolve(fullResponse) })
      res.on('error', (e: Error) => { clearTimeout(timer); reject(e) })
    })
    req.on('error', (e: Error) => { clearTimeout(timer); reject(e) })
    req.write(body)
    req.end()
  })
}

// ── Single test runner ────────────────────────────────────────

async function runTest(tc: TestCase): Promise<TestResult> {
  const start = Date.now()
  let fullResponse = ''

  try {
    const body = JSON.stringify({
      message:   tc.message,
      history:   [],
      mode:      'auto',
      sessionId: SESSION,
    })

    const url = new URL('/api/chat', BASE)
    fullResponse = await readSSE(url.toString(), body, tc.timeoutMs)

    const lower           = fullResponse.toLowerCase()
    const missingKeywords = tc.expectedKeywords.filter(kw => !lower.includes(kw.toLowerCase()))
    const keywordScore    = 1 - (missingKeywords.length / tc.expectedKeywords.length)
    const passed          = keywordScore >= 0.5 && fullResponse.length > 20

    return {
      name:             tc.name,
      passed,
      response:         fullResponse.slice(0, 200),
      duration:         Date.now() - start,
      keywordScore:     Math.round(keywordScore * 100),
      missingKeywords:  missingKeywords.length > 0 ? missingKeywords : undefined,
    }

  } catch (e: any) {
    return {
      name:         tc.name,
      passed:       false,
      response:     fullResponse.slice(0, 100),
      duration:     Date.now() - start,
      error:        e.message,
      keywordScore: 0,
    }
  }
}

// ── Main runner ───────────────────────────────────────────────

async function runStressTest(): Promise<void> {
  // Verify DevOS is running
  try {
    await new Promise<void>((resolve, reject) => {
      const req = http.get(`${BASE}/api/health`, (res) => {
        if (res.statusCode === 200) resolve()
        else reject(new Error(`Health check returned ${res.statusCode}`))
      })
      req.on('error', reject)
      req.setTimeout(3000, () => reject(new Error('Health check timeout')))
    })
  } catch {
    console.error('\n✗ DevOS is not running. Start it first:\n  npx ts-node index.ts serve\n')
    process.exit(1)
  }

  console.log('\n╔═══════════════════════════════════════════════════════╗')
  console.log('║  DevOS Sprint 55 — Stress Test (20 tasks)            ║')
  console.log(`║  Session: ${SESSION.slice(0, 20).padEnd(20)}                   ║`)
  console.log('╚═══════════════════════════════════════════════════════╝\n')

  const results: TestResult[] = []
  let   passed = 0
  let   failed = 0

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i]
    process.stdout.write(`[${String(i + 1).padStart(2)}/${TEST_CASES.length}] ${tc.name.padEnd(36)} ... `)

    const result = await runTest(tc)
    results.push(result)

    if (result.passed) {
      passed++
      console.log(`✓  (${result.duration}ms, kw: ${result.keywordScore}%)`)
    } else {
      failed++
      console.log(`✗  (${result.duration}ms)`)
      if (result.error)           console.log(`          Error: ${result.error}`)
      if (result.missingKeywords) console.log(`          Missing: ${result.missingKeywords.join(', ')}`)
      if (result.response)        console.log(`          Got: ${result.response.slice(0, 100)}`)
    }

    // Small delay between tests — prevents hammering the planner
    if (i < TEST_CASES.length - 1) {
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  const successRate = Math.round((passed / TEST_CASES.length) * 100)
  const target      = 90

  console.log('\n╔═══════════════════════════════════════════════════════╗')
  console.log(`║  Results: ${passed}/${TEST_CASES.length} passed (${successRate}%)${' '.repeat(Math.max(0, 27 - String(successRate).length))}║`)
  console.log('╚═══════════════════════════════════════════════════════╝\n')

  if (successRate >= target) {
    console.log(`✓ TARGET MET (${target}%+) — DevOS reliability verified`)
  } else {
    const needed = Math.ceil(TEST_CASES.length * target / 100) - passed
    console.log(`✗ TARGET MISSED — need ${needed} more pass(es) to reach ${target}%`)
    console.log('\nFailed tests:')
    results.filter(r => !r.passed).forEach(r => {
      const reason = r.error || (r.missingKeywords ? `missing: ${r.missingKeywords.join(', ')}` : 'short response')
      console.log(`  - ${r.name}: ${reason}`)
    })
  }

  // Save full report
  const reportDir  = path.join(process.cwd(), 'workspace')
  const reportPath = path.join(reportDir, `stress_test_${Date.now()}.json`)
  try {
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp:   new Date().toISOString(),
      session:     SESSION,
      successRate,
      passed,
      failed,
      total:       TEST_CASES.length,
      targetPct:   target,
      targetMet:   successRate >= target,
      results,
    }, null, 2))
    console.log(`\nFull report: ${reportPath}`)
  } catch {}

  process.exit(successRate >= target ? 0 : 1)
}

// ── Path helper ───────────────────────────────────────────────
import * as path from 'path'

runStressTest().catch(e => { console.error('[StressTest] Fatal:', e.message); process.exit(1) })
