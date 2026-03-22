'use client'
import { useEffect, useState } from 'react'
import { Sun, RefreshCw, X } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_DEVOS_API || 'http://localhost:4200'

const DAWN_SHOWN_KEY = 'devos_dawn_shown'

interface Props {
  onDismiss: () => void
}

export function DawnReportCard({ onDismiss }: Props) {
  const [briefing,  setBriefing]  = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(false)

  const load = (force = false) => {
    setLoading(true)
    setError(false)
    fetch(`${API}/api/personal/dawn${force ? '?force=true' : ''}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setBriefing(d?.briefing ?? null)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [])

  return (
    <div className="mx-6 mt-4 rounded-3xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(234,179,8,0.08), rgba(234,179,8,0.04))',
        border: '1px solid rgba(234,179,8,0.25)',
      }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid rgba(234,179,8,0.12)' }}>
        <div className="flex items-center space-x-2">
          <Sun size={16} style={{ color: '#fbbf24' }} />
          <span className="text-sm font-semibold" style={{ color: '#fbbf24' }}>Dawn Report</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => load(true)}
            className="p-1.5 rounded-xl transition-all hover:opacity-70"
            title="Regenerate"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            <RefreshCw size={13} />
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-xl transition-all hover:opacity-70"
            title="Dismiss"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {loading && (
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400"
              style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Generating your morning briefing…
            </span>
          </div>
        )}
        {!loading && error && (
          <p className="text-sm" style={{ color: 'rgba(239,68,68,0.7)' }}>
            Couldn't reach the API. Is DevOS running?
          </p>
        )}
        {!loading && !error && briefing && (
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {briefing}
          </p>
        )}
        {!loading && !error && !briefing && (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            No briefing available yet.
          </p>
        )}
      </div>
    </div>
  )
}
