// ============================================================
// Behavioral Audit — Category 4: System Control
// ============================================================

import { execSync } from 'child_process'
import { runTest, runWarn, summarize, printResult, C, GroupSummary } from '../utils'
import { callAiden } from '../server-control'

export async function run(): Promise<GroupSummary> {
  const GROUP = 'B4'
  const NAME  = 'SystemControl'
  console.log(`\n${C.bold}[B4] System Control${C.reset}`)
  const results = []

  // ── B4-01: Running processes ──────────────────────────────────────────────
  results.push(await runTest('B4-01', GROUP, 'Shows running processes — response is a structured list', async () => {
    const reply = await callAiden(`Show me my currently running processes.`)
    const lower = reply.toLowerCase()
    // Should mention common processes or be a list
    const hasProcesses = lower.includes('explorer') || lower.includes('system') || lower.includes('svchost') || lower.includes('node') || lower.includes('process')
    const isList = reply.includes('\n') || reply.includes('-') || reply.includes('•') || /\d+/.test(reply)
    if (!hasProcesses && !isList) return `not a process list: ${reply.slice(0, 150)}`
    if (reply.trim().length < 40) return `too short to be a real process list: "${reply}"`
  }))

  // ── B4-02: Current time ───────────────────────────────────────────────────
  results.push(await runTest('B4-02', GROUP, 'Reports current time — within 5 minutes of actual', async () => {
    const actual = new Date()
    const reply  = await callAiden(`What time is it right now?`)

    // Extract time from response
    const timeMatch = reply.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i)
    if (!timeMatch) {
      const lower = reply.toLowerCase()
      if (lower.includes("don't know") || lower.includes("unable") || lower.includes("can't")) {
        return `Aiden cannot report time — tool missing or broken`
      }
      return `no time found in response: ${reply.slice(0, 150)}`
    }

    let hours = parseInt(timeMatch[1], 10)
    const mins = parseInt(timeMatch[2], 10)
    const ampm = timeMatch[4]?.toLowerCase()
    if (ampm === 'pm' && hours < 12) hours += 12
    if (ampm === 'am' && hours === 12) hours = 0

    const reportedMs  = (hours * 60 + mins) * 60 * 1000
    const actualMs    = (actual.getHours() * 60 + actual.getMinutes()) * 60 * 1000
    const diffMin     = Math.abs(reportedMs - actualMs) / 60_000
    const diffMinWrap = Math.min(diffMin, 24 * 60 - diffMin) // handle midnight wrap

    if (diffMinWrap > 5) return `time off by ${diffMinWrap.toFixed(1)} minutes — actual: ${actual.toTimeString().slice(0,5)}, got: ${timeMatch[0]}`
  }))

  // ── B4-03: OS version ─────────────────────────────────────────────────────
  results.push(await runTest('B4-03', GROUP, 'Reports OS version — mentions Windows 10 or 11', async () => {
    const reply = await callAiden(`What's my operating system version?`)
    const lower = reply.toLowerCase()
    const hasWindows = lower.includes('windows')
    const hasVersion = lower.includes('10') || lower.includes('11') || lower.includes('server') || lower.includes('build')
    if (!hasWindows) return `doesn't mention Windows: ${reply.slice(0, 150)}`
    if (!hasVersion) return `mentions Windows but no version number: ${reply.slice(0, 150)}`
    // Must NOT say Linux or macOS
    if (lower.includes('linux') || lower.includes('macos') || lower.includes('ubuntu')) {
      return `DANGEROUS: claimed wrong OS (Linux/macOS): ${reply.slice(0, 120)}`
    }
  }))

  // ── B4-04: Disk usage ────────────────────────────────────────────────────
  results.push(await runWarn('B4-04', GROUP, 'Reports C: disk usage — response has GB numbers', async () => {
    const reply = await callAiden(`Show me the disk usage for my C: drive.`)
    const hasGB = /\d+(\.\d+)?\s*(gb|tb|gigabyte|terabyte)/i.test(reply)
    const hasNum = /\d+(\.\d+)?/.test(reply)
    if (!hasGB && !hasNum) return `no disk size data in response: ${reply.slice(0, 150)}`
    if (!hasGB) return `has numbers but no GB/TB unit: ${reply.slice(0, 150)}`
  }))

  // ── B4-05: Media player state ─────────────────────────────────────────────
  results.push(await runWarn('B4-05', GROUP, 'Reports media player state — mentions song OR honestly says nothing playing', async () => {
    const reply = await callAiden(`What's playing in my media player or Spotify right now?`)
    const lower = reply.toLowerCase()
    const hasSong    = lower.includes('playing') || lower.includes('track') || lower.includes('song') || lower.includes('music') || lower.includes('spotify')
    const honest     = lower.includes('nothing') || lower.includes('not playing') || lower.includes("can't") || lower.includes('unable') || lower.includes('paused') || lower.includes('no music')
    if (!hasSong && !honest) return `neither reports media state nor admits inability: ${reply.slice(0, 150)}`
  }))

  results.forEach(printResult)
  return summarize(GROUP, NAME, results)
}
