import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import os from 'os'

const API = 'http://localhost:4200'
const APPDATA = process.env.APPDATA || ''
const WORKSPACE = path.join(APPDATA, 'devos-ai', 'workspace')
const LOG_FILE = path.join(APPDATA, 'devos-ai', 'aiden.log')

interface TestResult {
  name: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  detail: string
}

const results: TestResult[] = []

function log(test: string, status: 'PASS' | 'FAIL' | 'SKIP', detail: string) {
  results.push({ name: test, status, detail })
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⊘'
  console.log(`  ${icon} ${test}: ${status} — ${detail}`)
}

async function chatMessage(message: string): Promise<string> {
  const res = await fetch(`${API}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ message, mode: 'auto', history: [] })
  })
  const data = await res.json() as any
  return data.message || data.response || JSON.stringify(data)
}

async function runTests() {
  console.log('\n========================================')
  console.log('  AIDEN RELIABILITY SPRINT — 13 TESTS')
  console.log('========================================\n')

  // Check API is running
  try {
    const health = await fetch(`${API}/api/health`)
    const h = await health.json() as any
    console.log(`  API: ${h.status} v${h.version}\n`)
  } catch {
    console.log('  ✗ API server not running! Start with: npm run dev')
    process.exit(1)
  }

  // ── Test 1 — Memory recall across sessions ──────────────────
  console.log('Test 1: Memory Recall Across Sessions')
  try {
    await chatMessage('My favorite color is blue and I was born in Nashik')
    await new Promise(r => setTimeout(r, 3000))
    const recall = await chatMessage('What is my favorite color and where was I born?')
    const hasBlue   = recall.toLowerCase().includes('blue')
    const hasNashik = recall.toLowerCase().includes('nashik')
    if (hasBlue && hasNashik) {
      log('Memory Recall', 'PASS', `Recalled both: blue + Nashik`)
    } else {
      log('Memory Recall', 'FAIL', `Got: ${recall.slice(0, 100)}`)
    }
  } catch (e: any) {
    log('Memory Recall', 'FAIL', e.message)
  }

  // ── Test 2 — Dream Engine ────────────────────────────────────
  console.log('Test 2: Dream Engine')
  try {
    const devLog = path.join(process.cwd(), 'workspace', 'dream.lock')
    if (fs.existsSync(LOG_FILE)) {
      const logContent = fs.readFileSync(LOG_FILE, 'utf8')
      const dreamLines = logContent.split('\n').filter(l => l.toLowerCase().includes('dream'))
      if (dreamLines.length > 0) {
        log('Dream Engine', 'PASS', `${dreamLines.length} dream log entries found`)
      } else {
        log('Dream Engine', 'FAIL', 'No [Dream] entries in log — may not have fired yet')
      }
    } else {
      log('Dream Engine', fs.existsSync(devLog) ? 'PASS' : 'FAIL',
        fs.existsSync(devLog) ? 'dream.lock exists' : 'No dream.lock or log entries')
    }
  } catch (e: any) {
    log('Dream Engine', 'FAIL', e.message)
  }

  // ── Test 3 — Instinct System ─────────────────────────────────
  console.log('Test 3: Instinct System')
  try {
    const instinctsPath = path.join(WORKSPACE, 'instincts.json')
    const devInstincts  = path.join(process.cwd(), 'workspace', 'instincts.json')
    const p = fs.existsSync(instinctsPath) ? instinctsPath : devInstincts
    if (fs.existsSync(p)) {
      const data  = JSON.parse(fs.readFileSync(p, 'utf8'))
      const count = Array.isArray(data) ? data.length : Object.keys(data).length
      log('Instinct System', count > 0 ? 'PASS' : 'FAIL', `${count} instincts recorded`)
    } else {
      log('Instinct System', 'FAIL', 'instincts.json not found')
    }
  } catch (e: any) {
    log('Instinct System', 'FAIL', e.message)
  }

  // ── Test 4 — Pattern Detection ───────────────────────────────
  console.log('Test 4: Pattern Detection')
  try {
    const res  = await fetch(`${API}/api/patterns`)
    const data = await res.json() as any
    const count = data.patterns?.length || data.count || 0
    log('Pattern Detection', 'PASS', `${count} patterns detected, endpoint responding`)
  } catch (e: any) {
    log('Pattern Detection', 'FAIL', e.message)
  }

  // ── Test 5 — MCP Server ──────────────────────────────────────
  console.log('Test 5: MCP Server')
  try {
    // MCP server exposes GET /health, not a root handler — hit the correct path
    const res  = await fetch('http://localhost:3001/health')
    const data = await res.json() as any
    const toolCount = data.tools || 0
    log('MCP Server', res.ok && data.status === 'ok' ? 'PASS' : 'FAIL',
      `status=${data.status}, tools=${toolCount}, name=${data.name}`)
  } catch (e: any) {
    log('MCP Server', 'FAIL', `localhost:3001/health unreachable: ${e.message}`)
  }

  // ── Test 6 — Knowledge Clipper ───────────────────────────────
  console.log('Test 6: Knowledge Clipper')
  try {
    const res = await fetch(`${API}/api/clip`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        content: 'Test knowledge clip from reliability sprint',
        source:  'automated-test',
        title:   'Reliability Test Clip',
      }),
    })
    const data = await res.json() as any
    log('Knowledge Clipper', data.success ? 'PASS' : 'FAIL', JSON.stringify(data).slice(0, 100))
  } catch (e: any) {
    log('Knowledge Clipper', 'FAIL', e.message)
  }

  // ── Test 7 — PreCompact Hook ─────────────────────────────────
  console.log('Test 7: PreCompact Hook')
  try {
    if (fs.existsSync(LOG_FILE)) {
      const logContent = fs.readFileSync(LOG_FILE, 'utf8')
      const hookLines  = logContent.split('\n').filter(l =>
        l.includes('pre_compact') || l.includes('PreCompact')
      )
      log('PreCompact Hook', hookLines.length > 0 ? 'PASS' : 'SKIP',
        hookLines.length > 0
          ? `${hookLines.length} entries`
          : 'Not triggered yet — needs 40+ messages in one session')
    } else {
      log('PreCompact Hook', 'SKIP', 'No log file to check')
    }
  } catch (e: any) {
    log('PreCompact Hook', 'FAIL', e.message)
  }

  // ── Test 8 — Scheduler ───────────────────────────────────────
  console.log('Test 8: Scheduler')
  try {
    const res = await fetch(`${API}/api/tasks`)
    if (res.ok) {
      const data  = await res.json() as any
      const count = Array.isArray(data) ? data.length : (data.tasks?.length || 0)
      log('Scheduler', 'PASS', `Endpoint responding, ${count} tasks`)
    } else {
      log('Scheduler', 'FAIL', `Status: ${res.status}`)
    }
  } catch (e: any) {
    log('Scheduler', 'FAIL', e.message)
  }

  // ── Test 9 — Desktop Notification ───────────────────────────
  console.log('Test 9: Desktop Notification')
  try {
    const reply = await chatMessage('send me a desktop notification saying reliability test passed')
    const sent  = reply.toLowerCase().includes('sent') || reply.toLowerCase().includes('notification')
    log('Desktop Notification', sent ? 'PASS' : 'FAIL', reply.slice(0, 100))
  } catch (e: any) {
    log('Desktop Notification', 'FAIL', e.message)
  }

  // ── Test 10 — Git Tools ──────────────────────────────────────
  console.log('Test 10: Git Tools')
  try {
    const reply  = await chatMessage('show git status of C:\\Users\\shiva\\DevOS')
    const hasGit = reply.toLowerCase().includes('branch')
      || reply.toLowerCase().includes('commit')
      || reply.toLowerCase().includes('modified')
      || reply.toLowerCase().includes('clean')
    log('Git Tools', hasGit ? 'PASS' : 'FAIL', reply.slice(0, 100))
  } catch (e: any) {
    log('Git Tools', 'FAIL', e.message)
  }

  // ── Test 11 — Pro Feature Gates ──────────────────────────────
  console.log('Test 11: Pro Feature Gates')
  try {
    const res  = await fetch(`${API}/api/license/pro-status`)
    const data = await res.json() as any
    if (!data.isPro) {
      for (let i = 1; i <= 6; i++) {
        await chatMessage(`create a goal: reliability test goal ${i}`)
      }
      const goals      = await chatMessage('show my goals')
      const goalCount  = (goals.match(/reliability test goal/g) || []).length
      if (goalCount <= 5) {
        log('Pro Feature Gates', 'PASS', `${goalCount} goals created, limit enforced`)
      } else {
        log('Pro Feature Gates', 'FAIL', `${goalCount} goals created — limit NOT enforced`)
      }
    } else {
      log('Pro Feature Gates', 'SKIP', 'Pro tier active — cannot test free limits')
    }
  } catch (e: any) {
    log('Pro Feature Gates', 'FAIL', e.message)
  }

  // ── Test 12 — Dispatch Queue ─────────────────────────────────
  console.log('Test 12: Dispatch Queue')
  try {
    const postRes = await fetch(`${API}/api/queue`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: 'What time is it?', source: 'reliability-test' }),
    })
    const postData  = await postRes.json() as any
    const hasTaskId = !!postData.taskId || !!postData.id
    await new Promise(r => setTimeout(r, 3000))
    const getRes  = await fetch(`${API}/api/queue`)
    const getData = await getRes.json() as any
    log('Dispatch Queue', hasTaskId ? 'PASS' : 'FAIL',
      `POST: ${JSON.stringify(postData).slice(0, 80)}, GET: ${JSON.stringify(getData).slice(0, 80)}`)
  } catch (e: any) {
    log('Dispatch Queue', 'FAIL', e.message)
  }

  // ── Test 13 — Workflow Visualization ─────────────────────────
  console.log('Test 13: Workflow Visualization')
  try {
    const res = await fetch(`${API}/api/workflow`)
    log('Workflow Visualization', res.ok ? 'PASS' : 'FAIL', `Status: ${res.status}`)
  } catch (e: any) {
    log('Workflow Visualization', 'FAIL', e.message)
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log('\n========================================')
  console.log('  RESULTS SUMMARY')
  console.log('========================================')
  const passed  = results.filter(r => r.status === 'PASS').length
  const failed  = results.filter(r => r.status === 'FAIL').length
  const skipped = results.filter(r => r.status === 'SKIP').length
  console.log(`  PASS: ${passed}  |  FAIL: ${failed}  |  SKIP: ${skipped}  |  Total: ${results.length}`)
  console.log('========================================\n')

  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '⊘'
    console.log(`  ${icon} ${r.name}: ${r.status}`)
  })

  // Clean up test goals
  console.log('\n  Cleaning up test goals...')
  try {
    for (let i = 1; i <= 6; i++) {
      await chatMessage(`remove goal: reliability test goal ${i}`)
    }
  } catch {}

  console.log('\n  Done.\n')
  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(console.error)
