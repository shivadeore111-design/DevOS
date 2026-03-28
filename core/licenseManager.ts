// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/licenseManager.ts — Pro license validation + offline grace period
//
// Strategy:
//   - validateLicense(key)  — contacts the license server, caches result locally
//   - isPro()               — true if cached license is valid and not expired
//   - 7-day offline grace   — if server is unreachable, cached license works for 7 days
//   - 12-hour background refresh — keeps the cached license fresh silently

import fs   from 'fs'
import path from 'path'

// ── Config ────────────────────────────────────────────────────

const LICENSE_FILE   = path.join(process.cwd(), 'workspace', 'license.json')
const LICENSE_SERVER = 'https://devos-license-server.shiva-deore111.workers.dev'

const OFFLINE_GRACE_MS  = 7  * 24 * 60 * 60 * 1000   // 7 days
const REFRESH_INTERVAL  = 12 * 60 * 60 * 1000          // 12 hours
const VALIDATE_TIMEOUT  = 8  * 1000                    // 8-second network timeout

// ── Types ─────────────────────────────────────────────────────

export interface LicenseData {
  key:         string
  valid:       boolean
  tier:        'free' | 'pro'
  email:       string
  expiry:      number          // Unix ms; 0 = lifetime
  lastChecked: number          // Unix ms of last successful server validation
  error?:      string
}

// ── Defaults ──────────────────────────────────────────────────

const FREE_LICENSE: LicenseData = {
  key:         '',
  valid:       false,
  tier:        'free',
  email:       '',
  expiry:      0,
  lastChecked: 0,
}

// ── File I/O ──────────────────────────────────────────────────

function loadCached(): LicenseData | null {
  try {
    if (!fs.existsSync(LICENSE_FILE)) return null
    return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8')) as LicenseData
  } catch {
    return null
  }
}

function saveCached(data: LicenseData): void {
  try {
    const dir = path.dirname(LICENSE_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    // NTFS-safe: write to .tmp then rename (fall back to direct write)
    const tmp = LICENSE_FILE + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
    try {
      fs.renameSync(tmp, LICENSE_FILE)
    } catch {
      fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2))
      try { fs.unlinkSync(tmp) } catch {}
    }
  } catch (e: any) {
    console.error('[License] Failed to save cache:', e.message)
  }
}

// ── Network validation ────────────────────────────────────────

async function fetchValidation(key: string): Promise<LicenseData> {
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT)

  try {
    const res = await fetch(`${LICENSE_SERVER}/validate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ key }),
      signal:  controller.signal,
    })

    const json = await res.json() as any
    clearTimeout(timer)

    if (json.valid) {
      return {
        key,
        valid:       true,
        tier:        json.tier || 'pro',
        email:       json.email || '',
        expiry:      json.expiry || 0,
        lastChecked: Date.now(),
      }
    } else {
      return {
        ...FREE_LICENSE,
        key,
        lastChecked: Date.now(),
        error: json.error || 'Invalid license',
      }
    }
  } catch (e: any) {
    clearTimeout(timer)
    throw new Error(e.message || 'Network error')
  }
}

// ── Public API ────────────────────────────────────────────────

/**
 * Validate a license key against the server.
 * Saves the result to workspace/license.json.
 * On network failure, throws — caller handles gracefully.
 */
export async function validateLicense(key: string): Promise<LicenseData> {
  const cleanKey = key.trim().toUpperCase()

  if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(cleanKey)) {
    return { ...FREE_LICENSE, key: cleanKey, error: 'Invalid key format (expected XXXXX-XXXXX-XXXXX-XXXXX)' }
  }

  const result = await fetchValidation(cleanKey)
  saveCached(result)
  return result
}

/**
 * Return the current license from cache.
 * Does NOT make a network request.
 */
export function getCurrentLicense(): LicenseData {
  return loadCached() || { ...FREE_LICENSE }
}

/**
 * Returns true if the user has a valid, non-expired Pro license.
 * Respects 7-day offline grace period if server is unreachable.
 */
export function isPro(): boolean {
  const cached = loadCached()
  if (!cached || !cached.valid || cached.tier !== 'pro') return false

  // Check expiry (0 = lifetime)
  if (cached.expiry !== 0 && Date.now() > cached.expiry) return false

  // Check if last server validation was within the grace period
  const age = Date.now() - (cached.lastChecked || 0)
  if (age > OFFLINE_GRACE_MS) {
    console.log('[License] Grace period exceeded — license needs re-validation')
    return false
  }

  return true
}

/**
 * Clear the cached license (user logs out of Pro).
 */
export function clearLicense(): void {
  try {
    if (fs.existsSync(LICENSE_FILE)) {
      fs.unlinkSync(LICENSE_FILE)
    }
  } catch (e: any) {
    console.error('[License] Failed to clear cache:', e.message)
  }
}

/**
 * Start a background 12-hour license refresh.
 * Call once on server startup — silently keeps the cache fresh.
 */
export function startLicenseRefresh(): void {
  const refresh = async () => {
    const cached = loadCached()
    if (!cached || !cached.key || !cached.valid) return  // nothing to refresh

    try {
      const updated = await fetchValidation(cached.key)
      saveCached(updated)
      if (!updated.valid) {
        console.log('[License] Background refresh: license no longer valid')
      }
    } catch {
      // Network failure — offline grace handles it, no log spam needed
    }
  }

  // Initial refresh 30 seconds after boot (avoids blocking startup)
  setTimeout(refresh, 30 * 1000)

  // Then every 12 hours
  setInterval(refresh, REFRESH_INTERVAL)
}


