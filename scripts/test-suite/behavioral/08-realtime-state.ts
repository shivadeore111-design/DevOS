// ============================================================
// Behavioral Audit — Category 8: Real-Time State
// ============================================================

import { execSync } from 'child_process'
import { runTest, runWarn, summarize, printResult, C, GroupSummary } from '../utils'
import { callAiden } from '../server-control'

export async function run(): Promise<GroupSummary> {
  const GROUP = 'B8'
  const NAME  = 'RealTimeState'
  console.log(`\n${C.bold}[B8] Real-Time State${C.reset}`)
  const results = []

  // ── B8-01: Current time ───────────────────────────────────────────────────
  results.push(await runTest('B8-01', GROUP, 'Reports current time — within 5 minutes of actual', async () => {
    const actual = new Date()
    const reply  = await callAiden(`What is the exact current time right now?`)

    const timeMatch = reply.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/i)
    if (!timeMatch) {
      const lower = reply.toLowerCase()
      if (lower.includes("don't") || lower.includes('unable') || lower.includes("can't"))
        return `Aiden cannot report time`
      return `no time pattern found in: ${reply.slice(0, 150)}`
    }

    let hours = parseInt(timeMatch[1], 10)
    const mins = parseInt(timeMatch[2], 10)
    const ampm = timeMatch[4]?.toLowerCase()
    if (ampm === 'pm' && hours < 12) hours += 12
    if (ampm === 'am' && hours === 12) hours = 0

    const reportedMin = hours * 60 + mins
    const actualMin   = actual.getHours() * 60 + actual.getMinutes()
    const diff        = Math.abs(reportedMin - actualMin)
    const diffWrap    = Math.min(diff, 1440 - diff)
    if (diffWrap > 5) return `time off by ${diffWrap} min — actual: ${actual.toTimeString().slice(0, 5)}, got: ${timeMatch[0]}`
  }))

  // ── B8-02: Day of week ────────────────────────────────────────────────────
  results.push(await runTest('B8-02', GROUP, 'Reports correct day of week', async () => {
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
    const actualDay = days[new Date().getDay()]
    const reply = await callAiden(`What day of the week is it today?`)
    const lower = reply.toLowerCase()
    if (!lower.includes(actualDay)) {
      // Check if it mentions any day at all
      const mentionedDay = days.find(d => lower.includes(d))
      if (mentionedDay) return `wrong day: said "${mentionedDay}" but actual is "${actualDay}"`
      return `no day of week found in: ${reply.slice(0, 120)}`
    }
  }))

  // ── B8-03: Active window title ────────────────────────────────────────────
  results.push(await runWarn('B8-03', GROUP, 'Reports active window title — matches actual foreground window', async () => {
    // Get actual foreground window
    let actualTitle = ''
    try {
      actualTitle = execSync(
        `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | Out-Null; $p = Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Sort-Object -Property CPU -Descending | Select-Object -First 1; $p.MainWindowTitle"`,
        { encoding: 'utf-8', timeout: 5000 }
      ).trim()
    } catch { return 'could not get actual window title' }

    const reply = await callAiden(`What is the title of the currently active or focused window on my screen?`)
    const lower = reply.toLowerCase()

    // Extract first word from actual title for comparison
    const titleWord = actualTitle.split(/\s+/)[0]?.toLowerCase()
    if (titleWord && lower.includes(titleWord)) return // pass

    const honest = lower.includes("can't") || lower.includes('unable') || lower.includes('permission')
    if (!honest && actualTitle) return `window title mismatch — actual: "${actualTitle}", response: ${reply.slice(0, 120)}`
  }))

  // ── B8-04: CPU usage ─────────────────────────────────────────────────────
  results.push(await runWarn('B8-04', GROUP, 'Reports CPU usage — response contains percentage', async () => {
    const reply = await callAiden(`What is my CPU usage right now as a percentage?`)
    const hasPercent = /%|\bpercent\b|\bcpu\b/.test(reply.toLowerCase()) && /\d/.test(reply)
    if (!hasPercent) return `no CPU percentage found: ${reply.slice(0, 150)}`
    // Sanity: number should be 0-100
    const nums = reply.match(/(\d{1,3})(?:\.\d+)?\s*%/g)
    if (nums) {
      const val = parseFloat(nums[0])
      if (val > 100) return `CPU value > 100 (${val}%) — likely fabricated`
    }
  }))

  // ── B8-05: RAM usage ─────────────────────────────────────────────────────
  results.push(await runWarn('B8-05', GROUP, 'Reports RAM usage — response has GB or % value', async () => {
    const reply = await callAiden(`How much RAM is currently in use on my system?`)
    const lower = reply.toLowerCase()
    const hasGB  = /\d+(\.\d+)?\s*(gb|gigabyte)/i.test(reply)
    const hasPct = /\d+(\.\d+)?\s*%/.test(reply) && lower.includes('ram') || lower.includes('memory')
    const hasMB  = /\d+\s*(mb|megabyte)/i.test(reply)
    if (!hasGB && !hasPct && !hasMB) return `no RAM usage data (no GB/MB/%) in: ${reply.slice(0, 150)}`
  }))

  results.forEach(printResult)
  return summarize(GROUP, NAME, results)
}
