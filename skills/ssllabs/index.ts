// skills/ssllabs/index.ts
// Programmatic handler — comprehensive TLS/SSL analysis via Qualys SSL Labs API v4.
//
// Pattern: start scan → long-poll until READY → return normalised results.

import { ApiSkill } from '../../core/apiSkillBase'

// Note: v4 requires an email header; v3 is the public anonymous endpoint.
const skill = new ApiSkill({
  name:      'ssllabs',
  baseUrl:   'https://api.ssllabs.com/api/v3',
  authType:  'none',
  rateLimit: { requests: 1, windowMs: 2_000 },   // 1 req/2sec
  timeout:   30_000,
  retries:   2,
})

// ── Output types ──────────────────────────────────────────────

export interface SslProtocol {
  name:    string   // e.g. "TLS"
  version: string   // e.g. "1.3"
}

export interface SslEndpoint {
  ip:           string
  grade:        string
  statusMessage: string
  protocols:    SslProtocol[]
  forwardSecrecy: boolean
}

export interface SslScanResult {
  host:            string
  status:          string       // "READY" | "IN_PROGRESS" | "ERROR"
  grade:           string       // best grade across all endpoints
  endpoints:       SslEndpoint[]
  vulnerabilities: string[]     // names of detected vulnerabilities
  scanUrl:         string       // direct browser link to results
}

// ── Grade ordering ────────────────────────────────────────────

const GRADE_ORDER = ['A+', 'A', 'A-', 'B', 'C', 'D', 'E', 'F', 'T', 'M']

function bestGrade(grades: string[]): string {
  let best = ''
  for (const g of grades) {
    const gi = GRADE_ORDER.indexOf(g)
    const bi = GRADE_ORDER.indexOf(best)
    if (gi >= 0 && (bi < 0 || gi < bi)) best = g
  }
  return best || 'N/A'
}

// ── Vulnerability detection ───────────────────────────────────

function detectVulns(endpointDetails: any): string[] {
  if (!endpointDetails) return []
  const d     = endpointDetails
  const found: string[] = []

  if (d.heartbleed)                             found.push('Heartbleed (CVE-2014-0160)')
  if (d.poodleSsl)                              found.push('POODLE (SSLv3)')
  if (d.poodleTls === 2)                        found.push('POODLE (TLS)')
  if (d.freak)                                  found.push('FREAK')
  if (d.logjam)                                 found.push('Logjam')
  if (d.drownVulnerable)                        found.push('DROWN')
  if (d.ticketbleed === 2)                      found.push('Ticketbleed')
  if (d.bleichenbacher === 2 || d.bleichenbacher === 3) found.push('ROBOT/Bleichenbacher')
  if (d.zombiePoodle === 2)                     found.push('Zombie POODLE')
  if (d.goldenDoodle === 2)                     found.push('GoldenDoodle')
  if (d.openSSLLuckyMinus20 === 2)              found.push('Lucky MINUS 20')

  return found
}

// ── Parse raw SSL Labs response ───────────────────────────────

function parseResponse(host: string, raw: any): SslScanResult {
  const scanUrl = `https://www.ssllabs.com/ssltest/analyze.html?d=${encodeURIComponent(host)}&hideResults=on`

  if (raw.status !== 'READY') {
    return { host, status: raw.status ?? 'UNKNOWN', grade: 'N/A', endpoints: [], vulnerabilities: [], scanUrl }
  }

  const endpoints: SslEndpoint[] = (raw.endpoints ?? []).map((ep: any) => ({
    ip:             ep.ipAddress ?? '',
    grade:          ep.grade     ?? ep.gradeTrustIgnored ?? 'N/A',
    statusMessage:  ep.statusMessage ?? '',
    protocols:      (ep.details?.protocols ?? []).map((p: any) => ({
      name:    p.name    ?? 'TLS',
      version: p.version ?? '',
    })),
    forwardSecrecy: (ep.details?.forwardSecrecy ?? 0) >= 2,
  }))

  const allVulns = new Set<string>()
  for (const ep of (raw.endpoints ?? [])) {
    for (const v of detectVulns(ep.details)) allVulns.add(v)
  }

  return {
    host,
    status:          'READY',
    grade:           bestGrade(endpoints.map(e => e.grade)),
    endpoints,
    vulnerabilities: [...allVulns],
    scanUrl,
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Return the SSL Labs browser report URL immediately — no waiting.
 *
 * Use this when the user just wants a link rather than waiting 60–120s.
 */
export function quickScan(host: string): string {
  const h = host.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
  return `https://www.ssllabs.com/ssltest/analyze.html?d=${encodeURIComponent(h)}&hideResults=on&ignoreMismatch=on`
}

/**
 * Run a full SSL Labs scan with long-polling.
 *
 * Starts a new scan, polls every `pollIntervalMs` until the status is READY,
 * then returns parsed results. Throws if the scan fails or times out.
 *
 * @param host             Domain to scan (e.g. "github.com")
 * @param options.maxWaitSeconds  Maximum seconds to wait (default 180)
 * @param options.pollIntervalMs  Milliseconds between polls (default 20000)
 */
export async function scan(
  host: string,
  options?: { maxWaitSeconds?: number; pollIntervalMs?: number },
): Promise<SslScanResult> {
  const maxWait  = (options?.maxWaitSeconds ?? 180) * 1_000
  const pollMs   = options?.pollIntervalMs  ?? 20_000
  const cleanHost = host.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
  const scanUrl  = quickScan(cleanHost)

  // Start a fresh scan
  let raw = await skill.get('/analyze', {
    host:     cleanHost,
    publish:  'off',
    startNew: 'on',
    all:      'done',
  })

  const start = Date.now()

  // Poll until READY, ERROR, or timeout
  while (raw.status !== 'READY' && raw.status !== 'ERROR') {
    if (Date.now() - start >= maxWait) {
      throw new Error(
        `SSL Labs scan for "${cleanHost}" timed out after ${options?.maxWaitSeconds ?? 180}s.\n` +
        `View progress at: ${scanUrl}`,
      )
    }
    await new Promise(r => setTimeout(r, pollMs))
    raw = await skill.get('/analyze', {
      host:    cleanHost,
      publish: 'off',
      all:     'done',
    })
  }

  if (raw.status === 'ERROR') {
    throw new Error(
      `SSL Labs scan failed for "${cleanHost}": ${raw.statusMessage ?? 'unknown error'}\n` +
      `View at: ${scanUrl}`,
    )
  }

  return parseResponse(cleanHost, raw)
}

/** Format an SslScanResult as a human-readable string. */
export function formatScan(result: SslScanResult): string {
  if (result.status !== 'READY') {
    return `SSL Labs scan for ${result.host}: status = ${result.status}\n${result.scanUrl}`
  }

  const lines = [
    `Host:    ${result.host}`,
    `Grade:   ${result.grade}`,
    '',
    'Endpoints:',
    ...result.endpoints.map(ep => {
      const protos = ep.protocols.map(p => `${p.name} ${p.version}`).join(', ')
      const fs     = ep.forwardSecrecy ? ' FS' : ''
      return `  ${ep.ip}  ${ep.grade}${fs}  [${protos || 'no protocol data'}]`
    }),
  ]

  if (result.vulnerabilities.length > 0) {
    lines.push('', '⚠️  Vulnerabilities:')
    result.vulnerabilities.forEach(v => lines.push(`  • ${v}`))
  } else {
    lines.push('', '✅ No known vulnerabilities detected')
  }

  lines.push('', `Full report: ${result.scanUrl}`)

  return lines.join('\n')
}
