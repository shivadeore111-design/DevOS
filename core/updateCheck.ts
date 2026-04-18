// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/updateCheck.ts — Phase 6 of Prompt 9.
//
// Checks GitHub Releases for a newer version of Aiden.
// - 1500 ms timeout for startup check; 5000 ms for /version command
// - Session-cached: second call returns cached result instantly
// - 6-hour file-based rate limit via ~/.aiden/last-update-check
// - Never throws — returns null on any failure

import os   from 'os'
import path from 'path'
import fs   from 'fs'
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

// ── File-based 6-hour rate limit ──────────────────────────────────────────────

const RATE_LIMIT_FILE = path.join(os.homedir(), '.aiden', 'last-update-check')
const SIX_HOURS_MS    = 6 * 60 * 60 * 1000

function isRateLimited(): boolean {
  try {
    if (!fs.existsSync(RATE_LIMIT_FILE)) return false
    const ts = parseInt(fs.readFileSync(RATE_LIMIT_FILE, 'utf-8').trim(), 10)
    return !isNaN(ts) && (Date.now() - ts) < SIX_HOURS_MS
  } catch { return false }
}

function markChecked(): void {
  try {
    const dir = path.dirname(RATE_LIMIT_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(RATE_LIMIT_FILE, String(Date.now()), 'utf-8')
  } catch { /* silent */ }
}

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

/** Exported semver compare: returns true if b > a (b is newer than a). */
export function semverGt(a: string, b: string): boolean {
  return isNewer(a, b)
}

// ── Checker ───────────────────────────────────────────────────────────────────

/**
 * Fetch the latest GitHub release for taracodlabs/aiden-releases.
 * Returns UpdateInfo or null if check fails / already cached null / rate-limited.
 * @param timeoutMs  Network timeout in ms (default 1500; pass 5000 for /version command)
 */
export async function checkForUpdate(currentVersion: string, timeoutMs = 1500): Promise<UpdateInfo | null> {
  if (_cached !== undefined && (_cached === null || _cached === 'checked')) return null
  if (_cached !== undefined) return _cached as UpdateInfo

  // 6-hour file-based rate limit — suppress network check between sessions
  if (isRateLimited()) return null

  const signal = AbortSignal.timeout(timeoutMs)

  try {
    const res = await fetch(
      'https://api.github.com/repos/taracodlabs/aiden-releases/releases/latest',
      {
        signal,
        headers: { 'User-Agent': 'aiden-cli', Accept: 'application/vnd.github+json' },
      }
    )

    if (!res.ok) { _cached = 'checked'; markChecked(); return null }

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
    markChecked()
    return info
  } catch {
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
