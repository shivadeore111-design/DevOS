// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/updateCheck.ts — Phase 6 of Prompt 9.
//
// Checks GitHub Releases for a newer version of Aiden.
// - 1500 ms timeout (AbortController)
// - Session-cached: second call returns cached result instantly
// - Never throws — returns null on any failure

import { COLORS, MARKS, fg, RST, BOLD } from './theme'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UpdateInfo {
  currentVersion: string
  latestVersion:  string
  updateAvailable: boolean
  releaseUrl:     string
}

// ── Session cache ──────────────────────────────────────────────────────────────

let _cached: UpdateInfo | null | 'checked' = undefined as any

// ── Version compare ───────────────────────────────────────────────────────────

/** Simple semver compare: returns true if b > a. */
function isNewer(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const [aMaj, aMin, aPat] = parse(a)
  const [bMaj, bMin, bPat] = parse(b)
  if (bMaj !== aMaj) return bMaj > aMaj
  if (bMin !== aMin) return bMin > aMin
  return bPat > aPat
}

// ── Checker ───────────────────────────────────────────────────────────────────

/**
 * Fetch the latest GitHub release for taracodlabs/aiden-releases.
 * Returns UpdateInfo or null if check fails / already cached null.
 */
export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  if (_cached !== undefined && (_cached === null || _cached === 'checked')) return null
  if (_cached !== undefined) return _cached as UpdateInfo

  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), 1500)

  try {
    const res = await fetch(
      'https://api.github.com/repos/taracodlabs/aiden-releases/releases/latest',
      {
        signal:  controller.signal,
        headers: { 'User-Agent': 'aiden-cli', Accept: 'application/vnd.github+json' },
      }
    )
    clearTimeout(timer)

    if (!res.ok) { _cached = 'checked'; return null }

    const data = await res.json() as { tag_name?: string; html_url?: string }
    const latestVersion = (data.tag_name ?? '').replace(/^v/, '')
    const releaseUrl    = data.html_url ?? ''

    const info: UpdateInfo = {
      currentVersion,
      latestVersion,
      updateAvailable: isNewer(currentVersion, latestVersion),
      releaseUrl,
    }
    _cached = info
    return info
  } catch {
    clearTimeout(timer)
    _cached = 'checked'
    return null
  }
}

/**
 * Format a one-line update-available notice for the banner.
 * Returns empty string if no update or info is null.
 */
export function formatUpdateLine(info: UpdateInfo | null): string {
  if (!info || !info.updateAvailable) return ''
  const arrow = `${fg(COLORS.orange)}${MARKS.ARROW}${RST}`
  const ver   = `${BOLD}v${info.latestVersion}${RST}`
  const dim   = `${fg(COLORS.dim)}`
  return `  ${arrow} ${dim}update available${RST} ${ver}  ${dim}${info.releaseUrl}${RST}`
}
