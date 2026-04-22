// skills/urlscan/index.ts
// Programmatic handler — submits URLs and retrieves verdicts via urlscan.io API.

import { ApiSkill, requireApiKey } from '../../core/apiSkillBase'

const skill = new ApiSkill({
  name:       'urlscan',
  baseUrl:    'https://urlscan.io/api/v1',
  apiKeyEnv:  'URLSCAN_API_KEY',
  authType:   'header',
  authHeader: 'API-Key',
  rateLimit:  { requests: 5, windowMs: 60_000 },
  timeout:    20_000,
})

export type Visibility = 'public' | 'unlisted' | 'private'

export interface ScanSubmit {
  uuid:       string
  result:     string
  api:        string
  visibility: string
  message:    string
}

export interface ScanVerdict {
  malicious: boolean
  phishing:  boolean
  score:     number
  tags:      string[]
}

export interface ScanResult {
  uuid:       string
  url:        string
  ip:         string
  country:    string
  malicious:  boolean
  phishing:   boolean
  score:      number
  reportUrl:  string
  screenshot: string
}

/** Submit a URL for scanning. Returns the UUID — call getResult() after ~30s. */
export async function submitScan(url: string, visibility: Visibility = 'unlisted'): Promise<ScanSubmit> {
  requireApiKey('URLSCAN_API_KEY')
  return skill.post('/scan/', { url, visibility })
}

/** Retrieve a completed scan by UUID. */
export async function getResult(uuid: string): Promise<ScanResult> {
  requireApiKey('URLSCAN_API_KEY')

  const raw = await skill.get(`/result/${uuid}/`)

  return {
    uuid,
    url:        raw.page?.url        ?? '',
    ip:         raw.page?.ip         ?? '',
    country:    raw.page?.country    ?? '',
    malicious:  raw.verdicts?.overall?.malicious ?? false,
    phishing:   raw.verdicts?.overall?.phishing  ?? false,
    score:      raw.verdicts?.overall?.score     ?? 0,
    reportUrl:  `https://urlscan.io/result/${uuid}/`,
    screenshot: `https://urlscan.io/screenshots/${uuid}.png`,
  }
}

/** Submit and poll for result (waits up to maxWaitMs). */
export async function scanAndWait(
  url: string,
  visibility: Visibility = 'unlisted',
  maxWaitMs = 60_000,
): Promise<ScanResult> {
  requireApiKey('URLSCAN_API_KEY')

  const submit  = await submitScan(url, visibility)
  const uuid    = submit.uuid
  const poll    = 10_000
  const start   = Date.now()

  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, poll))
    try {
      return await getResult(uuid)
    } catch (e: any) {
      // 404 means scan is still in progress
      if (!e.message.includes('HTTP 404')) throw e
    }
  }

  throw new Error(`urlscan: scan ${uuid} did not complete within ${maxWaitMs / 1000}s`)
}
