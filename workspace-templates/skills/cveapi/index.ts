// skills/cveapi/index.ts
// Programmatic handler — CVE lookup via MITRE CVE API with NVD fallback.

import { ApiSkill } from '../../core/apiSkillBase'

// Primary: MITRE CVE API (cveawg.mitre.org)
const mitre = new ApiSkill({
  name:      'cveapi-mitre',
  baseUrl:   'https://cveawg.mitre.org/api',
  authType:  'none',
  rateLimit: { requests: 10, windowMs: 1_000 },
  timeout:   20_000,
  retries:   2,
})

// Fallback: NVD (nvd.nist.gov) — optional API key for higher rate limits
function makeNvd(): ApiSkill {
  const nvdKey = process.env['NVD_API_KEY']
  if (nvdKey) {
    return new ApiSkill({
      name:       'cveapi-nvd',
      baseUrl:    'https://services.nvd.nist.gov/rest/json',
      authType:   'header',
      authHeader: 'apiKey',
      apiKey:     nvdKey,
      rateLimit:  { requests: 50, windowMs: 30_000 },
      timeout:    25_000,
      retries:    2,
    })
  }
  return new ApiSkill({
    name:      'cveapi-nvd',
    baseUrl:   'https://services.nvd.nist.gov/rest/json',
    authType:  'none',
    rateLimit: { requests: 5, windowMs: 30_000 },
    timeout:   25_000,
    retries:   2,
  })
}

// ── Normalised output shape ───────────────────────────────────

export interface CveReport {
  id:            string
  state:         string
  description:   string
  severity:      string       // CRITICAL / HIGH / MEDIUM / LOW / NONE / UNKNOWN
  cvssScore:     number | null
  cvssVector:    string
  publishedDate: string
  references:    string[]
  affected:      string[]     // "vendor product version" strings
  source:        'mitre' | 'nvd'
}

// ── MITRE parser ──────────────────────────────────────────────

/** Extract CVSS score from a metrics array (cna or adp). */
function extractCvss(metrics: any[]): { score: number | null; vector: string; severity: string } {
  for (const metric of (metrics ?? [])) {
    // Prefer cvssV3_1, then cvssV3_0, then cvssV2_0
    for (const key of ['cvssV3_1', 'cvssV3_0', 'cvssV2_0']) {
      if (metric[key]) {
        const m = metric[key]
        return {
          score:    m.baseScore     ?? null,
          vector:   m.vectorString  ?? '',
          severity: m.baseSeverity  ?? 'UNKNOWN',
        }
      }
    }
    // Also catch any key that starts with cvssV3 (future proofing)
    for (const key of Object.keys(metric)) {
      if (key.startsWith('cvssV3')) {
        const m = metric[key]
        return {
          score:    m.baseScore    ?? null,
          vector:   m.vectorString ?? '',
          severity: m.baseSeverity ?? 'UNKNOWN',
        }
      }
    }
  }
  return { score: null, vector: '', severity: 'UNKNOWN' }
}

function parseMitre(raw: any): CveReport {
  const meta  = raw.cveMetadata     ?? {}
  const cna   = raw.containers?.cna ?? {}
  const adps  = raw.containers?.adp ?? []   // Additional Data Providers (e.g. NIST)

  const description =
    (cna.descriptions ?? []).find((d: any) => d.lang === 'en')?.value ?? ''

  // Try CNA metrics first; fall back to any ADP that has CVSS
  let cvssScore:  number | null = null
  let cvssVector = ''
  let severity   = 'UNKNOWN'

  const cnaResult = extractCvss(cna.metrics ?? [])
  if (cnaResult.score !== null) {
    cvssScore  = cnaResult.score
    cvssVector = cnaResult.vector
    severity   = cnaResult.severity
  } else {
    for (const adp of adps) {
      const adpResult = extractCvss(adp.metrics ?? [])
      if (adpResult.score !== null) {
        cvssScore  = adpResult.score
        cvssVector = adpResult.vector
        severity   = adpResult.severity
        break
      }
    }
  }

  const references = (cna.references ?? [])
    .map((r: any) => r.url as string)
    .filter(Boolean)
    .slice(0, 10)

  const affected: string[] = []
  for (const aff of (cna.affected ?? [])) {
    const vendor  = aff.vendor  ?? ''
    const product = aff.product ?? ''
    for (const ver of (aff.versions ?? [])) {
      if (ver.status === 'affected') {
        affected.push(`${vendor} ${product} ${ver.version}`.trim())
      }
    }
    if ((aff.versions ?? []).length === 0 && (vendor || product)) {
      affected.push(`${vendor} ${product}`.trim())
    }
  }

  return {
    id:            meta.cveId         ?? '',
    state:         meta.state         ?? '',
    description,
    severity,
    cvssScore,
    cvssVector,
    publishedDate: meta.datePublished ?? '',
    references,
    affected:      [...new Set(affected)].slice(0, 20),
    source:        'mitre',
  }
}

// ── NVD parser ────────────────────────────────────────────────

function parseNvd(raw: any): CveReport {
  const cve     = raw.vulnerabilities?.[0]?.cve ?? {}
  const metrics = cve.metrics                   ?? {}

  const description =
    (cve.descriptions ?? []).find((d: any) => d.lang === 'en')?.value ?? ''

  let cvssScore:  number | null = null
  let cvssVector = ''
  let severity   = 'UNKNOWN'

  // Prefer V3.1, then V3.0, then V2.0
  const v31 = metrics.cvssMetricV31?.[0]?.cvssData
  const v30 = metrics.cvssMetricV30?.[0]?.cvssData
  const v2  = metrics.cvssMetricV2?.[0]?.cvssData

  const chosen = v31 ?? v30 ?? v2
  if (chosen) {
    cvssScore  = chosen.baseScore    ?? null
    cvssVector = chosen.vectorString ?? ''
    severity   = chosen.baseSeverity ?? (v2 ? (chosen.baseScore >= 7 ? 'HIGH' : chosen.baseScore >= 4 ? 'MEDIUM' : 'LOW') : 'UNKNOWN')
  }

  const references = (cve.references ?? [])
    .map((r: any) => r.url as string)
    .filter(Boolean)
    .slice(0, 10)

  return {
    id:            cve.id          ?? '',
    state:         cve.vulnStatus  ?? '',
    description,
    severity,
    cvssScore,
    cvssVector,
    publishedDate: cve.published   ?? '',
    references,
    affected:      [],   // NVD configuration data is complex — omit for brevity
    source:        'nvd',
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Look up a CVE by ID (e.g. "CVE-2021-44228").
 *
 * Tries MITRE CVE API first; falls back to NVD if that fails.
 * Returns a normalised CveReport regardless of source.
 */
export async function lookupCve(cveId: string): Promise<CveReport> {
  const id = cveId.trim().toUpperCase()

  // Validate format
  if (!/^CVE-\d{4}-\d{4,}$/i.test(id)) {
    throw new Error(`Invalid CVE ID format: "${cveId}". Expected CVE-YYYY-NNNNN`)
  }

  // Try MITRE first
  try {
    const raw = await mitre.get(`/cve/${encodeURIComponent(id)}`)
    return parseMitre(raw)
  } catch (mitreErr: any) {
    // Fall through to NVD on any error
  }

  // NVD fallback
  const nvd = makeNvd()
  const raw = await nvd.get('/cves/2.0', { cveId: id })
  return parseNvd(raw)
}

/** Format a CveReport as a human-readable summary string. */
export function formatCve(report: CveReport): string {
  const scoreStr = report.cvssScore !== null ? String(report.cvssScore) : 'N/A'
  const lines = [
    `CVE ID:      ${report.id}`,
    `Severity:    ${report.severity} (CVSS ${scoreStr})`,
    `State:       ${report.state}`,
    `Published:   ${report.publishedDate}`,
    `Source:      ${report.source.toUpperCase()}`,
    '',
    `Description: ${report.description}`,
  ]

  if (report.affected.length > 0) {
    lines.push('', 'Affected:')
    report.affected.slice(0, 5).forEach(a => lines.push(`  • ${a}`))
    if (report.affected.length > 5) lines.push(`  … and ${report.affected.length - 5} more`)
  }

  if (report.references.length > 0) {
    lines.push('', 'References:')
    report.references.slice(0, 5).forEach(r => lines.push(`  ${r}`))
  }

  return lines.join('\n')
}
