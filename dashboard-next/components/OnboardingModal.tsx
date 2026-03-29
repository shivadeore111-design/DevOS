'use client'
import { useState } from 'react'

export function OnboardingModal({ onComplete }: { onComplete: (name: string) => void }) {
  const [step, setStep]       = useState(0)
  const [name, setName]       = useState('')
  const [apiKey, setApiKey]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [keyError, setKeyError] = useState('')

  const steps = ['Welcome', 'Your Name', 'API Key', 'Ready']

  const finish = async () => {
    setSaving(true)

    // Save the API key if one was provided
    if (apiKey.trim()) {
      await fetch('http://localhost:4200/api/providers/add', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:     'groq-1',
          provider: 'groq',
          key:      apiKey.trim(),
          model:    'llama-3.3-70b-versatile',
          enabled:  true,
        }),
      }).catch(() => {})
    }

    // Mark onboarding complete
    await fetch('http://localhost:4200/api/onboarding', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userName: name || 'there', modelType: 'local' }),
    }).catch(() => {})

    setSaving(false)
    onComplete(name || 'there')
  }

  const mono: React.CSSProperties = { fontFamily: 'JetBrains Mono, monospace' }

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 'min(90vw, 480px)',
        background: '#141414',
        border: '1px solid #2a2a2a',
        borderRadius: 16,
        padding: 40,
        zIndex: 1001,
      }}>

        {/* Step progress bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              height: 3, flex: 1, borderRadius: 2,
              background: i <= step ? '#f97316' : '#2a2a2a',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Step 0 — Welcome */}
        {step === 0 && (
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: '#e8e8e8' }}>
              Hey, I&apos;m Aiden.
            </div>
            <div style={{ ...mono, fontSize: 12, color: '#888', marginBottom: 32, lineHeight: 1.8 }}>
              Your local AI OS. I run 100% on your machine.<br />
              No cloud. No telemetry. Your data stays here.
            </div>
            <button
              onClick={() => setStep(1)}
              style={{
                width: '100%', padding: 12,
                background: '#f97316', border: 'none',
                borderRadius: 8, color: '#000',
                ...mono, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Let&apos;s get started →
            </button>
          </div>
        )}

        {/* Step 1 — Your Name */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#e8e8e8' }}>
              What should I call you?
            </div>
            <div style={{ ...mono, fontSize: 12, color: '#888', marginBottom: 24 }}>
              I&apos;ll use this in every conversation.
            </div>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(2)}
              placeholder="Your name"
              style={{
                width: '100%', padding: '10px 14px',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 8, color: '#e8e8e8',
                ...mono, fontSize: 14, outline: 'none',
                marginBottom: 16, boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => name.trim() && setStep(2)}
              disabled={!name.trim()}
              style={{
                width: '100%', padding: 12,
                background: name.trim() ? '#f97316' : '#333',
                border: 'none', borderRadius: 8,
                color: name.trim() ? '#000' : '#666',
                ...mono, fontSize: 13, fontWeight: 700,
                cursor: name.trim() ? 'pointer' : 'default',
                transition: 'all 0.15s',
              }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* Step 2 — API Key */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#e8e8e8' }}>
              Add an API key
            </div>
            <div style={{ ...mono, fontSize: 12, color: '#888', marginBottom: 6, lineHeight: 1.8 }}>
              Paste your <span style={{ color: '#f97316' }}>Groq</span> API key to get started fast.
            </div>
            <div style={{ ...mono, fontSize: 11, color: '#555', marginBottom: 20 }}>
              Free at console.groq.com — no credit card needed.
            </div>
            <input
              autoFocus
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setKeyError('') }}
              onKeyDown={e => e.key === 'Enter' && apiKey.trim() && setStep(3)}
              placeholder="gsk_..."
              type="password"
              style={{
                width: '100%', padding: '10px 14px',
                background: '#1a1a1a',
                border: `1px solid ${keyError ? '#ef4444' : '#333'}`,
                borderRadius: 8, color: '#e8e8e8',
                ...mono, fontSize: 13, outline: 'none',
                marginBottom: keyError ? 6 : 16, boxSizing: 'border-box',
              }}
            />
            {keyError && (
              <div style={{ ...mono, fontSize: 11, color: '#ef4444', marginBottom: 12 }}>{keyError}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setStep(3)}
                style={{
                  flex: 1, padding: 12,
                  background: 'transparent', border: '1px solid #333',
                  borderRadius: 8, color: '#666',
                  ...mono, fontSize: 12, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Skip for now
              </button>
              <button
                onClick={() => {
                  if (!apiKey.trim()) { setKeyError('Enter a key or skip'); return }
                  if (!apiKey.trim().startsWith('gsk_') && !apiKey.trim().startsWith('sk-')) {
                    setKeyError('Key should start with gsk_ or sk-')
                    return
                  }
                  setStep(3)
                }}
                style={{
                  flex: 2, padding: 12,
                  background: apiKey.trim() ? '#f97316' : '#333',
                  border: 'none', borderRadius: 8,
                  color: apiKey.trim() ? '#000' : '#666',
                  ...mono, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                Save &amp; continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Ready */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#e8e8e8' }}>
              Ready, {name || 'there'}.
            </div>
            <div style={{ ...mono, fontSize: 12, color: '#888', marginBottom: 8, lineHeight: 1.8 }}>
              ✓ Running locally on your machine<br />
              {apiKey.trim() ? '✓ API key saved' : '○ No API key — using Ollama'}<br />
              ✓ 23 tools ready to use
            </div>
            <div style={{ ...mono, fontSize: 11, color: '#555', marginBottom: 16 }}>
              You can add or change API keys anytime in Settings.
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#555', marginBottom: 28 }}>
              Aiden works out of the box with free AI providers.<br/>
              Add Groq or Gemini in Settings for faster, smarter responses.
            </div>
            <button
              onClick={finish}
              disabled={saving}
              style={{
                width: '100%', padding: 12,
                background: '#f97316', border: 'none',
                borderRadius: 8, color: '#000',
                ...mono, fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Starting...' : 'Start using Aiden →'}
            </button>
          </div>
        )}

      </div>
    </>
  )
}
