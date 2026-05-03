// skills/securityheaders/index.ts
// Programmatic handler — HTTP security header audit via securityheaders.com.

import { ApiSkill } from '../../core/apiSkillBase'

const skill = new ApiSkill({
  name:      'securityheaders',
  baseUrl:   'https://securityheaders.com',
  authType:  'none',
  rateLimit: { requests: 3, windowMs: 1_000 },
  timeout:   20_000,
  retries:   2,
})

// ── Known security headers (for detection) ───────────────────

const KNOWN_HEADERS = [
  'Strict-Transport-Security',
  'Content-Security-Policy',
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Embedder-Policy',
  'Cross-Origin-Resource-Policy',
  'X-XSS-Protection',            // deprecated but still checked
  'Expect-CT',                   // deprecated
]

// ── HTML parsing helpers ──────────────────────────────────────

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract the grade letter from securityheaders.com HTML.
 *
 * The grade appears inside an element like:
 *   <span class="label label-success">A+</span>
 *   <span class="label label-warning">C</span>
 *   <span class="label label-danger">F</span>
 *
 * It also appears in the page title:
 *   <title>Security headers for example.com - Grade: A</title>
 */
function extractGrade(html: string): string {
  // Try page title first — most reliable
  const titleMatch = html.match(/<title>[^<]*Grade:\s*([A-F][+-]?)/i)
  if (titleMatch) return titleMatch[1]

  // Try the badge spans
  const badgeRe = /<span[^>]*class="[^"]*label[^"]*"[^>]*>\s*([A-F][+-]?)\s*<\/span>/gi
  let m: RegExpExecArray | null
  const candidates: string[] = []
  while ((m = badgeRe.exec(html)) !== null) {
    const g = m[1].trim()
    if (/^[A-F][+-]?$/.test(g)) candidates.push(g)
  }
  if (candidates.length > 0) return candidates[0]

  return 'unknown'
}

/**
 * Detect which known security headers are present and which are missing
 * by scanning the HTML for header name strings near "positive" / "negative" signals.
 */
function extractHeaders(html: string): { present: string[]; missing: string[] } {
  const present: string[] = []
  const missing: string[] = []

  for (const header of KNOWN_HEADERS) {
    // Escape for regex
    const esc = header.replace(/[-]/g, '\\-')
    const idx = html.search(new RegExp(esc, 'i'))
    if (idx < 0) continue  // not mentioned at all

    // Look at the surrounding context (up to 400 chars before the header name)
    // for class indicators like "bad", "warn", "missing", "success", "good"
    const before = html.slice(Math.max(0, idx - 400), idx)
    const rowCtx = before.slice(before.lastIndexOf('<tr'))

    if (/class="[^"]*(?:bad|missing|warn|danger)[^"]*"/i.test(rowCtx)) {
      missing.push(header)
    } else {
      present.push(header)
    }
  }

  return { present, missing }
}

// ── Output types ──────────────────────────────────────────────

export interface SecurityHeadersAudit {
  url:              string
  grade:            string     // A+ through F, or "unknown"
  present:          string[]   // headers that were found
  missing:          string[]   // headers that were absent
  recommendations:  string[]   // brief fix suggestions for missing headers
  scanUrl:          string     // link to full report
  parsed:           boolean    // false if HTML parsing was inconclusive
}

// Suggested fixes for missing headers
const RECOMMENDATIONS: Record<string, string> = {
  'Strict-Transport-Security':    'Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy':      'Add a Content-Security-Policy header to restrict content sources',
  'X-Frame-Options':              'Add: X-Frame-Options: SAMEORIGIN (or use CSP frame-ancestors)',
  'X-Content-Type-Options':       'Add: X-Content-Type-Options: nosniff',
  'Referrer-Policy':              'Add: Referrer-Policy: strict-origin-when-cross-origin',
  'Permissions-Policy':           'Add: Permissions-Policy: geolocation=(), camera=(), microphone=()',
  'Cross-Origin-Opener-Policy':   'Add: Cross-Origin-Opener-Policy: same-origin',
  'Cross-Origin-Embedder-Policy': 'Add: Cross-Origin-Embedder-Policy: require-corp',
  'Cross-Origin-Resource-Policy': 'Add: Cross-Origin-Resource-Policy: same-origin',
}

// ── Public API ────────────────────────────────────────────────

/**
 * Audit HTTP security headers for a URL.
 *
 * Fetches the securityheaders.com report page and parses the grade
 * and header presence/absence from the HTML.
 *
 * @param targetUrl  The URL to audit (e.g. "https://example.com")
 */
export async function audit(targetUrl: string): Promise<SecurityHeadersAudit> {
  const scanUrl = `https://securityheaders.com/?q=${encodeURIComponent(targetUrl)}&followRedirects=on&hide=on`

  let grade    = 'unknown'
  let present:  string[] = []
  let missing:  string[] = []
  let parsed   = false

  try {
    const html = await skill.get('/', {
      q:               targetUrl,
      followRedirects: 'on',
      hide:            'on',
    })

    if (typeof html === 'string' && html.length > 500) {
      grade   = extractGrade(html)
      const h = extractHeaders(html)
      present = h.present
      missing = h.missing
      parsed  = grade !== 'unknown' || present.length > 0 || missing.length > 0
    }
  } catch {
    // Network error — return URL so user can visit manually
  }

  const recommendations = missing
    .map(h => RECOMMENDATIONS[h])
    .filter(Boolean) as string[]

  return {
    url:  targetUrl,
    grade,
    present,
    missing,
    recommendations,
    scanUrl,
    parsed,
  }
}

/** Format an audit result as a human-readable string. */
export function formatAudit(result: SecurityHeadersAudit): string {
  const lines = [
    `URL:   ${result.url}`,
    `Grade: ${result.grade}`,
    '',
  ]

  if (result.present.length > 0) {
    lines.push('✅ Present:')
    result.present.forEach(h => lines.push(`   ${h}`))
    lines.push('')
  }

  if (result.missing.length > 0) {
    lines.push('❌ Missing:')
    result.missing.forEach(h => lines.push(`   ${h}`))
    lines.push('')
  }

  if (result.recommendations.length > 0) {
    lines.push('Recommendations:')
    result.recommendations.forEach(r => lines.push(`  • ${r}`))
    lines.push('')
  }

  lines.push(`Full report: ${result.scanUrl}`)

  if (!result.parsed) {
    lines.push('(Note: HTML parsing was inconclusive — view the full report for details)')
  }

  return lines.join('\n')
}
