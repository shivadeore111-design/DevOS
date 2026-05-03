// skills/haveibeenpwned/index.ts
// Programmatic handler — uses ApiSkill for HTTP, auth, and rate limiting.

import { ApiSkill, requireApiKey } from '../../core/apiSkillBase'

const skill = new ApiSkill({
  name:       'haveibeenpwned',
  baseUrl:    'https://haveibeenpwned.com/api/v3',
  apiKeyEnv:  'HIBP_API_KEY',
  authType:   'header',
  authHeader: 'hibp-api-key',
  rateLimit:  { requests: 1, windowMs: 1_500 },   // 1 req / 1.5 s
  timeout:    15_000,
})

export interface Breach {
  Name:        string
  BreachDate:  string
  DataClasses: string[]
  Description: string
}

export async function checkEmail(email: string): Promise<string> {
  requireApiKey('HIBP_API_KEY')

  let breaches: Breach[]
  try {
    breaches = await skill.get(
      `/breachedaccount/${encodeURIComponent(email)}`,
      { truncateResponse: false },
    )
  } catch (e: any) {
    // 404 → not found (clean)
    if (e.message.includes('HTTP 404')) {
      return `✅ ${email} was NOT found in any known data breaches.`
    }
    throw e
  }

  if (!Array.isArray(breaches) || breaches.length === 0) {
    return `✅ ${email} was NOT found in any known data breaches.`
  }

  const lines = breaches.map(
    b => `  • ${b.Name} (${b.BreachDate}) — ${b.DataClasses.join(', ')}`,
  )
  return [
    `⚠️  ${email} found in ${breaches.length} breach(es):`,
    ...lines,
  ].join('\n')
}

export async function checkPastes(email: string): Promise<string> {
  requireApiKey('HIBP_API_KEY')

  let pastes: any[]
  try {
    pastes = await skill.get(`/pasteaccount/${encodeURIComponent(email)}`)
  } catch (e: any) {
    if (e.message.includes('HTTP 404')) {
      return `✅ ${email} was NOT found in any known pastes.`
    }
    throw e
  }

  if (!Array.isArray(pastes) || pastes.length === 0) {
    return `✅ ${email} was NOT found in any known pastes.`
  }

  const lines = pastes.map(p => `  • ${p.Source} — ${p.Title ?? 'untitled'} (${p.Date ?? 'unknown date'})`)
  return [`⚠️  ${email} found in ${pastes.length} paste(s):`, ...lines].join('\n')
}
