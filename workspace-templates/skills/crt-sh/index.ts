// skills/crt-sh/index.ts
// Programmatic handler — no auth required, uses ApiSkill for retries/timeout.

import { ApiSkill } from '../../core/apiSkillBase'

const skill = new ApiSkill({
  name:     'crt.sh',
  baseUrl:  'https://crt.sh',
  authType: 'none',
  timeout:  30_000,
  retries:  3,
})

export interface CertRecord {
  id:          number
  name_value:  string
  issuer_name: string
  not_before:  string
  not_after:   string
}

export async function searchCerts(domain: string): Promise<{
  total:      number
  subdomains: string[]
  raw:        CertRecord[]
}> {
  const results: CertRecord[] = await skill.get('/', {
    q:      `%.${domain}`,
    output: 'json',
  })

  if (!Array.isArray(results) || results.length === 0) {
    return { total: 0, subdomains: [], raw: [] }
  }

  // Flatten multi-value name fields and deduplicate
  const subdomains = [
    ...new Set(
      results
        .flatMap(r => r.name_value.split('\n'))
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('*.')),
    ),
  ].sort()

  return { total: results.length, subdomains, raw: results }
}

export async function formatSubdomains(domain: string): Promise<string> {
  const { total, subdomains } = await searchCerts(domain)

  if (total === 0) return `No certificates found for ${domain}`

  return [
    `Found ${total} certificate records for ${domain}.`,
    `Unique subdomains/names (${subdomains.length}):`,
    ...subdomains.map(s => `  ${s}`),
  ].join('\n')
}
