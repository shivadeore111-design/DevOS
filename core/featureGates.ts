// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/featureGates.ts — Free vs Pro feature limits
//
// All checks are synchronous and read from the local license cache.
// No network requests are made here — call verifyLicense() at startup
// to keep the cache fresh.

import { getLicenseStatus } from './licenseManager'

// ── Limit tables ──────────────────────────────────────────────

const FREE_LIMITS = {
  maxGoals:        5,
  maxMemories:     50,
  maxRoutines:     10,
  maxMachines:     1,
  nightMode:       false,   // Dream Engine
  persistentRules: false,   // Standing Orders
  watchdog:        false,   // Heartbeat Monitor
  personaEngine:   false,   // SOUL customisation
  exportBackup:    false,
} as const

const PRO_LIMITS = {
  maxGoals:        Infinity,
  maxMemories:     Infinity,
  maxRoutines:     Infinity,
  maxMachines:     2,
  nightMode:       true,
  persistentRules: true,
  watchdog:        true,
  personaEngine:   true,
  exportBackup:    true,
} as const

export type FeatureLimits = typeof FREE_LIMITS

// ── Public API ────────────────────────────────────────────────

/**
 * Return the full limit table for the current tier.
 * Reads from the local cache — instant, no I/O on most calls.
 */
export function getFeatureLimits(): FeatureLimits {
  const { isPro } = getLicenseStatus()
  return isPro ? (PRO_LIMITS as FeatureLimits) : FREE_LIMITS
}

/**
 * Return true if the current tier allows a boolean feature.
 * @example canUseFeature('nightMode') // false on Free
 */
export function canUseFeature(feature: keyof typeof FREE_LIMITS): boolean {
  const limits = getFeatureLimits()
  const val = limits[feature]
  return typeof val === 'boolean' ? val : (val as number) > 0
}

/**
 * Return the numeric limit for a quota-based feature.
 * @example getLimit('maxGoals') // 5 on Free, Infinity on Pro
 */
export function getLimit(
  feature: 'maxGoals' | 'maxMemories' | 'maxRoutines' | 'maxMachines',
): number {
  return getFeatureLimits()[feature] as number
}

/**
 * Return a human-readable tier label.
 */
export function getTierLabel(): 'Free' | 'Pro' {
  return getLicenseStatus().isPro ? 'Pro' : 'Free'
}
