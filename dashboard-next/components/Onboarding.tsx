"use client"
import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────

interface LocalModel {
  id: string
  label: string
  speed: string
  contextWindow: number
  installed: boolean
  recommended: boolean
}

interface CloudProvider {
  id: string
  label: string
  subtitle: string
  url: string
  models: string[]
}

interface OnboardingData {
  localModels:  LocalModel[]
  cloudProviders: CloudProvider[]
  existingApis: { name: string; provider: string }[]
  userName?: string
}

// ── Helpers ───────────────────────────────────────────────────

const cardStyle = (selected: boolean): React.CSSProperties => ({
  padding:    '14px 16px',
  borderRadius: '10px',
  border:     selected
    ? '1px solid rgba(99,179,237,0.5)'
    : '1px solid rgba(255,255,255,0.08)',
  background: selected ? 'rgba(99,179,237,0.1)' : 'rgba(255,255,255,0.03)',
  cursor:     'pointer',
  transition: 'all .15s',
})

// ── Onboarding component ──────────────────────────────────────

export default function Onboarding({ onComplete }: { onComplete: (name: string) => void }) {
  const [step, setStep]                       = useState(1)
  const [name, setName]                       = useState('')
  const [modelType, setModelType]             = useState<'local' | 'api'>('local')
  const [selectedModel, setSelectedModel]     = useState('')
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedApiModel, setSelectedApiModel] = useState('')
  const [apiKey, setApiKey]                   = useState('')
  const [apiName, setApiName]                 = useState('')
  const [data, setData]                       = useState<OnboardingData | null>(null)
  const [saving, setSaving]                   = useState(false)
  const [showApiKey, setShowApiKey]           = useState(false)

  useEffect(() => {
    fetch('http://localhost:4200/api/onboarding')
      .then(r => r.json())
      .then((d: OnboardingData & { userName?: string }) => {
        setData(d)
        if (d.localModels?.[0]) setSelectedModel(d.localModels[0].id)
        if (d.userName && d.userName !== 'there') setName(d.userName)
      })
      .catch(() => {})
  }, [])

  const finish = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const provider = data?.cloudProviders.find(p => p.id === selectedProvider)
      await fetch('http://localhost:4200/api/onboarding', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName:    name.trim(),
          modelType,
          modelId:     modelType === 'local' ? selectedModel : undefined,
          apiProvider: selectedProvider,
          apiKey:      apiKey.trim(),
          apiName:     apiName.trim() || `${selectedProvider}-main`,
          apiModel:    selectedApiModel || provider?.models[0],
        }),
      })
      onComplete(name.trim())
    } catch { /* server offline — still complete */ onComplete(name.trim()) }
    setSaving(false)
  }

  const canProceedStep2 = modelType === 'local'
    ? !!selectedModel
    : !!selectedProvider && !!apiKey.trim()

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{
      height:         '100vh',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'radial-gradient(ellipse at 30% 20%, #0a1628 0%, #060d1f 50%, #030812 100%)',
      padding:        '20px',
      overflowY:      'auto',
    }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'40px', justifyContent:'center' }}>
          <div style={{
            width:'36px', height:'36px',
            background:'rgba(99,179,237,0.15)',
            border:'1px solid rgba(99,179,237,0.3)',
            borderRadius:'9px',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#63b3ed" strokeWidth="2">
              <rect x="3"  y="3"  width="7" height="7" rx="1"/>
              <rect x="14" y="3"  width="7" height="7" rx="1"/>
              <rect x="3"  y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <span style={{ fontSize:'20px', fontWeight:800, color:'#e8e8e8' }}>DevOS</span>
        </div>

        {/* Step indicators */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', marginBottom:'32px' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{
                width:'28px', height:'28px', borderRadius:'50%',
                background: step >= s ? 'rgba(99,179,237,0.2)' : 'rgba(255,255,255,0.04)',
                border:     step === s ? '1px solid rgba(99,179,237,0.5)'
                          : step > s  ? '1px solid rgba(34,197,94,0.4)'
                          :             '1px solid rgba(255,255,255,0.08)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'11px', fontFamily:'monospace',
                color: step > s ? '#22c55e' : step === s ? '#63b3ed' : 'rgba(255,255,255,0.2)',
              }}>
                {step > s ? '✓' : s}
              </div>
              {s < 3 && (
                <div style={{
                  width:'32px', height:'1px',
                  background: step > s ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)',
                }}/>
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 1 — Name ────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            <div>
              <h2 style={{ fontSize:'22px', fontWeight:800, marginBottom:'6px' }}>Welcome to DevOS.</h2>
              <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.4)', lineHeight:'1.6' }}>
                Your personal AI OS — running 100% on your machine.
              </p>
            </div>
            <div>
              <label style={{
                fontSize:'12px', fontFamily:'monospace',
                color:'rgba(255,255,255,0.4)', display:'block', marginBottom:'8px',
              }}>
                What should I call you?
              </label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(2)}
                placeholder="Your name..."
                style={{
                  width:'100%', padding:'12px 14px',
                  background:'rgba(255,255,255,0.05)',
                  border:'1px solid rgba(255,255,255,0.1)',
                  borderRadius:'10px', color:'#e8e8e8',
                  fontSize:'15px', fontFamily:'inherit',
                  outline:'none', transition:'border-color .15s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(99,179,237,0.4)')}
                onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            </div>
            <button
              onClick={() => name.trim() && setStep(2)}
              disabled={!name.trim()}
              style={{
                padding:'12px', borderRadius:'10px', border:'none',
                cursor:     name.trim() ? 'pointer' : 'default',
                background: name.trim() ? '#63b3ed' : 'rgba(255,255,255,0.05)',
                color:      name.trim() ? '#000'    : 'rgba(255,255,255,0.2)',
                fontSize:'14px', fontWeight:600, transition:'all .15s',
              }}
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP 2 — Model selection ──────────────────────────── */}
        {step === 2 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <h2 style={{ fontSize:'22px', fontWeight:800, marginBottom:'6px' }}>
                Pick your brain, {name}.
              </h2>
              <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.4)' }}>
                Choose the AI model that powers DevOS.
              </p>
            </div>

            {/* Local / API toggle */}
            <div style={{
              display:'flex', gap:'4px',
              background:'rgba(255,255,255,0.04)',
              borderRadius:'8px', padding:'3px',
            }}>
              {(['local', 'api'] as const).map(t => (
                <button key={t} onClick={() => setModelType(t)} style={{
                  flex:1, padding:'7px', borderRadius:'6px', border:'none', cursor:'pointer',
                  background: modelType === t ? 'rgba(99,179,237,0.15)' : 'transparent',
                  color:      modelType === t ? '#63b3ed' : 'rgba(255,255,255,0.3)',
                  fontSize:'12px', fontFamily:'monospace', transition:'all .15s',
                }}>
                  {t === 'local' ? '⚡ Local (Ollama)' : '☁ Cloud API'}
                </button>
              ))}
            </div>

            {/* ── LOCAL MODELS ─────────────────────────────────── */}
            {modelType === 'local' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'300px', overflowY:'auto' }}>
                {(!data?.localModels || data.localModels.length === 0) && (
                  <div style={{
                    padding:'20px', textAlign:'center',
                    fontSize:'12px', fontFamily:'monospace',
                    color:'rgba(255,255,255,0.3)',
                    background:'rgba(255,255,255,0.03)',
                    borderRadius:'10px', border:'1px solid rgba(255,255,255,0.06)',
                    lineHeight: '1.8',
                  }}>
                    No models found.<br/>
                    <span style={{ color:'#f97316' }}>ollama pull mistral:7b</span> to get started.
                  </div>
                )}
                {data?.localModels.map(m => (
                  <div key={m.id} onClick={() => setSelectedModel(m.id)} style={cardStyle(selectedModel === m.id)}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ fontSize:'13px', fontWeight:600 }}>{m.label}</span>
                          {m.recommended && (
                            <span style={{
                              fontSize:'9px', fontFamily:'monospace',
                              padding:'2px 6px',
                              background:'rgba(249,115,22,0.15)',
                              border:'1px solid rgba(249,115,22,0.25)',
                              borderRadius:'3px', color:'#f97316',
                            }}>recommended</span>
                          )}
                        </div>
                        <div style={{ fontSize:'11px', fontFamily:'monospace', color:'rgba(255,255,255,0.3)', marginTop:'3px' }}>
                          {m.speed} · {(m.contextWindow / 1000).toFixed(0)}k ctx
                        </div>
                      </div>
                      <div style={{
                        width:'16px', height:'16px', borderRadius:'50%',
                        border: selectedModel === m.id ? '5px solid #63b3ed' : '2px solid rgba(255,255,255,0.15)',
                        transition:'all .15s', flexShrink:0,
                      }}/>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── CLOUD PROVIDERS ──────────────────────────────── */}
            {modelType === 'api' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {data?.cloudProviders.map(p => (
                  <div key={p.id} onClick={() => {
                    setSelectedProvider(p.id)
                    setSelectedApiModel(p.models[0])
                    setApiName(`${p.id}-main`)
                  }} style={cardStyle(selectedProvider === p.id)}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:600, marginBottom:'3px' }}>{p.label}</div>
                        <div style={{ fontSize:'11px', fontFamily:'monospace', color:'rgba(255,255,255,0.3)' }}>
                          {p.subtitle}
                        </div>
                      </div>
                      <div style={{
                        width:'16px', height:'16px', borderRadius:'50%',
                        border: selectedProvider === p.id ? '5px solid #63b3ed' : '2px solid rgba(255,255,255,0.15)',
                        transition:'all .15s', flexShrink:0, marginTop:'2px',
                      }}/>
                    </div>

                    {selectedProvider === p.id && (
                      <div style={{ marginTop:'12px', display:'flex', flexDirection:'column', gap:'8px' }}
                        onClick={e => e.stopPropagation()}>
                        {/* API key input */}
                        <div style={{ position:'relative' }}>
                          <input
                            autoFocus
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder={`Paste your ${p.label} API key...`}
                            type={showApiKey ? 'text' : 'password'}
                            style={{
                              width:'100%', padding:'9px 40px 9px 12px',
                              background:'rgba(0,0,0,0.3)',
                              border:'1px solid rgba(255,255,255,0.1)',
                              borderRadius:'7px', color:'#e8e8e8',
                              fontSize:'12px', fontFamily:'monospace',
                              outline:'none', boxSizing:'border-box',
                            }}
                          />
                          <button onClick={() => setShowApiKey(!showApiKey)} style={{
                            position:'absolute', right:'8px', top:'50%', transform:'translateY(-50%)',
                            background:'transparent', border:'none', cursor:'pointer',
                            color:'rgba(255,255,255,0.3)', fontSize:'11px', fontFamily:'monospace',
                          }}>{showApiKey ? 'hide' : 'show'}</button>
                        </div>
                        {/* Get key link */}
                        <a href={p.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize:'10px', fontFamily:'monospace', color:'#63b3ed', textDecoration:'none' }}>
                          Get free API key → {p.url.replace('https://', '')}
                        </a>
                        {/* Model selector */}
                        <select value={selectedApiModel} onChange={e => setSelectedApiModel(e.target.value)} style={{
                          padding:'8px 10px',
                          background:'rgba(0,0,0,0.3)',
                          border:'1px solid rgba(255,255,255,0.1)',
                          borderRadius:'7px', color:'#e8e8e8',
                          fontSize:'12px', fontFamily:'monospace', outline:'none',
                        }}>
                          {p.models.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Navigation */}
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => setStep(1)} style={{
                flex:1, padding:'11px', borderRadius:'10px',
                border:'1px solid rgba(255,255,255,0.08)',
                background:'transparent', color:'rgba(255,255,255,0.3)',
                fontSize:'13px', cursor:'pointer',
              }}>← Back</button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                style={{
                  flex:2, padding:'11px', borderRadius:'10px', border:'none',
                  cursor:     canProceedStep2 ? 'pointer' : 'default',
                  background: canProceedStep2 ? '#63b3ed' : 'rgba(255,255,255,0.05)',
                  color:      canProceedStep2 ? '#000'    : 'rgba(255,255,255,0.2)',
                  fontSize:'14px', fontWeight:600, transition:'all .15s',
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 — Confirm ─────────────────────────────────── */}
        {step === 3 && (
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            <div>
              <h2 style={{ fontSize:'22px', fontWeight:800, marginBottom:'6px' }}>
                Ready to go, {name}.
              </h2>
              <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.4)' }}>Here's your setup:</p>
            </div>

            <div style={{
              background:'rgba(255,255,255,0.04)',
              border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'12px', padding:'16px',
              display:'flex', flexDirection:'column', gap:'10px',
            }}>
              {[
                { label: 'Name', value: name },
                {
                  label: 'Brain',
                  value: modelType === 'local'
                    ? (data?.localModels.find(m => m.id === selectedModel)?.label || selectedModel)
                    : `${selectedProvider} · ${selectedApiModel}`,
                },
                {
                  label: 'Mode',
                  value: modelType === 'local'
                    ? '⚡ Local — data stays on your machine'
                    : '☁ Cloud API',
                },
              ].map(item => (
                <div key={item.label} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  paddingBottom:'8px', borderBottom:'1px solid rgba(255,255,255,0.05)',
                }}>
                  <span style={{ fontSize:'11px', fontFamily:'monospace', color:'rgba(255,255,255,0.35)' }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize:'13px', fontWeight:500 }}>{item.value}</span>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => setStep(2)} style={{
                flex:1, padding:'11px', borderRadius:'10px',
                border:'1px solid rgba(255,255,255,0.08)',
                background:'transparent', color:'rgba(255,255,255,0.3)',
                fontSize:'13px', cursor:'pointer',
              }}>← Back</button>
              <button onClick={finish} disabled={saving} style={{
                flex:2, padding:'11px', borderRadius:'10px', border:'none',
                background:'#63b3ed', color:'#000',
                fontSize:'14px', fontWeight:700, cursor:'pointer',
                opacity: saving ? 0.7 : 1, transition:'opacity .15s',
              }}>
                {saving ? 'Setting up...' : 'Launch DevOS →'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
