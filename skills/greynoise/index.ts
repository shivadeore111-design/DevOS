// skills/greynoise/index.ts
// Programmatic handler — IP scanner intelligence via GreyNoise community API.

import { ApiSkill } from '../../core/apiSkillBase'

// Community endpoint works with or without a key.
// We create the skill instance conditionally to avoid sending an empty key header.
let _skill: ApiSkill | null = null

function getSkill(): ApiSkill {
  if (_skill) return _skill

  const key = process.env['GREYNOISE_API_KEY']

  _skill = key
    ? new ApiSkill({
        name:       'greynoise',
        baseUrl:    'https://api.greynoise.io/v3',
        authType:   'header',
        authHeader: 'key',
        apiKey:     key,
        rateLimit:  { requests: 10, windowMs: 60_000 },
        timeout:    15_000,
        retries:    2,
      })
    : new ApiSkill({
        name:      'greynoise',
        baseUrl:   'https://api.greynoise.io/v3',
        authType:  'none',
        rateLimit: { requests: 5, windowMs: 60_000 },
        timeout:   15_000,
        retries:   2,
      })

  return _skill
}

// ── Output types ──────────────────────────────────────────────

export type GreyNoiseClassification = 'benign' | 'malicious' | 'unknown'

export interface GreyNoiseReport {
  ip:             string
  noise:          boolean              // true = known mass internet scanner
  riot:           boolean              // true = trusted benign service (Google, Cloudflare, etc.)
  classification: GreyNoiseClassification | string
  name:           string               // actor/org name if known
  link:           string               // GreyNoise visualiser URL
  lastSeen:       string
  message:        string
  hasKey:         boolean              // whether an API key was used
}

// ── Public API ────────────────────────────────────────────────

/**
 * Check whether an IP address is a known internet scanner.
 *
 * Uses the GreyNoise Community endpoint (/v3/community/{ip}).
 * Works without an API key at low volume (~50 lookups/day).
 * Set GREYNOISE_API_KEY for higher limits.
 */
export async function checkIp(ip: string): Promise<GreyNoiseReport> {
  const trimmed = ip.trim()

  // Basic IPv4/IPv6 sanity check
  if (!trimmed) throw new Error('greynoise: IP address is required')

  const raw = await getSkill().get(`/community/${encodeURIComponent(trimmed)}`)

  return {
    ip:             raw.ip             ?? trimmed,
    noise:          raw.noise          ?? false,
    riot:           raw.riot           ?? false,
    classification: raw.classification ?? 'unknown',
    name:           raw.name           ?? '',
    link:           raw.link           ?? `https://viz.greynoise.io/ip/${trimmed}`,
    lastSeen:       raw.last_seen      ?? '',
    message:        raw.message        ?? '',
    hasKey:         !!process.env['GREYNOISE_API_KEY'],
  }
}

/** Format a GreyNoiseReport as a human-readable summary. */
export function formatReport(report: GreyNoiseReport): string {
  const tag = report.riot
    ? '✅ RIOT (trusted service)'
    : report.noise
      ? (report.classification === 'malicious' ? '🚨 MALICIOUS SCANNER' : '🔍 Known scanner')
      : '⚠️  Not in GreyNoise (may be targeted)'

  const lines = [
    `IP:             ${report.ip}`,
    `Tag:            ${tag}`,
    `Classification: ${report.classification}`,
    `Noise:          ${report.noise}`,
    `RIOT:           ${report.riot}`,
  ]

  if (report.name)     lines.push(`Name:           ${report.name}`)
  if (report.lastSeen) lines.push(`Last seen:      ${report.lastSeen}`)
  if (report.message)  lines.push(`Message:        ${report.message}`)

  lines.push(`Profile:        ${report.link}`)

  return lines.join('\n')
}
