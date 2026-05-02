// ============================================================
// Behavioral Audit — Category 9: Subagent / Delegation
// Light verification: response content
// ============================================================

import { runTest, runWarn, summarize, printResult, C, GroupSummary } from '../utils'
import { callAiden } from '../server-control'

function countDistinct(text: string, marker: string | RegExp): number {
  if (typeof marker === 'string') {
    let count = 0, pos = 0
    while ((pos = text.indexOf(marker, pos)) !== -1) { count++; pos++ }
    return count
  }
  return (text.match(marker) || []).length
}

export async function run(): Promise<GroupSummary> {
  const GROUP = 'B9'
  const NAME  = 'SubagentDelegation'
  console.log(`\n${C.bold}[B9] Subagent / Delegation${C.reset}`)
  const results = []

  // ── B9-01: /spawn 3 jokes ─────────────────────────────────────────────────
  results.push(await runWarn('B9-01', GROUP, '/spawn write 3 jokes about Python — response has 3 distinct items', async () => {
    const reply = await callAiden(`/spawn write 3 jokes about Python programming`)
    if (reply.trim().length < 50) return `response too short: "${reply}"`

    const lower = reply.toLowerCase()
    const hasPython = lower.includes('python')
    if (!hasPython) return `response doesn't mention Python: ${reply.slice(0, 120)}`

    // Count joke markers
    const numbered = countDistinct(reply, /\b[123]\b|\b(one|two|three)\b/gi)
    const listed   = countDistinct(reply, /^[-•*]\s/gm)
    const hasThree = numbered >= 3 || listed >= 3 || reply.split(/\n{2,}/).filter(s => s.trim().length > 10).length >= 3

    if (!hasThree) return `couldn't find 3 distinct jokes: ${reply.slice(0, 200)}`
  }))

  // ── B9-02: /swarm focus question ─────────────────────────────────────────
  results.push(await runWarn('B9-02', GROUP, '/swarm synthesizes multiple perspectives on focus improvement', async () => {
    const reply = await callAiden(`/swarm what are 3 ways to improve focus`)
    if (reply.trim().length < 60) return `response too short: "${reply}"`

    const lower = reply.toLowerCase()
    const hasFocus = lower.includes('focus') || lower.includes('concentration') || lower.includes('attention')
    if (!hasFocus) return `response doesn't address focus: ${reply.slice(0, 120)}`

    // Should be structured or substantive
    const hasStructure = reply.split('\n').length > 3 || reply.length > 200
    if (!hasStructure) return `not substantive enough: ${reply.slice(0, 150)}`
  }))

  // ── B9-03: Subagent for GraphQL vs REST ──────────────────────────────────
  results.push(await runWarn('B9-03', GROUP, 'Subagent researches GraphQL vs REST — substantive response (>200 chars)', async () => {
    const reply = await callAiden(`Use a subagent to research the differences between GraphQL and REST API design. Give me a structured comparison.`)
    if (reply.trim().length < 200) return `too short (${reply.length} chars) — not substantive: ${reply.slice(0, 150)}`
    const lower = reply.toLowerCase()
    if (!lower.includes('graphql')) return `doesn't mention GraphQL: ${reply.slice(0, 120)}`
    if (!lower.includes('rest')) return `doesn't mention REST: ${reply.slice(0, 120)}`
  }))

  // ── B9-04: /spawn count to 10 ────────────────────────────────────────────
  results.push(await runWarn('B9-04', GROUP, '/spawn count to 10 — response shows 1 through 10', async () => {
    const reply = await callAiden(`/spawn count from 1 to 10`)
    // Check for numbers 1-10
    const nums = [1,2,3,4,5,6,7,8,9,10]
    const missing = nums.filter(n => !new RegExp(`\\b${n}\\b`).test(reply))
    if (missing.length > 3) return `missing ${missing.length} numbers (${missing.join(',')}): ${reply.slice(0, 120)}`
  }))

  // ── B9-05: Parallel haikus ────────────────────────────────────────────────
  results.push(await runWarn('B9-05', GROUP, 'Spawns parallel subagents for 3 coding haikus — 3 distinct haikus in response', async () => {
    const reply = await callAiden(`Spawn 3 parallel subagents, each writing a different haiku about coding. Show me all 3 haikus.`)
    if (reply.trim().length < 80) return `response too short: "${reply}"`

    const lower = reply.toLowerCase()
    const haiku  = lower.includes('haiku') || lower.includes('syllable') || reply.includes('\n')
    if (!haiku) return `no haiku structure visible: ${reply.slice(0, 150)}`

    // Count distinct short stanzas (haikus are ~3 lines each)
    const stanzas = reply.split(/\n{2,}/).filter(s => s.trim().length > 10)
    if (stanzas.length < 3) {
      // Try counting numbered items
      const numbered = (reply.match(/\b[123]\b|haiku\s*[123]/gi) || []).length
      if (numbered < 3) return `couldn't find 3 distinct haikus: ${reply.slice(0, 200)}`
    }
  }))

  results.forEach(printResult)
  return summarize(GROUP, NAME, results)
}
