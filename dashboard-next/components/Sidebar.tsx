'use client'
// dashboard-next/components/Sidebar.tsx
// Aiden Identity sidebar — shows level, title, XP progress,
// streak, skills learned, and top strength.
// Listens for identity_update over WebSocket for live updates.

import { useState, useEffect, useRef } from 'react'

interface AidenIdentity {
  level:         number
  title:         string
  xp:            number
  nextLevelXp:   number
  skillsLearned: number
  streakDays:    number
  topStrength:   string
  lastUpdated:   string
}

const LEVEL_COLORS: Record<number, { bg: string; border: string; accent: string }> = {
  1: { bg: 'rgba(99,102,241,0.08)',   border: 'rgba(99,102,241,0.25)',  accent: '#818cf8' },  // indigo
  2: { bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.25)',   accent: '#4ade80' },  // green
  3: { bg: 'rgba(249,115,22,0.08)',   border: 'rgba(249,115,22,0.25)',  accent: '#fb923c' },  // orange
  4: { bg: 'rgba(234,179,8,0.08)',    border: 'rgba(234,179,8,0.25)',   accent: '#facc15' },  // yellow
  5: { bg: 'rgba(168,85,247,0.08)',   border: 'rgba(168,85,247,0.25)',  accent: '#c084fc' },  // purple
}

const LEVEL_ICONS: Record<number, string> = {
  1: '🌱',
  2: '⚙️',
  3: '🔬',
  4: '🧠',
  5: '🏛️',
}

export default function Sidebar() {
  const [identity, setIdentity] = useState<AidenIdentity | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  // Initial fetch
  useEffect(() => {
    fetch('http://localhost:4200/api/identity')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIdentity(d as AidenIdentity) })
      .catch(() => {})
  }, [])

  // WebSocket listener for identity_update
  useEffect(() => {
    let ws: WebSocket | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      try {
        ws = new WebSocket('ws://localhost:4200')
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.type === 'identity_update' && msg.data) {
              setIdentity(msg.data as AidenIdentity)
            }
          } catch {}
        }
        ws.onerror = () => {}
        ws.onclose = () => {
          retryTimer = setTimeout(connect, 5000)
        }
      } catch {}
    }
    connect()
    return () => {
      if (ws) { ws.onclose = null; ws.close() }
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [])

  if (!identity) return null

  const colors     = LEVEL_COLORS[identity.level] ?? LEVEL_COLORS[1]
  const levelIcon  = LEVEL_ICONS[identity.level]  ?? '🌱'
  const xpPct      = identity.nextLevelXp > identity.xp
    ? Math.round(((identity.xp - (identity.xp < 25 ? 0 : identity.xp < 100 ? 25 : identity.xp < 300 ? 100 : 300)) /
        (identity.nextLevelXp - (identity.xp < 25 ? 0 : identity.xp < 100 ? 25 : identity.xp < 300 ? 100 : 300))) * 100)
    : 100

  if (collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        title="Expand Aiden identity"
        style={{
          position:      'fixed',
          left:          0,
          top:           '50%',
          transform:     'translateY(-50%)',
          zIndex:        50,
          cursor:        'pointer',
          background:    colors.bg,
          border:        `1px solid ${colors.border}`,
          borderLeft:    'none',
          borderRadius:  '0 8px 8px 0',
          padding:       '12px 6px',
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           '4px',
        }}
      >
        <span style={{ fontSize: '16px' }}>{levelIcon}</span>
        <span style={{ fontSize: '10px', color: colors.accent, fontWeight: 600, fontFamily: 'monospace', writingMode: 'vertical-rl' }}>
          Lv{identity.level}
        </span>
      </div>
    )
  }

  return (
    <aside style={{
      position:      'fixed',
      left:          0,
      top:           0,
      bottom:        0,
      width:         '220px',
      background:    '#111',
      borderRight:   `1px solid ${colors.border}`,
      display:       'flex',
      flexDirection: 'column',
      padding:       '20px 16px',
      zIndex:        40,
      overflowY:     'auto',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#e8e8e8', fontFamily: 'var(--font-mono)' }}>
          AIDEN
        </span>
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse sidebar"
          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}
        >
          ‹
        </button>
      </div>

      {/* Level badge */}
      <div style={{
        background:   colors.bg,
        border:       `1px solid ${colors.border}`,
        borderRadius: '10px',
        padding:      '14px',
        marginBottom: '16px',
        textAlign:    'center',
      }}>
        <div style={{ fontSize: '28px', marginBottom: '4px' }}>{levelIcon}</div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: colors.accent, fontFamily: 'var(--font-mono)' }}>
          Lv {identity.level}
        </div>
        <div style={{ fontSize: '12px', color: '#aaa', fontWeight: 500, marginTop: '2px' }}>
          {identity.title}
        </div>
      </div>

      {/* XP Progress bar */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666', marginBottom: '4px', fontFamily: 'monospace' }}>
          <span>XP: {identity.xp}</span>
          {identity.level < 5 && <span>Next: {identity.nextLevelXp}</span>}
        </div>
        <div style={{ background: '#1e1e1e', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
          <div style={{
            width:          `${Math.min(xpPct, 100)}%`,
            height:         '100%',
            background:     colors.accent,
            borderRadius:   '4px',
            transition:     'width 0.5s ease',
          }} />
        </div>
        {identity.level === 5 && (
          <div style={{ fontSize: '10px', color: colors.accent, textAlign: 'center', marginTop: '4px' }}>
            Max level reached ✨
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        <StatRow icon="🔧" label="Skills" value={String(identity.skillsLearned)} accent={colors.accent} />
        <StatRow icon="🔥" label="Streak" value={`${identity.streakDays}d`} accent={colors.accent} />
        <StatRow icon="⚡" label="Top strength" value={identity.topStrength} accent={colors.accent} mono />
      </div>

      {/* Last updated */}
      <div style={{ marginTop: 'auto', fontSize: '10px', color: '#333', fontFamily: 'monospace', paddingTop: '8px', borderTop: '1px solid #1e1e1e' }}>
        Updated {identity.lastUpdated}
      </div>
    </aside>
  )
}

// ── StatRow helper ─────────────────────────────────────────────

function StatRow({
  icon, label, value, accent, mono,
}: {
  icon: string
  label: string
  value: string
  accent: string
  mono?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '13px', width: '16px', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '11px', color: '#666', flex: 1 }}>{label}</span>
      <span style={{
        fontSize:   '11px',
        color:      accent,
        fontFamily: mono ? 'monospace' : 'inherit',
        fontWeight: 500,
        maxWidth:   '80px',
        overflow:   'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  )
}
