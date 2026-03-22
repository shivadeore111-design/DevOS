// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// billing/accessGuard.ts — Per-tier usage enforcement middleware
//
// Tiers:
//   free:    1 workspace, 3 goals/month,  5 pilots/month
//   starter: 5 workspaces, unlimited goals, 30 pilots/month  — $29
//   builder: 10 workspaces, cloud deploy, marketplace — $79
//   pro:     unlimited everything, API access — $199
//
// Middleware flow:
//   1. Extract JWT from Authorization header (via devosAuth.validateToken)
//   2. Classify request type (goal | pilot | deploy | workspace)
//   3. Count usage for this calendar month from workspace/usage-ledger.json
//   4. If over limit → 429 { error, tier, limit, current, upgradeUrl }
//   5. On pass → increment counter and call next()

import * as fs   from 'fs'
import * as path from 'path'
import { devosAuth, UserTier, SafeUser } from '../auth/devosAuth'

// ── Plan definitions ──────────────────────────────────────────

export interface PlanLimits {
  workspaces:    number    // -1 = unlimited
  goalsPerMonth: number
  pilotsPerMonth: number
  cloudDeploy:   boolean
  marketplace:   boolean
  apiAccess:     boolean
}

export const PLAN_LIMITS: Record<UserTier, PlanLimits> = {
  free: {
    workspaces:     1,
    goalsPerMonth:  3,
    pilotsPerMonth: 5,
    cloudDeploy:    false,
    marketplace:    false,
    apiAccess:      false,
  },
  starter: {
    workspaces:     5,
    goalsPerMonth:  -1,
    pilotsPerMonth: 30,
    cloudDeploy:    false,
    marketplace:    false,
    apiAccess:      false,
  },
  builder: {
    workspaces:     10,
    goalsPerMonth:  -1,
    pilotsPerMonth: -1,
    cloudDeploy:    true,
    marketplace:    true,
    apiAccess:      false,
  },
  pro: {
    workspaces:     -1,
    goalsPerMonth:  -1,
    pilotsPerMonth: -1,
    cloudDeploy:    true,
    marketplace:    true,
    apiAccess:      true,
  },
}

export const PLAN_PRICES: Record<UserTier, number> = {
  free:    0,
  starter: 29,
  builder: 79,
  pro:     199,
}

// ── Usage ledger ─────────────────────────────────────────────

const WORKSPACE  = path.join(process.cwd(), 'workspace')
const LEDGER_FILE = path.join(WORKSPACE, 'usage-ledger.json')

interface UsageEntry {
  userId:    string
  month:     string   // YYYY-MM
  goals:     number
  pilots:    number
  workspaces: number
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function loadLedger(): UsageEntry[] {
  try {
    if (!fs.existsSync(LEDGER_FILE)) return []
    return JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf-8')) as UsageEntry[]
  } catch { return [] }
}

function saveLedger(entries: UsageEntry[]): void {
  fs.mkdirSync(WORKSPACE, { recursive: true })
  // Keep only the last 3 months to prevent unbounded growth
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 3)
  const cutoffStr = cutoff.toISOString().slice(0, 7)
  const pruned = entries.filter(e => e.month >= cutoffStr)
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(pruned, null, 2))
}

function getOrCreateEntry(userId: string, month: string): { entry: UsageEntry; entries: UsageEntry[]; idx: number } {
  const entries = loadLedger()
  let idx = entries.findIndex(e => e.userId === userId && e.month === month)
  if (idx === -1) {
    entries.push({ userId, month, goals: 0, pilots: 0, workspaces: 0 })
    idx = entries.length - 1
  }
  return { entry: entries[idx], entries, idx }
}

// ── UsageLens ─────────────────────────────────────────────────

export class UsageLens {

  getUsage(userId: string): UsageEntry {
    const month   = currentMonth()
    const entries = loadLedger()
    return entries.find(e => e.userId === userId && e.month === month)
      ?? { userId, month, goals: 0, pilots: 0, workspaces: 0 }
  }

  incrementGoals(userId: string): void {
    const month = currentMonth()
    const { entries, idx } = getOrCreateEntry(userId, month)
    entries[idx].goals++
    saveLedger(entries)
  }

  incrementPilots(userId: string): void {
    const month = currentMonth()
    const { entries, idx } = getOrCreateEntry(userId, month)
    entries[idx].pilots++
    saveLedger(entries)
  }

  incrementWorkspaces(userId: string): void {
    const month = currentMonth()
    const { entries, idx } = getOrCreateEntry(userId, month)
    entries[idx].workspaces++
    saveLedger(entries)
  }

  isOverLimit(userId: string, tier: UserTier, resource: 'goals' | 'pilots' | 'workspaces'): boolean {
    const limits = PLAN_LIMITS[tier]
    const usage  = this.getUsage(userId)
    if (resource === 'goals') {
      if (limits.goalsPerMonth === -1) return false
      return usage.goals >= limits.goalsPerMonth
    }
    if (resource === 'pilots') {
      if (limits.pilotsPerMonth === -1) return false
      return usage.pilots >= limits.pilotsPerMonth
    }
    if (resource === 'workspaces') {
      if (limits.workspaces === -1) return false
      return usage.workspaces >= limits.workspaces
    }
    return false
  }

  /** Return usage summary suitable for the dashboard UsageLensPanel */
  summary(userId: string, tier: UserTier): object {
    const limits = PLAN_LIMITS[tier]
    const usage  = this.getUsage(userId)
    return {
      tier,
      month: currentMonth(),
      goals: {
        used:  usage.goals,
        limit: limits.goalsPerMonth === -1 ? null : limits.goalsPerMonth,
      },
      pilots: {
        used:  usage.pilots,
        limit: limits.pilotsPerMonth === -1 ? null : limits.pilotsPerMonth,
      },
      workspaces: {
        used:  usage.workspaces,
        limit: limits.workspaces === -1 ? null : limits.workspaces,
      },
      features: {
        cloudDeploy: limits.cloudDeploy,
        marketplace: limits.marketplace,
        apiAccess:   limits.apiAccess,
      },
      price: PLAN_PRICES[tier],
    }
  }
}

export const usageLens = new UsageLens()

// ── Route classifiers ─────────────────────────────────────────

type ResourceType = 'goal' | 'pilot' | 'workspace' | 'deploy' | 'other'

function classifyRequest(method: string, urlPath: string): ResourceType {
  if (method === 'POST' && (urlPath.startsWith('/api/goals') || urlPath.startsWith('/api/chat')))
    return 'goal'
  if (method === 'POST' && urlPath.startsWith('/api/pilots') && urlPath.endsWith('/run'))
    return 'pilot'
  if (method === 'POST' && urlPath.startsWith('/api/deploy'))
    return 'deploy'
  return 'other'
}

// ── Middleware factory ─────────────────────────────────────────

/**
 * Express middleware that enforces tier limits.
 *
 * Attach to specific route groups:
 *   app.post('/api/goals',   accessGuard.enforce(), goalsHandler)
 *   app.post('/api/pilots',  accessGuard.enforce(), pilotsHandler)
 */
export function enforceAccessGuard() {
  return async (req: any, res: any, next: any): Promise<void> => {
    // Extract user — soft-fail if no auth (anonymous → free-tier limits apply
    // using a session key derived from IP to avoid complete bypass)
    let user: SafeUser | null = null
    const header = (req.headers['authorization'] as string) ?? ''
    const token  = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (token) user = devosAuth.validateToken(token)

    const tier: UserTier = user?.tier ?? 'free'
    // For unauthenticated requests, use IP as a proxy user-id for rate tracking
    const userId = user?.id ?? `anon:${(req.ip ?? '127.0.0.1').replace(/[:.]/g, '_')}`

    const resource = classifyRequest(req.method, req.path)

    if (resource === 'goal') {
      if (usageLens.isOverLimit(userId, tier, 'goals')) {
        res.status(429).json({
          error:      'Plan limit reached',
          resource:   'goals',
          tier,
          limit:      PLAN_LIMITS[tier].goalsPerMonth,
          upgradeUrl: '/pricing',
          message:    `You've used all ${PLAN_LIMITS[tier].goalsPerMonth} goals for this month on the ${tier} plan. Upgrade to continue.`,
        })
        return
      }
      // Increment will happen post-response to avoid counting failed requests
      res.on('finish', () => {
        if (res.statusCode < 400) usageLens.incrementGoals(userId)
      })
    }

    if (resource === 'pilot') {
      if (usageLens.isOverLimit(userId, tier, 'pilots')) {
        res.status(429).json({
          error:      'Plan limit reached',
          resource:   'pilots',
          tier,
          limit:      PLAN_LIMITS[tier].pilotsPerMonth,
          upgradeUrl: '/pricing',
          message:    `You've used all ${PLAN_LIMITS[tier].pilotsPerMonth} pilot runs for this month on the ${tier} plan.`,
        })
        return
      }
      res.on('finish', () => {
        if (res.statusCode < 400) usageLens.incrementPilots(userId)
      })
    }

    if (resource === 'deploy') {
      const limits = PLAN_LIMITS[tier]
      if (!limits.cloudDeploy) {
        res.status(429).json({
          error:      'Feature not available on your plan',
          resource:   'cloudDeploy',
          tier,
          upgradeUrl: '/pricing',
          message:    `Cloud deploy is available on Builder ($79/mo) and Pro ($199/mo) plans.`,
        })
        return
      }
    }

    next()
  }
}

/**
 * Usage summary endpoint middleware — reads usage for the authenticated user.
 */
export function getUsageSummary(req: any, res: any): void {
  const user: SafeUser | undefined = req.devosUser
  if (!user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  res.json(usageLens.summary(user.id, user.tier))
}
