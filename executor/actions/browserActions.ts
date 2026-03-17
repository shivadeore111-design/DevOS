// ============================================================
// executor/actions/browserActions.ts — Browser + HTTP fetch tools
// ============================================================

import { execSync } from 'child_process'

export async function openBrowser(url: string): Promise<string> {
  const cmd = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
    ? `open "${url}"`
    : `xdg-open "${url}"`
  execSync(cmd)
  return `Opened ${url} in browser`
}

export async function fetchUrl(url: string): Promise<string> {
  const axios = (await import('axios')).default
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'DevOS/0.4.0' },
    })
    const text = typeof res.data === 'string'
      ? res.data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 3000)
      : JSON.stringify(res.data).slice(0, 3000)
    return text
  } catch (err: any) {
    return `Failed to fetch ${url}: ${err?.message}`
  }
}
