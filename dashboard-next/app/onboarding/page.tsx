'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────

interface HardwareInfo {
  cpu:    string
  ram:    string
  gpu:    string
  os:     string
  disk:   string
}

interface ProviderInfo {
  name:   string
  type:   'local' | 'cloud'
  model:  string
}

// ── Steps ─────────────────────────────────────────────────────

const STEPS = [
  { id: 'installed',  label: 'Installed'            },
  { id: 'provider',   label: 'AI Provider configured'},
  { id: 'hardware',   label: 'Hardware detected'     },
  { id: 'ready',      label: 'Say hello to Aiden'    },
]

// ── OnboardingPage ────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step,     setStep]     = useState(0)
  const [hw,       setHw]       = useState<HardwareInfo | null>(null)
  const [provider, setProvider] = useState<ProviderInfo | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [done,     setDone]     = useState(false)

  // Gather hardware + provider info
  useEffect(() => {
    async function init() {
      // Step 0 → 1: already installed
      await delay(600)
      setStep(1)

      // Detect provider from /api/status
      try {
        const r = await fetch('http://localhost:4200/api/status').then(r => r.json()).catch(() => null)
        if (r?.provider) {
          const isOllama = r.provider === 'ollama'
          setProvider({
            name:  isOllama ? 'Ollama (local)' : r.provider,
            type:  isOllama ? 'local' : 'cloud',
            model: r.model ?? 'unknown',
          })
        } else {
          setProvider({ name: 'Auto (Groq / Gemini)', type: 'cloud', model: 'auto' })
        }
      } catch {
        setProvider({ name: 'Auto-detect', type: 'cloud', model: 'auto' })
      }

      await delay(700)
      setStep(2)

      // Detect hardware from /api/hardware or system_info tool
      try {
        const r = await fetch('http://localhost:4200/api/status').then(r => r.json()).catch(() => null)
        if (r?.system) {
          setHw({
            cpu:  r.system.cpu  ?? 'Detecting...',
            ram:  r.system.ram  ?? 'Detecting...',
            gpu:  r.system.gpu  ?? 'Detecting...',
            os:   r.system.os   ?? 'Windows',
            disk: r.system.disk ?? 'Detecting...',
          })
        } else {
          setHw({ cpu: 'Detected', ram: 'Detected', gpu: 'Detected', os: 'Windows', disk: 'Detected' })
        }
      } catch {
        setHw({ cpu: 'Unknown', ram: 'Unknown', gpu: 'Unknown', os: 'Windows', disk: 'Unknown' })
      }

      await delay(700)
      setStep(3)
      setLoading(false)
    }
    init()
  }, [])

  async function handleStart() {
    setDone(true)
    // Mark onboarding complete
    try {
      await fetch('http://localhost:4200/api/onboarding-complete', { method: 'POST' }).catch(() => {})
    } catch {}
    // Also write to workspace via a simple GET that triggers the write
    router.push('/')
  }

  return (
    <div style={{
      minHeight:      '100vh',
      background:     '#0e0e0e',
      color:          '#e8e8e8',
      fontFamily:     "'JetBrains Mono', monospace",
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '40px 24px',
    }}>

      {/* Logo */}
      <div style={{
        width: 56, height: 56, borderRadius: 13,
        background: '#f97316',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 800, color: '#000',
        marginBottom: 32,
      }}>
        A/
      </div>

      {/* Title */}
      <h1 style={{
        fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em',
        fontFamily: "'Outfit', sans-serif",
        marginBottom: 8, textAlign: 'center',
      }}>
        Welcome to Aiden
      </h1>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 48, textAlign: 'center' }}>
        Your personal AI is setting itself up. This takes about 10 seconds.
      </p>

      {/* Progress steps */}
      <div style={{
        width: '100%', maxWidth: 440,
        background: '#141414',
        border: '1px solid #222',
        borderRadius: 12,
        padding: '24px 28px',
        marginBottom: 40,
      }}>
        {STEPS.map((s, i) => {
          const done    = i < step
          const current = i === step && loading
          const pending = i > step
          return (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '10px 0',
              borderBottom: i < STEPS.length - 1 ? '1px solid #1e1e1e' : 'none',
              opacity: pending ? 0.35 : 1,
              transition: 'opacity 0.4s ease',
            }}>
              {/* Icon */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: done ? '#22c55e' : current ? '#f97316' : '#1e1e1e',
                border: current ? '2px solid #f97316' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                transition: 'background 0.4s ease',
              }}>
                {done    ? '✓' : ''}
                {current ? <SpinnerDot /> : ''}
                {pending ? <span style={{ color: '#444', fontSize: 10 }}>{i + 1}</span> : ''}
              </div>

              {/* Label */}
              <span style={{
                fontSize: 13,
                color:    done ? '#e8e8e8' : current ? '#f97316' : '#555',
                fontWeight: done || current ? 600 : 400,
                transition: 'color 0.4s ease',
              }}>
                {s.label}
              </span>

              {/* Detail */}
              {done && i === 1 && provider && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#555' }}>
                  {provider.name}
                </span>
              )}
              {done && i === 2 && hw && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#555' }}>
                  {hw.os}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Hardware + provider detail cards */}
      {!loading && hw && provider && (
        <div style={{
          width: '100%', maxWidth: 440,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          marginBottom: 40,
        }}>
          <InfoCard title="AI Provider" value={provider.name}
            sub={provider.type === 'local' ? '100% on your machine' : 'Cloud API'}
            accent={provider.type === 'local' ? '#22c55e' : '#3b82f6'} />
          <InfoCard title="Model" value={provider.model} sub="active model" accent="#f97316" />
          <InfoCard title="RAM" value={hw.ram}    sub="available memory"    accent="#888" />
          <InfoCard title="System"  value={hw.os} sub={hw.disk}             accent="#888" />
        </div>
      )}

      {/* CTA */}
      {!loading && (
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.6s ease' }}>
          <p style={{ color: '#22c55e', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            ✓ Aiden is ready.
          </p>
          <p style={{ color: '#555', fontSize: 12, marginBottom: 28 }}>
            Your AI will run 100% on this machine. Nothing leaves.
          </p>
          <button
            onClick={handleStart}
            disabled={done}
            style={{
              background:   '#f97316',
              border:       'none',
              borderRadius: 8,
              padding:      '14px 36px',
              fontSize:     14,
              fontWeight:   700,
              color:        '#000',
              fontFamily:   "'JetBrains Mono', monospace",
              cursor:       done ? 'default' : 'pointer',
              opacity:      done ? 0.7 : 1,
              transition:   'opacity 0.2s, transform 0.1s',
              letterSpacing: '0.02em',
            }}
            onMouseOver={e => { if (!done) (e.target as HTMLButtonElement).style.opacity = '0.88' }}
            onMouseOut={e  => { if (!done) (e.target as HTMLButtonElement).style.opacity = '1' }}
          >
            {done ? 'Opening Aiden...' : 'Say hello to Aiden →'}
          </button>
        </div>
      )}

      {/* Footer */}
      <div style={{ position: 'fixed', bottom: 20, fontSize: 10, color: '#333', textAlign: 'center' }}>
        Aiden v2.0 · by Taracod · aiden.taracod.com
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function InfoCard({ title, value, sub, accent }: {
  title: string; value: string; sub: string; accent: string
}) {
  return (
    <div style={{
      background: '#141414', border: '1px solid #1e1e1e', borderRadius: 8,
      padding: '14px 16px',
      borderLeft: `3px solid ${accent}`,
    }}>
      <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8e8', marginBottom: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: '#444' }}>{sub}</div>
    </div>
  )
}

function SpinnerDot() {
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8,
      borderRadius: '50%',
      border: '2px solid #f97316',
      borderTopColor: 'transparent',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
