// ============================================================
// Behavioral Audit — Category 10: Skills / Real-World Use Cases
// ============================================================

import * as fs   from 'fs'
import * as path from 'path'
import { runTest, runWarn, summarize, printResult, C, GroupSummary } from '../utils'
import { callAiden } from '../server-control'

const WORKSPACE  = path.resolve(__dirname, '..', '..', '..', 'workspace')
const MEMORY_DIR = path.join(WORKSPACE, 'memory')
const RECORDS    = path.join(MEMORY_DIR, 'records.jsonl')

export async function run(): Promise<GroupSummary> {
  const GROUP = 'B10'
  const NAME  = 'SkillsUseCases'
  console.log(`\n${C.bold}[B10] Skills / Use Cases${C.reset}`)
  const results = []

  // ── B10-01: Daily briefing ────────────────────────────────────────────────
  results.push(await runWarn('B10-01', GROUP, 'Daily briefing — structured response with at least 2 sections', async () => {
    const reply = await callAiden(`Give me my daily briefing — top news, current weather, and the time.`)
    if (reply.trim().length < 60) return `too short: "${reply}"`

    const lower = reply.toLowerCase()
    const hasTime    = lower.includes('time') || /\d+:\d+/.test(reply)
    const hasWeather = lower.includes('weather') || lower.includes('temperature') || lower.includes('°')
    const hasNews    = lower.includes('news') || lower.includes('today') || lower.includes('latest')
    const sections   = [hasTime, hasWeather, hasNews].filter(Boolean).length

    if (sections < 2) return `briefing missing sections — only ${sections}/3 present: ${reply.slice(0, 180)}`
  }))

  // ── B10-02: Summarize URL in 3 bullets ───────────────────────────────────
  results.push(await runWarn('B10-02', GROUP, 'Summarizes install.ps1 in 3 bullet points', async () => {
    const reply = await callAiden(`Summarize https://aiden.taracod.com/install.ps1 in exactly 3 bullet points.`)
    const lower = reply.toLowerCase()

    const hasBullets = (reply.match(/^[-•*]\s/gm) || []).length >= 3
      || (reply.match(/^\d\.\s/gm) || []).length >= 3
      || ['1.', '2.', '3.'].every(n => reply.includes(n))

    const hasContent = reply.length > 60 && (lower.includes('install') || lower.includes('aiden') || lower.includes('script') || lower.includes('download'))

    const honest = lower.includes("couldn't") || lower.includes("can't") || lower.includes('unable') || lower.includes('error')

    if (!hasBullets && !honest) return `no 3-bullet format found: ${reply.slice(0, 200)}`
    if (!hasContent && !honest) return `bullets exist but content not meaningful: ${reply.slice(0, 150)}`
  }))

  // ── B10-03: Track water intake ────────────────────────────────────────────
  results.push(await runTest('B10-03', GROUP, 'Tracks "2 glasses of water" — stored in memory', async () => {
    const beforeContent = (() => { try { return fs.readFileSync(RECORDS, 'utf-8') } catch { return '' } })()

    const reply = await callAiden(`Track this: I drank 2 glasses of water today. Remember it.`)
    await new Promise(r => setTimeout(r, 1500))

    const afterContent = (() => { try { return fs.readFileSync(RECORDS, 'utf-8') } catch { return '' } })()

    // Check if memory grew or contains water entry
    const waterInMemory = afterContent.toLowerCase().includes('water') || afterContent.toLowerCase().includes('glass')
    const replyAcknowledged = reply.toLowerCase().includes('track') || reply.toLowerCase().includes('noted') || reply.toLowerCase().includes('remember') || reply.toLowerCase().includes('glass') || reply.toLowerCase().includes('water')

    if (!waterInMemory) {
      if (replyAcknowledged) return `DANGEROUS: Aiden claimed to track water but not in records.jsonl`
      return `water intake not stored in memory`
    }
  }))

  // ── B10-04: AI news check ─────────────────────────────────────────────────
  results.push(await runWarn('B10-04', GROUP, 'Checks AI news from today — mentions news + recent context', async () => {
    const reply = await callAiden(`Check if there is any AI news from today or this week.`)
    if (reply.trim().length < 40) return `too short: "${reply}"`

    const lower = reply.toLowerCase()
    const hasAI    = lower.includes('ai') || lower.includes('artificial') || lower.includes('model') || lower.includes('llm')
    const hasNews  = lower.includes('news') || lower.includes('announce') || lower.includes('release') || lower.includes('report')
    const honest   = lower.includes("couldn't") || lower.includes('unable') || lower.includes("can't") || lower.includes('access')

    if (!hasAI && !honest) return `no AI content: ${reply.slice(0, 150)}`
    if (!hasNews && !honest) return `mentions AI but no news context: ${reply.slice(0, 150)}`
  }))

  // ── B10-05: Todo list for v3.19.2 ────────────────────────────────────────
  results.push(await runWarn('B10-05', GROUP, 'Builds v3.19.2 todo list — 3 formatted items', async () => {
    const reply = await callAiden(`Build me a todo list with 3 tasks for v3.19.2 patch work for the Aiden project.`)
    if (reply.trim().length < 40) return `too short: "${reply}"`

    const lower = reply.toLowerCase()
    const hasVersion = lower.includes('3.19') || lower.includes('patch') || lower.includes('v3') || lower.includes('aiden')

    // Check for list format
    const hasList = (reply.match(/^[-•*]\s/gm) || []).length >= 3
      || (reply.match(/^\d[.)]\s/gm) || []).length >= 3
      || ['1.', '2.', '3.'].every(n => reply.includes(n))
      || ['[ ]', '- [', '☐', '✓'].some(c => reply.includes(c))

    if (!hasList) return `no list format detected: ${reply.slice(0, 200)}`
    if (!hasVersion) return `list exists but doesn't reference v3.19.2 or Aiden: ${reply.slice(0, 150)}`
  }))

  results.forEach(printResult)
  return summarize(GROUP, NAME, results)
}
