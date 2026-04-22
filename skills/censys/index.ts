// skills/censys/index.ts
// Programmatic handler — host lookup, search, and certificate analysis via Censys v2 API.

import { ApiSkill } from '../../core/apiSkillBase'

// Censys uses HTTP Basic auth: Base64(API_ID:API_SECRET)
// We build the credential lazily so env vars can be set after module load.

let _skill: ApiSkill | null = null

function getSkill(): ApiSkill {
  if (_skill) return _skill

  const apiId     = process.env['CENSYS_API_ID']     ?? ''
  const apiSecret = process.env['CENSYS_API_SECRET']  ?? ''

  if (!apiId || !apiSecret) {
    throw new Error(
      'CENSYS_API_ID and CENSYS_API_SECRET are not configured.\n' +
      'Add them to .env:\n  CENSYS_API_ID=your-id\n  CENSYS_API_SECRET=your-secret\n' +
      'Free account: https://search.censys.io/register',
    )
  }

  const encoded = Buffer.from(`${apiId}:${apiSecret}`).toString('base64')

  _skill = new ApiSkill({
    name:       'censys',
    baseUrl:    'https://search.censys.io/api/v2',
    authType:   'header',
    authHeader: 'Authorization',
    apiKey:     `Basic ${encoded}`,
    rateLimit:  { requests: 4, windowMs: 10_000 },  // 0.4 req/sec
    timeout:    20_000,
    retries:    2,
  })
  return _skill
}

// ── Output types ──────────────────────────────────────────────

export interface CensysService {
  port:      number
  protocol:  string    // e.g. "TCP"
  name:      string    // e.g. "HTTP", "HTTPS"
}

export interface CensysHost {
  ip:          string
  asn:         number
  asnName:     string
  country:     string
  city:        string
  services:    CensysService[]
  lastUpdated: string
}

export interface CensysSearchResult {
  total:   number
  hits: Array<{
    ip:      string
    asn:     number
    asnName: string
    country: string
  }>
}

export interface CensysCertificate {
  fingerprint:  string
  subjectDn:    string
  issuerDn:     string
  names:        string[]
  validStart:   string
  validEnd:     string
}

// ── Public API ────────────────────────────────────────────────

/** Look up a specific IP address in Censys. */
export async function hostLookup(ip: string): Promise<CensysHost> {
  const raw = await getSkill().get(`/hosts/${encodeURIComponent(ip)}`)
  const r   = raw.result ?? raw  // some responses nest under result

  const services: CensysService[] = (r.services ?? []).map((s: any) => ({
    port:     s.port             ?? 0,
    protocol: s.transport_protocol ?? 'TCP',
    name:     s.service_name    ?? s.extended_service_name ?? '',
  }))

  const as = r.autonomous_system ?? {}
  const loc = r.location         ?? {}

  return {
    ip:          r.ip             ?? ip,
    asn:         as.asn           ?? 0,
    asnName:     as.name          ?? as.bgp_prefix ?? '',
    country:     loc.country      ?? loc.country_code ?? '',
    city:        loc.city         ?? '',
    services,
    lastUpdated: r.last_updated_at ?? '',
  }
}

/** Search Censys hosts with a query string. */
export async function hostSearch(query: string, perPage = 25): Promise<CensysSearchResult> {
  const raw = await getSkill().get('/hosts/search', { q: query, per_page: String(perPage) })
  const r   = raw.result ?? raw

  const hits = (r.hits ?? []).map((h: any) => ({
    ip:      h.ip                        ?? '',
    asn:     h.autonomous_system?.asn    ?? 0,
    asnName: h.autonomous_system?.name   ?? '',
    country: h.location?.country         ?? h.location?.country_code ?? '',
  }))

  return { total: r.total ?? hits.length, hits }
}

/** Look up a TLS certificate by its SHA-256 fingerprint. */
export async function certificateLookup(sha256: string): Promise<CensysCertificate> {
  const raw    = await getSkill().get(`/certificates/${sha256.toLowerCase()}`)
  const parsed = (raw.result ?? raw).parsed ?? {}
  const val    = parsed.validity ?? {}

  return {
    fingerprint: sha256,
    subjectDn:   parsed.subject_dn             ?? '',
    issuerDn:    parsed.issuer_dn              ?? '',
    names:       parsed.names_from_san         ?? [],
    validStart:  val.start                     ?? '',
    validEnd:    val.end                       ?? '',
  }
}
