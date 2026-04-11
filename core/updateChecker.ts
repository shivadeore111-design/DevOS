// ============================================================
// core/updateChecker.ts — Check for Aiden updates via license server
// ============================================================

import * as fs   from 'fs'
import * as path from 'path'

export interface UpdateResult {
  available:      boolean
  currentVersion: string
  latestVersion?: string
  downloadUrl?:   string
  releaseNotes?:  string
  publishedAt?:   string
}

function readCurrentVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json')
    const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export async function checkForUpdate(): Promise<UpdateResult> {
  const currentVersion = readCurrentVersion()
  try {
    const controller = new AbortController()
    const timeout    = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(
      `https://api.taracod.com/update/check?version=${encodeURIComponent(currentVersion)}`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as any
    return {
      available:      !!data.updateAvailable,
      currentVersion: data.currentVersion || currentVersion,
      latestVersion:  data.latestVersion,
      downloadUrl:    data.downloadUrl,
      releaseNotes:   data.releaseNotes,
      publishedAt:    data.publishedAt,
    }
  } catch {
    return { available: false, currentVersion }
  }
}
