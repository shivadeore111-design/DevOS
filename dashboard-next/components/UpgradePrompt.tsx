'use client'
// dashboard-next/components/UpgradePrompt.tsx
// Shown as an overlay / inline card whenever any API call returns HTTP 429
// with the DevOS plan-limit body: { error, tier, resource, limit, upgradeUrl }

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────

interface PlanLimit429 {
  error:       string
  resource?:   string
  tier?:       string
  limit?:      number
  upgradeUrl?: string
  message?:    string
}

interface Plan {
  id:          string
  name:        string
  price:       number
  priceId:     string
  description: string
  features:    string[]
}

interface UpgradePromptProps {
  limitData:  PlanLimit429
  onDismiss:  () => void
  onUpgrade?: (priceId: string) => void
}

// ── Tier colors ───────────────────────────────────────────────

const TIER_COLOR: Record<string, string> = {
  starter: '#6366f1',
  builder: '#8b5cf6',
  pro:     '#f59e0b',
}

const TIER_ICON: Record<string, string> = {
  starter: '⚡',
  builder: '🔨',
  pro:     '🚀',
}

// ── UpgradePrompt ─────────────────────────────────────────────

export function UpgradePrompt({ limitData, onDismiss, onUpgrade }: UpgradePromptProps) {
  const [plans, setPlans]         = useState<Plan[]>([])
  const [loading, setLoading]     = useState(false)
  const [plansLoaded, setPlansLoaded] = useState(false)
  const [subscribing, setSubscribing] = useState<string | null>(null)

  const API = process.env.NEXT_PUBLIC_DEVOS_API || 'http://localhost:4200'

  const loadPlans = async () => {
    if (plansLoaded) return
    try {
      const res  = await fetch(`${API}/api/billing/plans`)
      const data = await res.json()
      // Show only paid plans that would remove the limit
      setPlans(Array.isArray(data) ? data.filter((p: Plan) => p.price > 0) : [])
      setPlansLoaded(true)
    } catch { /* ignore */ }
  }

  // Load plans when component mounts
  if (!plansLoaded && !loading) {
    setLoading(true)
    loadPlans().finally(() => setLoading(false))
  }

  const handleSubscribe = async (plan: Plan) => {
    if (!plan.priceId) return
    setSubscribing(plan.id)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('devos_token') : null
      const res   = await fetch(`${API}/api/billing/subscribe`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ priceId: plan.priceId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else if (onUpgrade) {
        onUpgrade(plan.priceId)
      }
    } catch { /* ignore */ } finally {
      setSubscribing(null)
    }
  }

  const resourceLabel: Record<string, string> = {
    goals:       'goals this month',
    pilots:      'pilot runs this month',
    workspaces:  'workspaces',
    cloudDeploy: 'cloud deploys',
  }

  const resource = limitData.resource ?? 'actions'
  const label    = resourceLabel[resource] ?? resource

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f0a1f 0%, #0a0f1a 100%)',
          border:     '1px solid rgba(255,255,255,0.1)',
          boxShadow:  '0 24px 80px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header glow */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, #6366f1, transparent)' }} />

        {/* Close */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-white opacity-40 hover:opacity-100 transition-opacity text-xl leading-none"
        >✕</button>

        <div className="p-8">
          {/* Limit hit badge */}
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
              🚧
            </div>
            <div>
              <p className="text-white font-bold">Plan limit reached</p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                You've used all your {label} on the{' '}
                <span style={{ color: '#a5b4fc' }}>{limitData.tier ?? 'free'}</span> plan
              </p>
            </div>
          </div>

          {/* Message */}
          {limitData.message && (
            <p className="text-sm mb-6 p-3 rounded-2xl"
              style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)' }}>
              {limitData.message}
            </p>
          )}

          {/* Plan cards */}
          <p className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: 'rgba(255,255,255,0.3)' }}>Upgrade your plan</p>

          {loading && (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-20 rounded-2xl animate-pulse"
                  style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          )}

          <div className="space-y-3">
            {plans.map(plan => {
              const color   = TIER_COLOR[plan.id] ?? '#6366f1'
              const icon    = TIER_ICON[plan.id]  ?? '✨'
              const isSub   = subscribing === plan.id
              return (
                <div
                  key={plan.id}
                  className="p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01]"
                  style={{
                    background: `${color}12`,
                    border:     `1px solid ${color}35`,
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <p className="text-white font-semibold text-sm">{plan.name}</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {plan.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {plan.features.slice(0, 3).map(f => (
                          <span key={f} className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ background: `${color}25`, color }}>
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 text-right shrink-0">
                    <p className="font-bold" style={{ color }}>${plan.price}<span className="text-xs font-normal opacity-60">/mo</span></p>
                    <button
                      onClick={() => handleSubscribe(plan)}
                      disabled={isSub}
                      className="mt-1 text-xs px-3 py-1 rounded-xl text-white font-medium disabled:opacity-50 transition-all hover:opacity-90"
                      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
                    >
                      {isSub ? '…' : 'Upgrade'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-center text-xs mt-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Cancel anytime · Powered by Stripe
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Hook: intercept 429 fetch responses globally ──────────────

/**
 * Wrap a fetch call and return { data, limitError } where limitError is
 * populated if the response was a 429 plan-limit error.
 */
export async function fetchWithLimitCheck(
  url: string,
  options?: RequestInit,
): Promise<{ data: any; limitError: PlanLimit429 | null }> {
  try {
    const res  = await fetch(url, options)
    const data = await res.json().catch(() => ({}))
    if (res.status === 429 && data?.upgradeUrl) {
      return { data: null, limitError: data as PlanLimit429 }
    }
    return { data, limitError: null }
  } catch {
    return { data: null, limitError: null }
  }
}
