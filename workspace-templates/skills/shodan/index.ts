// skills/shodan/index.ts
// Programmatic handler — host lookups and search queries via Shodan API.

import { ApiSkill, requireApiKey } from '../../core/apiSkillBase'

const skill = new ApiSkill({
  name:           'shodan',
  baseUrl:        'https://api.shodan.io',
  apiKeyEnv:      'SHODAN_API_KEY',
  authType:       'query',
  authQueryParam: 'key',
  rateLimit:      { requests: 1, windowMs: 1_000 },
  timeout:        20_000,
  retries:        3,
})

export interface ShodanService {
  port:      number
  transport: string
  product:   string
  version:   string
  banner:    string
}

export interface ShodanHost {
  ip:           string
  org:          string
  os:           string | null
  country:      string
  city:         string
  ports:        number[]
  services:     ShodanService[]
  hostnames:    string[]
  vulns:        string[]
  lastUpdate:   string
}

export interface ShodanSearchResult {
  total:   number
  matches: Array<{
    ip:      string
    port:    number
    org:     string
    country: string
    product: string
    version: string
  }>
}

/** Look up a specific IP address in Shodan. */
export async function hostLookup(ip: string): Promise<ShodanHost> {
  requireApiKey('SHODAN_API_KEY')

  const raw = await skill.get(`/shodan/host/${encodeURIComponent(ip)}`)

  const services: ShodanService[] = (raw.data ?? []).map((svc: any) => ({
    port:      svc.port      ?? 0,
    transport: svc.transport ?? 'tcp',
    product:   svc.product   ?? '',
    version:   svc.version   ?? '',
    banner:    svc.data      ?? '',
  }))

  return {
    ip:         raw.ip_str       ?? ip,
    org:        raw.org          ?? '',
    os:         raw.os           ?? null,
    country:    raw.country_name ?? '',
    city:       raw.city         ?? '',
    ports:      raw.ports        ?? [],
    services,
    hostnames:  raw.hostnames    ?? [],
    vulns:      raw.vulns        ? Object.keys(raw.vulns) : [],
    lastUpdate: raw.last_update  ?? '',
  }
}

/** Search Shodan using a filter query string. */
export async function search(query: string, page = 1): Promise<ShodanSearchResult> {
  requireApiKey('SHODAN_API_KEY')

  const raw = await skill.get('/shodan/host/search', { query, page: String(page) })

  const matches = (raw.matches ?? []).map((m: any) => ({
    ip:      m.ip_str                    ?? '',
    port:    m.port                      ?? 0,
    org:     m.org                       ?? '',
    country: m.location?.country_name   ?? '',
    product: m.product                   ?? '',
    version: m.version                   ?? '',
  }))

  return { total: raw.total ?? 0, matches }
}
