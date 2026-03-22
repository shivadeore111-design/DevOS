'use client'
// dashboard-next/components/UsageLensPanel.tsx
// Usage bars rendered at the bottom of the left sidebar.
// Polls GET /api/billing/usage every 60s (requires JWT auth).

import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────

interface UsageStat {
  used:  number
  limit: number | null  // null = unlimited
}

interface UsageSummary {
  tier:        string
  month:       string
  goals:       UsageStat
  pilots:      UsageStat
  workspaces:  UsageStat
  features: {
    cloudDeploy: boolean
    marketplace: boolean
    apiAccess:   boolean
  }
  price: number
}

// ── Tier display ──────────────────────────────────────────────

const TIER_LABEL: Record<string, string> = {
  free:    'Free',
  starter: 'Starter',
  builder: 'Builder',
  pro:     'Pro',
}

const TIER_COLOR: Record<string, string> = {
  free:    '#6b7280',
  starter: '#6366f1',
  builder: '#8b5cf6',
  pro:     '#f59e0b',
}

const TIER_BADGE_BG: Record<string, string> = {
  free:    'rgba(107,114,128,0.15)',
  starter: 'rgba(99,102,241,0.15)',
  builder: 'rgba(139,92,246,0.15)',
  pro:     'rgba(245,158,11,0.15)',
}

// ── Sub-components ────────────────────────────────────────────

function UsageBar({ label, stat, color }: { label: string; stat: UsageStat; color: string }) {
  if (!stat) return null
  const isUnlimited = stat.limit === null
  const pct         = isUnlimited ? 0 : Math.min(100, Math.round((stat.used / stat.limit!) * 100))
  const isNearLimit = !isUnlimited && pct >= 80
  const isAtLimit   = !isUnlimited && pct >= 100

  const barColor = isAtLimit ? '#ef4444' : isNearLimit ? '#f59e0b' : color

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
        <span className="text-xs font-medium" style={{ color: isAtLimit ? '#f87171' : 'rgba(255,255,255,0.5)' }}>
          {isUnlimited ? (
            <span style={{ color: '#4ade80' }}>∞</span>
          ) : (
            `${stat.used} / ${stat.limit}`
          )}
        </span>
      </div>
      {!isUnlimited && (
        <div className="w-full h-1 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width:      `${pct}%`,
              background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
              boxShadow:  pct > 0 ? `0 0 6px ${barColor}60` : 'none',
            }}
          />
        </div>
      )}
    </div>
  )
}

function FeaturePip({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center space-x-1.5">
      <div className="w-1.5 h-1.5 rounded-full"
        style={{ background: enabled ? '#4ade80' : 'rgba(255,255,255,0.15)' }} />
      <span className="text-xs" style={{ color: enabled ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)' }}>
        {label}
      </span>
    </div>
  )
}

// ── UsageLensPanel ────────────────────────────────────────────

interface UsageLensPanelProps {
  onUpgradeClick?: () => void
}

export function UsageLensPanel({ onUpgradeClick }: UsageLensPanelProps) {
  const [summary, setSummary]   = useState<UsageSummary | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [expanded, setExpanded] = useState(false)

  const API = process.env.NEXT_PUBLIC_DEVOS_API || 'http://localhost:4200'

  const load = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('devos_token') : null
      if (!token) {
        setLoading(false)
        return
      }
      const res = await fetch(`${API}/api/billing/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) { setError(true); setLoading(false); return }
      const data = await res.json()
      setSummary(data)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Not logged in — show subtle sign-in nudge
  if (!loading && !summary && !error) {
    return (
      <div className="px-3 py-2 mt-auto">
        <div className="p-3 rounded-2xl text-center"
          style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Sign in to track usage
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="px-3 py-2 mt-auto">
        <div className="h-16 rounded-2xl animate-pulse"
          style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>
    )
  }

  if (error || !summary) return null

  const tier      = summary.tier ?? 'free'
  const color     = TIER_COLOR[tier]    ?? '#6b7280'
  const tierLabel = TIER_LABEL[tier]    ?? tier
  const badgeBg   = TIER_BADGE_BG[tier] ?? 'rgba(107,114,128,0.15)'
  const isPaid    = summary.price > 0

  // Check if near any limit
  const isNearGoalLimit   = summary.goals.limit !== null   && summary.goals.used   / summary.goals.limit!   >= 0.8
  const isNearPilotLimit  = summary.pilots.limit !== null  && summary.pilots.used  / summary.pilots.limit!  >= 0.8
  const hasWarning        = isNearGoalLimit || isNearPilotLimit

  return (
    <div className="px-3 pb-3 mt-auto">
      {/* Collapsed / header row */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full p-3 rounded-2xl flex items-center justify-between transition-all hover:opacity-90"
        style={{
          background: badgeBg,
          border:     `1px solid ${color}30`,
        }}
      >
        <div className="flex items-center space-x-2">
          {hasWarning && (
            <div className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: '#f59e0b', boxShadow: '0 0 4px #f59e0b' }} />
          )}
          <span className="text-xs font-semibold" style={{ color }}>
            {tierLabel}
          </span>
          {isPaid && (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              ${summary.price}/mo
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="mt-2 p-3 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>

          {/* Month label */}
          <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {summary.month} usage
          </p>

          {/* Usage bars */}
          <UsageBar label="Goals"      stat={summary.goals}      color={color} />
          <UsageBar label="Pilots"     stat={summary.pilots}     color={color} />
          <UsageBar label="Workspaces" stat={summary.workspaces} color={color} />

          {/* Feature pips */}
          <div className="mt-3 pt-3 space-y-1"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <FeaturePip label="Cloud deploy"  enabled={summary.features.cloudDeploy} />
            <FeaturePip label="Marketplace"   enabled={summary.features.marketplace} />
            <FeaturePip label="API access"    enabled={summary.features.apiAccess}   />
          </div>

          {/* Upgrade CTA (shown for non-pro users) */}
          {tier !== 'pro' && (
            <button
              onClick={onUpgradeClick}
              className="w-full mt-3 py-2 rounded-2xl text-xs font-semibold text-white transition-all hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)` }}
            >
              Upgrade plan
            </button>
          )}
        </div>
      )}
    </div>
  )
}
