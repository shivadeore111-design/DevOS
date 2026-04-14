// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/tools/calendarTool.ts — Fetch upcoming events from a
// Google Calendar public iCal URL (no API key required).

// ── Types ──────────────────────────────────────────────────────

export interface CalendarEvent {
  title:        string
  start:        Date
  end:          Date
  location?:    string
  description?: string
}

// ── iCal date parser ───────────────────────────────────────────
// Handles: 20260415T093000Z  (UTC)
//          20260415T093000   (local, treated as UTC for simplicity)
//          20260415          (all-day)

export function parseICalDate(dateStr: string): Date {
  // Strip VALUE=DATE: prefix or TZID=...: prefix that may appear
  const raw     = dateStr.split(':').pop() ?? dateStr
  const cleaned = raw.replace(/[^0-9TZ]/g, '')

  if (cleaned.length >= 15) {
    const year  = cleaned.substring(0, 4)
    const month = cleaned.substring(4, 6)
    const day   = cleaned.substring(6, 8)
    const hour  = cleaned.substring(9, 11)
    const min   = cleaned.substring(11, 13)
    const sec   = cleaned.substring(13, 15)
    const tz    = cleaned.endsWith('Z') ? 'Z' : 'Z'   // treat all as UTC
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}${tz}`)
  }

  if (cleaned.length >= 8) {
    const year  = cleaned.substring(0, 4)
    const month = cleaned.substring(4, 6)
    const day   = cleaned.substring(6, 8)
    return new Date(`${year}-${month}-${day}`)
  }

  return new Date(dateStr)
}

// ── iCal event parser ──────────────────────────────────────────

function unescape(value: string): string {
  return value
    .replace(/\\n/g, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

// ── Public API ─────────────────────────────────────────────────

export async function getCalendarEvents(
  icalUrl:  string,
  daysAhead: number = 7,
): Promise<CalendarEvent[]> {
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), 15000)

  let icalText: string
  try {
    const resp = await fetch(icalUrl, { signal: controller.signal })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    icalText = await resp.text()
  } finally {
    clearTimeout(timer)
  }

  const events: CalendarEvent[] = []
  const now    = new Date()
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

  // Split on VEVENT blocks
  const blocks = icalText.split('BEGIN:VEVENT')

  for (const block of blocks.slice(1)) {
    const body = block.split('END:VEVENT')[0]

    // Handle property folding (lines starting with whitespace are continuations)
    const unfolded = body.replace(/\r?\n[ \t]/g, '')

    const get = (key: string): string | undefined => {
      const m = unfolded.match(new RegExp(`${key}[^:]*:([^\r\n]*)`, 'i'))
      return m ? unescape(m[1].trim()) : undefined
    }

    const summary   = get('SUMMARY')
    const dtstart   = get('DTSTART')
    const dtend     = get('DTEND')
    const location  = get('LOCATION')
    const description = get('DESCRIPTION')

    if (!summary || !dtstart) continue

    try {
      const start = parseICalDate(dtstart)
      const end   = dtend ? parseICalDate(dtend) : start

      // Only include upcoming events within the window
      if (start >= now && start <= cutoff) {
        events.push({
          title: summary,
          start,
          end,
          ...(location    ? { location }    : {}),
          ...(description ? { description } : {}),
        })
      }
    } catch {
      // skip malformed entries
    }
  }

  events.sort((a, b) => a.start.getTime() - b.start.getTime())
  console.log(`[Calendar] Fetched ${events.length} upcoming events (next ${daysAhead} days)`)
  return events
}
