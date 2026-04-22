// skills/virustotal/index.ts
// Programmatic handler — file, URL, domain, and IP reputation via VirusTotal v3 API.

import { ApiSkill, requireApiKey } from '../../core/apiSkillBase'

const skill = new ApiSkill({
  name:       'virustotal',
  baseUrl:    'https://www.virustotal.com/api/v3',
  apiKeyEnv:  'VIRUSTOTAL_API_KEY',
  authType:   'header',
  authHeader: 'x-apikey',
  rateLimit:  { requests: 4, windowMs: 60_000 },
  timeout:    20_000,
  retries:    3,
})

export interface AnalysisStats {
  malicious:   number
  suspicious:  number
  undetected:  number
  harmless:    number
  timeout:     number
}

export interface VTReport {
  id:          string
  name:        string
  reputation:  number
  stats:       AnalysisStats
  categories:  string[]
  lastAnalysis: string
}

/** Encode a URL to the VirusTotal URL identifier (URL-safe base64, no padding). */
function urlId(url: string): string {
  return Buffer.from(url).toString('base64url')
}

function extractStats(attrs: any): AnalysisStats {
  const s = attrs?.last_analysis_stats ?? {}
  return {
    malicious:  s.malicious  ?? 0,
    suspicious: s.suspicious ?? 0,
    undetected: s.undetected ?? 0,
    harmless:   s.harmless   ?? 0,
    timeout:    s.timeout    ?? 0,
  }
}

function extractCategories(attrs: any): string[] {
  if (!attrs?.categories) return []
  if (Array.isArray(attrs.categories)) return attrs.categories as string[]
  // categories can be an object of { engine: category } — return unique values
  return [...new Set(Object.values(attrs.categories) as string[])]
}

/** Check a file hash (MD5, SHA-1, or SHA-256) against VirusTotal. */
export async function fileReport(hash: string): Promise<VTReport> {
  requireApiKey('VIRUSTOTAL_API_KEY')

  const raw   = await skill.get(`/files/${encodeURIComponent(hash)}`)
  const attrs = raw.data?.attributes ?? {}

  return {
    id:           raw.data?.id                          ?? hash,
    name:         attrs.meaningful_name                  ?? attrs.name ?? hash,
    reputation:   attrs.reputation                       ?? 0,
    stats:        extractStats(attrs),
    categories:   extractCategories(attrs),
    lastAnalysis: attrs.last_analysis_date               ?? '',
  }
}

/** Check a URL's reputation via VirusTotal. */
export async function urlReport(url: string): Promise<VTReport> {
  requireApiKey('VIRUSTOTAL_API_KEY')

  const id    = urlId(url)
  const raw   = await skill.get(`/urls/${id}`)
  const attrs = raw.data?.attributes ?? {}

  return {
    id,
    name:         url,
    reputation:   attrs.reputation   ?? 0,
    stats:        extractStats(attrs),
    categories:   extractCategories(attrs),
    lastAnalysis: attrs.last_analysis_date ?? '',
  }
}

/** Check a domain's reputation via VirusTotal. */
export async function domainReport(domain: string): Promise<VTReport> {
  requireApiKey('VIRUSTOTAL_API_KEY')

  const raw   = await skill.get(`/domains/${encodeURIComponent(domain)}`)
  const attrs = raw.data?.attributes ?? {}

  return {
    id:           raw.data?.id         ?? domain,
    name:         domain,
    reputation:   attrs.reputation     ?? 0,
    stats:        extractStats(attrs),
    categories:   extractCategories(attrs),
    lastAnalysis: attrs.last_analysis_date ?? '',
  }
}

/** Check an IP address reputation via VirusTotal. */
export async function ipReport(ip: string): Promise<VTReport> {
  requireApiKey('VIRUSTOTAL_API_KEY')

  const raw   = await skill.get(`/ip_addresses/${encodeURIComponent(ip)}`)
  const attrs = raw.data?.attributes ?? {}

  return {
    id:           raw.data?.id         ?? ip,
    name:         ip,
    reputation:   attrs.reputation     ?? 0,
    stats:        extractStats(attrs),
    categories:   extractCategories(attrs),
    lastAnalysis: attrs.last_analysis_date ?? '',
  }
}
