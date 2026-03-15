'use client'
import { useState, useEffect } from 'react'
import { useStore } from '../lib/store'

interface OllamaModel {
  name: string
  size: number
  recommended?: boolean
}

const STEPS = ['welcome', 'provider', 'model', 'profile', 'done'] as const
type Step = typeof STEPS[number]

export function SetupWizard() {
  const { settings, setSettings, setIsSetupOpen } = useStore()
  const [step, setStep] = useState<Step>('welcome')
  const [models, setModels] = useState<OllamaModel[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    userName: '',
    apiProvider: 'ollama' as 'ollama' | 'openai' | 'anthropic',
    apiKey: '',
    selectedModel: ''
  })

  // Fetch Ollama models
  useEffect(() => {
    if (step === 'model') {
      setLoading(true)
      fetch('http://localhost:11434/api/tags')
        .then(r => r.json())
        .then(data => {
          const modelList = (data.models || []).map((m: any) => ({
            name: m.name,
            size: m.size,
            recommended: m.name.includes('mistral-nemo') || m.name.includes('qwen2.5-coder')
          }))
          setModels(modelList)
          if (modelList.length > 0) {
            const rec = modelList.find((m: OllamaModel) => m.recommended) || modelList[0]
            setForm(f => ({ ...f, selectedModel: rec.name }))
          }
        })
        .catch(() => setModels([]))
        .finally(() => setLoading(false))
    }
  }, [step])

  const next = () => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  const complete = () => {
    const newSettings = {
      ...settings,
      ...form,
      isSetupComplete: true
    }
    setSettings(newSettings)
    setIsSetupOpen(false)
  }

  const formatSize = (bytes: number) => {
    if (!bytes) return ''
    return (bytes / 1e9).toFixed(1) + ' GB'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}>

      {/* Glass card */}
      <div className="relative w-full max-w-lg mx-4 rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(40px)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}>

        {/* Progress bar */}
        <div className="h-1 w-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div className="h-1 transition-all duration-500"
            style={{
              width: `${((STEPS.indexOf(step) + 1) / STEPS.length) * 100}%`,
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6)'
            }} />
        </div>

        <div className="p-8">
          {/* Welcome step */}
          {step === 'welcome' && (
            <div className="text-center space-y-6">
              <div className="text-6xl mb-4">⚡</div>
              <h1 className="text-3xl font-bold text-white">Welcome to DevOS</h1>
              <p className="text-gray-400 text-lg">Autonomous AI OS — describe what you want to build, DevOS does the rest.</p>
              <p className="text-gray-500 text-sm">Let&apos;s set things up. Takes 60 seconds.</p>
              <button onClick={next}
                className="w-full py-3 rounded-2xl font-semibold text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                Get Started →
              </button>
            </div>
          )}

          {/* Provider step */}
          {step === 'provider' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Choose AI Provider</h2>
                <p className="text-gray-400 text-sm">Run locally for free, or use a cloud provider.</p>
              </div>
              <div className="space-y-3">
                {[
                  { id: 'ollama', label: 'Ollama (Local)', desc: 'Free, private, runs on your machine', icon: '🖥️' },
                  { id: 'openai', label: 'OpenAI', desc: 'GPT-4o and latest models', icon: '🤖' },
                  { id: 'anthropic', label: 'Anthropic', desc: 'Claude models', icon: '🧠' }
                ].map(p => (
                  <button key={p.id}
                    onClick={() => setForm(f => ({ ...f, apiProvider: p.id as 'ollama' | 'openai' | 'anthropic' }))}
                    className="w-full p-4 rounded-2xl text-left transition-all"
                    style={{
                      background: form.apiProvider === p.id
                        ? 'rgba(99,102,241,0.3)'
                        : 'rgba(255,255,255,0.05)',
                      border: form.apiProvider === p.id
                        ? '1px solid rgba(99,102,241,0.8)'
                        : '1px solid rgba(255,255,255,0.08)'
                    }}>
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{p.icon}</span>
                      <div>
                        <p className="text-white font-medium">{p.label}</p>
                        <p className="text-gray-400 text-xs">{p.desc}</p>
                      </div>
                      {form.apiProvider === p.id && <span className="ml-auto text-indigo-400">✓</span>}
                    </div>
                  </button>
                ))}
              </div>
              {form.apiProvider !== 'ollama' && (
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">API Key</label>
                  <input
                    type="password"
                    placeholder={form.apiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                    value={form.apiKey}
                    onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl text-white placeholder-gray-600 focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              )}
              <button onClick={next}
                className="w-full py-3 rounded-2xl font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                Continue →
              </button>
            </div>
          )}

          {/* Model step */}
          {step === 'model' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Select Model</h2>
                <p className="text-gray-400 text-sm">
                  {form.apiProvider === 'ollama' ? 'Models found on your machine:' : 'Choose a model to use:'}
                </p>
              </div>
              {loading && <p className="text-gray-500 text-center py-4">Scanning models...</p>}
              {!loading && form.apiProvider === 'ollama' && models.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-gray-400 mb-2">No models found.</p>
                  <p className="text-gray-500 text-sm">Run: <code className="text-indigo-400">ollama pull mistral-nemo:12b</code></p>
                </div>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {form.apiProvider === 'ollama' ? models.map(m => (
                  <button key={m.name}
                    onClick={() => setForm(f => ({ ...f, selectedModel: m.name }))}
                    className="w-full p-3 rounded-2xl text-left transition-all"
                    style={{
                      background: form.selectedModel === m.name ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
                      border: form.selectedModel === m.name ? '1px solid rgba(99,102,241,0.8)' : '1px solid rgba(255,255,255,0.08)'
                    }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{m.name}</p>
                        {m.size > 0 && <p className="text-gray-500 text-xs">{formatSize(m.size)}</p>}
                      </div>
                      <div className="flex items-center space-x-2">
                        {m.recommended && <span className="text-xs px-2 py-0.5 rounded-full text-indigo-300" style={{ background: 'rgba(99,102,241,0.2)' }}>Recommended</span>}
                        {form.selectedModel === m.name && <span className="text-indigo-400">✓</span>}
                      </div>
                    </div>
                  </button>
                )) : [
                  { id: 'gpt-4o', label: 'GPT-4o', desc: 'Most capable' },
                  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Fast and cheap' },
                  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', desc: 'Best for coding' },
                  { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', desc: 'Fast and affordable' }
                ].filter(m => form.apiProvider === 'openai' ? m.id.startsWith('gpt') : m.id.startsWith('claude'))
                 .map(m => (
                  <button key={m.id}
                    onClick={() => setForm(f => ({ ...f, selectedModel: m.id }))}
                    className="w-full p-3 rounded-2xl text-left transition-all"
                    style={{
                      background: form.selectedModel === m.id ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
                      border: form.selectedModel === m.id ? '1px solid rgba(99,102,241,0.8)' : '1px solid rgba(255,255,255,0.08)'
                    }}>
                    <p className="text-white text-sm font-medium">{m.label}</p>
                    <p className="text-gray-500 text-xs">{m.desc}</p>
                  </button>
                ))}
              </div>
              <button onClick={next} disabled={!form.selectedModel}
                className="w-full py-3 rounded-2xl font-semibold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                Continue →
              </button>
            </div>
          )}

          {/* Profile step */}
          {step === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">What&apos;s your name?</h2>
                <p className="text-gray-400 text-sm">DevOS will personalize your experience.</p>
              </div>
              <input
                type="text"
                placeholder="Your name"
                value={form.userName}
                onChange={e => setForm(f => ({ ...f, userName: e.target.value }))}
                autoFocus
                className="w-full px-4 py-3 rounded-2xl text-white placeholder-gray-600 focus:outline-none text-lg"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                onKeyDown={e => e.key === 'Enter' && form.userName.trim() && next()}
              />
              <button onClick={next} disabled={!form.userName.trim()}
                className="w-full py-3 rounded-2xl font-semibold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                Continue →
              </button>
            </div>
          )}

          {/* Done step */}
          {step === 'done' && (
            <div className="text-center space-y-6">
              <div className="text-6xl">🚀</div>
              <h2 className="text-3xl font-bold text-white">
                Ready, {form.userName || 'builder'}!
              </h2>
              <div className="text-left space-y-2 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p className="text-gray-400 text-sm">✓ Provider: <span className="text-white">{form.apiProvider}</span></p>
                <p className="text-gray-400 text-sm">✓ Model: <span className="text-white">{form.selectedModel || 'default'}</span></p>
                <p className="text-gray-400 text-sm">✓ Name: <span className="text-white">{form.userName}</span></p>
              </div>
              <button onClick={complete}
                className="w-full py-3 rounded-2xl font-semibold text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                Launch DevOS ⚡
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
