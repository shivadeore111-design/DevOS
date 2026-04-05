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

interface OllamaInfo {
  available: boolean
  models:    { name: string; size: number }[]
}

// ── Steps ─────────────────────────────────────────────────────

const STEPS = [
  { id: 'installed',  label: 'Installed'             },
  { id: 'provider',   label: 'AI Provider configured' },
  { id: 'hardware',   label: 'Hardware detected'      },
  { id: 'profile',    label: 'Your profile'           },
  { id: 'ready',      label: 'Say hello to Aiden'     },
]

// ── OnboardingPage ────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [step,     setStep]     = useState(0)
  const [hw,       setHw]       = useState<HardwareInfo | null>(null)
  const [provider, setProvider] = useState<ProviderInfo | null>(null)
  const [ollama,   setOllama]   = useState<OllamaInfo | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [done,     setDone]     = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  // Profile form state
  const [pName,    setPName]    = useState('')
  const [pRole,    setPRole]    = useState('')
  const [pTz,      setPTz]      = useState('IST')
  const [pGithub,  setPGithub]  = useState('')
  const [pMonitor, setPMonitor] = useState('')
  const [pStyle,   setPStyle]   = useState<'Direct' | 'Detailed' | 'Conversational'>('Direct')
  const [pSaving,  setPSaving]  = useState(false)

  // Gather hardware + provider info
  useEffect(() => {
    async function init() {
      await delay(600)
      setStep(1)

      // Detect Ollama local models
      try {
        const om = await fetch('http://localhost:4200/api/ollama/models').then(r => r.json()).catch(() => null)
        if (om) setOllama(om)
      } catch {}

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
      setShowProfile(true)
    }
    init()
  }, [])

  async function handleProfileSubmit() {
    setPSaving(true)
    try {
      await fetch('http://localhost:4200/api/user-profile', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pName || 'User', role: pRole || 'General', timezone: pTz,
          github: pGithub, monitoring: pMonitor, responseStyle: pStyle,
        }),
      }).catch(() => {})
    } catch {}
    setPSaving(false)
    setShowProfile(false)
    setStep(4)
  }

  async function handleProfileSkip() {
    setShowProfile(false)
    setStep(4)
  }

  async function handleStart() {
    setDone(true)
    try {
      await fetch('http://localhost:4200/api/onboarding-complete', { method: 'POST' }).catch(() => {})
    } catch {}
    router.push('/')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0e0e0e',
    border: '1px solid #2a2a2a', borderRadius: 6,
    padding: '9px 12px', fontSize: 12,
    color: '#e8e8e8', fontFamily: "'JetBrains Mono', monospace",
    outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: '#666', marginBottom: 5,
    display: 'block', letterSpacing: '0.05em',
    fontFamily: "'JetBrains Mono', monospace",
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
          const isDone    = i < step
          const isCurrent = i === step && loading
          const isPending = i > step
          return (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '10px 0',
              borderBottom: i < STEPS.length - 1 ? '1px solid #1e1e1e' : 'none',
              opacity: isPending ? 0.35 : 1,
              transition: 'opacity 0.4s ease',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: isDone ? '#22c55e' : isCurrent ? '#f97316' : '#1e1e1e',
                border: isCurrent ? '2px solid #f97316' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                transition: 'background 0.4s ease',
              }}>
                {isDone    ? '✓' : ''}
                {isCurrent ? <SpinnerDot /> : ''}
                {isPending ? <span style={{ color: '#444', fontSize: 10 }}>{i + 1}</span> : ''}
              </div>
              <span style={{
                fontSize: 13,
                color:    isDone ? '#e8e8e8' : isCurrent ? '#f97316' : '#555',
                fontWeight: isDone || isCurrent ? 600 : 400,
                transition: 'color 0.4s ease',
              }}>
                {s.label}
              </span>
              {isDone && i === 1 && provider && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#555' }}>
                  {provider.name}
                </span>
              )}
              {isDone && i === 2 && hw && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#555' }}>
                  {hw.os}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Hardware + provider detail cards */}
      {!loading && hw && provider && !showProfile && (
        <div style={{
          width: '100%', maxWidth: 440,
          display: 'flex', flexDirection: 'column', gap: 10,
          marginBottom: 40,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <InfoCard title="AI Provider" value={provider.name}
              sub={provider.type === 'local' ? '100% on your machine' : 'Cloud API'}
              accent={provider.type === 'local' ? '#22c55e' : '#3b82f6'} />
            <InfoCard title="Model" value={provider.model} sub="active model" accent="#f97316" />
            <InfoCard title="RAM" value={hw.ram}    sub="available memory"    accent="#888" />
            <InfoCard title="System"  value={hw.os} sub={hw.disk}             accent="#888" />
          </div>

          {/* Ollama local models */}
          {ollama && (
            <div style={{
              background: '#141414', border: '1px solid #1e1e1e', borderRadius: 8,
              padding: '14px 16px',
              borderLeft: `3px solid ${ollama.available ? '#22c55e' : '#555'}`,
            }}>
              <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                Local AI (Ollama)
              </div>
              {ollama.available && ollama.models.length > 0 ? (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', marginBottom: 6 }}>
                    ✓ Running — {ollama.models.length} model{ollama.models.length !== 1 ? 's' : ''} found
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {ollama.models.map(m => (
                      <span key={m.name} style={{
                        fontSize: 10, padding: '3px 7px', borderRadius: 4,
                        background: '#1e1e1e', color: '#aaa',
                        border: '1px solid #2a2a2a',
                      }}>
                        {m.name}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#555' }}>
                  Not detected — install Ollama for offline AI
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Profile form — step 3 */}
      {showProfile && (
        <div style={{
          width: '100%', maxWidth: 440,
          background: '#141414',
          border: '1px solid #222',
          borderRadius: 12,
          padding: '24px 28px',
          marginBottom: 40,
          animation: 'fadeIn 0.4s ease',
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8e8', marginBottom: 4 }}>
              Tell Aiden about yourself
            </div>
            <div style={{ fontSize: 11, color: '#555' }}>
              Aiden will use this to personalise every response. You can edit it anytime in Settings.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>YOUR NAME</label>
              <input
                style={inputStyle}
                placeholder="e.g. Shiva"
                value={pName}
                onChange={e => setPName(e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>YOUR ROLE</label>
              <input
                style={inputStyle}
                placeholder="e.g. Solo founder, Developer, Trader, Student"
                value={pRole}
                onChange={e => setPRole(e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>TIMEZONE</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={pTz}
                onChange={e => setPTz(e.target.value)}
              >
                {['IST', 'PST', 'EST', 'CST', 'MST', 'GMT', 'CET', 'JST', 'AEST'].map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>GITHUB USERNAME (OPTIONAL)</label>
              <input
                style={inputStyle}
                placeholder="e.g. shivadeore"
                value={pGithub}
                onChange={e => setPGithub(e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>WHAT SHOULD I MONITOR? (OPTIONAL)</label>
              <input
                style={inputStyle}
                placeholder="e.g. NIFTY, my email, GitHub repo"
                value={pMonitor}
                onChange={e => setPMonitor(e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>PREFERRED RESPONSE STYLE</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['Direct', 'Detailed', 'Conversational'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setPStyle(s)}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 6,
                      border: `1px solid ${pStyle === s ? '#f97316' : '#2a2a2a'}`,
                      background: pStyle === s ? 'rgba(249,115,22,0.12)' : 'transparent',
                      color: pStyle === s ? '#f97316' : '#666',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >{s}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button
              onClick={handleProfileSubmit}
              disabled={pSaving}
              style={{
                flex: 1, background: '#f97316', border: 'none', borderRadius: 7,
                padding: '11px 0', fontSize: 12, fontWeight: 700, color: '#000',
                fontFamily: "'JetBrains Mono', monospace",
                cursor: pSaving ? 'default' : 'pointer',
                opacity: pSaving ? 0.7 : 1, transition: 'opacity 0.15s',
              }}
            >
              {pSaving ? 'Saving...' : 'Save profile →'}
            </button>
            <button
              onClick={handleProfileSkip}
              disabled={pSaving}
              style={{
                padding: '11px 16px', background: 'transparent',
                border: '1px solid #2a2a2a', borderRadius: 7,
                fontSize: 11, color: '#555', cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* CTA */}
      {!loading && !showProfile && (
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
        Aiden v3.0 · by Taracod · aiden.taracod.com
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
