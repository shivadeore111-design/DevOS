"use client"
import {
  useState, useEffect, useRef, useMemo, useCallback,
  createContext, useContext,
} from 'react'
import Onboarding from '../components/Onboarding'
import { OnboardingModal } from '../components/OnboardingModal'
import PricingModal from '../components/PricingModal'

// ── Types ─────────────────────────────────────────────────────

type UIMode   = 'focus' | 'execution' | 'power' | 'watch'
type ExecMode = 'auto'  | 'plan'      | 'chat'

interface Phase {
  name:   string
  index:  number
  total:  number
  steps:  { tool: string; status: 'pending' | 'running' | 'done' | 'failed'; duration?: number }[]
  status: 'pending' | 'running' | 'done'
}

interface Message {
  id:          string
  role:        'user' | 'assistant'
  content:     string
  provider?:   string
  timestamp:   number
  phases?:     Phase[]
  isStreaming?: boolean
}

interface Conversation {
  id:        string
  title:     string
  timestamp: number
  messages:  Message[]
}

interface ActivityLog {
  time:    string
  icon:    string
  agent:   string
  message: string
  style?:  'ok' | 'err' | 'active' | 'default'
}

interface MiniPromptConfig { type: 'websearch' | 'research' | 'stocks'; placeholder: string }

type MenuItem =
  | { id: string; icon: string; label: string; action: () => void; children?: never }
  | { id: string; icon: string; label: string; children: { id: string; icon: string; label: string; action: () => void }[]; action?: never }

// ── Provider metadata ─────────────────────────────────────────

const PROVIDER_INFO: Record<string, {
  label: string; color: string; freeUrl: string; defaultModel: string; models: string[]
}> = {
  groq:       { label: 'Groq',       color: '#f55036', freeUrl: 'https://console.groq.com',                   defaultModel: 'llama-3.3-70b-versatile',           models: ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'] },
  gemini:     { label: 'Gemini',     color: '#4285f4', freeUrl: 'https://aistudio.google.com/app/apikey',     defaultModel: 'gemini-1.5-flash',                  models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'] },
  openrouter: { label: 'OpenRouter', color: '#7c3aed', freeUrl: 'https://openrouter.ai/keys',                 defaultModel: 'meta-llama/llama-3.3-70b-instruct', models: ['meta-llama/llama-3.3-70b-instruct', 'google/gemini-flash-1.5', 'mistralai/mistral-7b-instruct:free'] },
  cerebras:   { label: 'Cerebras',   color: '#059669', freeUrl: 'https://cloud.cerebras.ai',                  defaultModel: 'llama3.1-8b',                       models: ['llama3.1-8b', 'llama3.3-70b'] },
  nvidia:     { label: 'NVIDIA NIM', color: '#76b900', freeUrl: 'https://build.nvidia.com/explore/discover',  defaultModel: 'meta/llama-3.3-70b-instruct',       models: ['meta/llama-3.3-70b-instruct', 'meta/llama-3.1-405b-instruct'] },
}

// ── Context ───────────────────────────────────────────────────

interface DevOSCtxType {
  // UI mode
  uiMode:         UIMode
  setUIMode:      (m: UIMode | ((prev: UIMode) => UIMode)) => void
  execMode:       ExecMode
  setExecMode:    (m: ExecMode) => void
  historyOpen:    boolean
  setHistoryOpen: (v: boolean | ((prev: boolean) => boolean)) => void
  liveViewOpen:   boolean
  setLiveViewOpen:(v: boolean | ((prev: boolean) => boolean)) => void
  activityOpen:   boolean
  setActivityOpen:(v: boolean | ((prev: boolean) => boolean)) => void
  settingsOpen:   boolean
  setSettingsOpen:(v: boolean) => void
  settingsTab:    string
  setSettingsTab: (v: string) => void
  // Execution
  isExecuting:    boolean
  isStreaming:    boolean
  // Messages / conversations
  messages:       Message[]
  setMessages:    React.Dispatch<React.SetStateAction<Message[]>>
  conversations:  Conversation[]
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>
  currentConvId:  string
  input:          string
  setInput:       (v: string) => void
  // Activity
  activityLogs:    ActivityLog[]
  setActivityLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>
  // Screenshot
  screenshot:     string | null
  setScreenshot:  React.Dispatch<React.SetStateAction<string | null>>
  // Session
  sessionId:      string
  // Live view data
  systemStats:    any
  recentTasks:    any[]
  // Plus menu
  plusMenuOpen:    boolean
  setPlusMenuOpen: (v: boolean) => void
  activeSubmenu:   string | null
  setActiveSubmenu:(v: string | null) => void
  channelStatuses: Record<string, boolean>
  channelModal:    string | null
  setChannelModal: (v: string | null) => void
  miniPrompt:      MiniPromptConfig | null
  setMiniPrompt:   (v: MiniPromptConfig | null) => void
  miniPromptValue: string
  setMiniPromptValue:(v: string) => void
  // Voice
  voiceStatus:    { stt: boolean; tts: boolean }
  isRecording:    boolean
  ttsEnabled:     boolean
  setTtsEnabled:  (v: boolean) => void
  recordingTimer: number
  startRecording: () => void
  // Handlers
  sendMessage:     (text?: string) => void
  takeScreenshot:  () => void
  submitMiniPrompt:() => void
  startNewChat:   () => void
  loadConversation: (id: string) => void
  handleQuickUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  // Refs
  inputRef:       React.RefObject<HTMLTextAreaElement>
  kbInputRef:     React.RefObject<HTMLInputElement>
  messagesEndRef: React.RefObject<HTMLDivElement>
  logsEndRef:     React.RefObject<HTMLDivElement>
  // API Keys (settings)
  providers:      any[]
  routing:        any
  addingProvider: string | null
  setAddingProvider: (v: string | null) => void
  newKey:         string
  setNewKey:      (v: string) => void
  newModel:       string
  setNewModel:    (v: string) => void
  savingKey:      boolean
  saveKey:        (providerID: string) => void
  toggleProvider: (name: string, enabled: boolean) => void
  deleteProvider: (name: string) => void
  resetLimits:    () => void
  // Knowledge base (settings)
  knowledgeFiles:    any[]
  knowledgeStats:    any
  uploadingFile:     boolean
  uploadCategory:    string
  setUploadCategory: (v: string) => void
  knowledgeInputRef: React.RefObject<HTMLInputElement>
  handleKnowledgeUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleKnowledgeDelete: (id: string) => void
  // License / Pro
  pricingOpen:    boolean
  setPricingOpen: (v: boolean) => void
  licenseStatus:  { active: boolean; tier: string; email: string; expiry: number }
  licenseKey:     string
  setLicenseKey:  (v: string) => void
  activatingKey:  boolean
  licenseMsg:     { type: 'success' | 'error'; text: string } | null
  setLicenseMsg:  (v: { type: 'success' | 'error'; text: string } | null) => void
  validateKey:    (key: string) => Promise<{ success: boolean; error?: string }>
  clearProLicense:() => Promise<void>
}

const DevOSCtx = createContext<DevOSCtxType>(null!)
function useDevOS() { return useContext(DevOSCtx) }

// ── Style constants ───────────────────────────────────────────

const codeStyle: React.CSSProperties = {
  background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 3, padding: '1px 6px',
  fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)',
}
const settingsTextStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--muted2)',
  fontFamily: 'var(--mono)', lineHeight: 1.7,
}

// ── NavBtn ────────────────────────────────────────────────────

function NavBtn({
  children, active, onClick, title,
}: {
  children: React.ReactNode
  active?:  boolean
  onClick:  () => void
  title?:   string
}) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 30, height: 30, borderRadius: 5,
      background: active ? 'rgba(249,115,22,0.12)' : 'transparent',
      border:     active ? '1px solid rgba(249,115,22,0.25)' : '1px solid transparent',
      color:      active ? 'var(--orange)' : 'var(--muted2)',
      cursor: 'pointer', fontSize: 13, transition: 'all 0.15s',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </button>
  )
}

// ── MarkdownContent ───────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lines = part.slice(3).split('\n')
          const lang  = lines[0]
          const code  = lines.slice(1, -1).join('\n')
          return (
            <div key={i} style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '10px 14px', margin: '8px 0',
              overflow: 'auto',
            }}>
              {lang && (
                <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                  {lang}
                </div>
              )}
              <pre style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                {code}
              </pre>
            </div>
          )
        }
        const formatted = part
          .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text);font-weight:600">$1</strong>')
          .replace(/`(.*?)`/g,       '<code style="background:var(--bg3);border:1px solid var(--border);border-radius:3px;padding:1px 5px;font-family:var(--mono);font-size:12px">$1</code>')
        return <span key={i} dangerouslySetInnerHTML={{ __html: formatted }} />
      })}
    </>
  )
}

// ── ChatMessage ───────────────────────────────────────────────

function ChatMessage({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      marginBottom: 24,
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      animation: 'fadeInUp 0.25s ease-out',
    }}>
      {/* Label */}
      <div style={{
        fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase',
        letterSpacing: '0.1em', marginBottom: 4,
        fontFamily: 'var(--mono)',
        paddingLeft: isUser ? 0 : 4,
        paddingRight: isUser ? 4 : 0,
      }}>
        {isUser ? 'You' : 'Aiden'}
      </div>

      {/* Phase steps */}
      {!isUser && message.phases && message.phases.length > 0 && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 8,
          fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.8,
          maxWidth: '100%', width: '100%',
        }}>
          {message.phases.map((phase, i) => (
            <div key={i}>
              <div style={{ color: phase.status === 'done' ? 'var(--green)' : 'var(--orange)' }}>
                {phase.status === 'done' ? '✓' : '▶'} Phase {phase.index}/{phase.total}: {phase.name}
              </div>
              {phase.steps.map((step, j) => (
                <div key={j} style={{
                  paddingLeft: 16,
                  color: step.status === 'done'    ? 'var(--green)'  :
                         step.status === 'failed'  ? 'var(--red)'    :
                         step.status === 'running' ? 'var(--orange)' : 'var(--muted)',
                }}>
                  {step.status === 'done' ? '✓' : step.status === 'failed' ? '✗' : '·'} {step.tool}
                  {step.duration ? <span style={{ color: 'var(--muted)', marginLeft: 8 }}>({step.duration}s)</span> : ''}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Bubble */}
      <div className="message-bubble" style={{
        position: 'relative', maxWidth: '85%',
        background: isUser ? 'rgba(249,115,22,0.1)' : 'var(--bg2)',
        border: `1px solid ${isUser ? 'rgba(249,115,22,0.22)' : 'var(--border)'}`,
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        padding: '10px 14px',
      }}>
        {/* Thinking dots */}
        {message.isStreaming && !message.content && (
          <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--orange)', display: 'inline-block',
                animation: `thinkingPulse 1.4s ${i * 0.2}s infinite ease-in-out`,
              }} />
            ))}
          </div>
        )}

        {/* Content */}
        {message.content && (
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 13,
            color: isUser ? 'var(--text)' : 'var(--muted3)',
            lineHeight: 1.7, whiteSpace: 'pre-wrap',
          }}>
            <MarkdownContent content={message.content} />
          </div>
        )}

        {/* Copy button */}
        {message.content && !message.isStreaming && (
          <button onClick={copyMessage} className="copy-btn" style={{
            position: 'absolute', top: 8, right: 8,
            background: 'var(--bg3)', border: '1px solid var(--border2)',
            borderRadius: 4, padding: '2px 8px',
            fontFamily: 'var(--mono)', fontSize: 10,
            color: copied ? 'var(--green)' : 'var(--muted)',
            cursor: 'pointer',
          }}>
            {copied ? '✓ copied' : '⎘ copy'}
          </button>
        )}
      </div>

      {/* Provider badge */}
      {!isUser && message.provider && !message.isStreaming && (
        <div style={{
          fontSize: 9, color: 'var(--muted)', marginTop: 4,
          fontFamily: 'var(--mono)', paddingLeft: 4,
        }}>
          via {message.provider}
        </div>
      )}
    </div>
  )
}

// ── SettingsSection ───────────────────────────────────────────

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase',
        letterSpacing: '0.12em', marginBottom: 10, fontFamily: 'var(--mono)',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// ── ApiKeysTab ────────────────────────────────────────────────

function ApiKeysTab() {
  const {
    providers, routing, addingProvider, setAddingProvider,
    newKey, setNewKey, newModel, setNewModel,
    savingKey, saveKey, toggleProvider, deleteProvider, resetLimits,
  } = useDevOS()

  // ── Inline key validation ────────────────────────────────────
  const [keyValidation, setKeyValidation] = useState<Record<string, 'valid' | 'invalid' | 'checking' | null>>({})

  const validateApiKey = async (provider: string, key: string): Promise<boolean> => {
    if (!key.trim()) return false
    try {
      const r = await fetch('http://localhost:4200/api/providers/validate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ provider, key }),
      })
      const data = await r.json() as any
      return data.valid === true
    } catch {
      return false
    }
  }

  return (
    <div>
      {/* Reset limits */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Configured APIs
        </div>
        <button onClick={resetLimits} style={{
          fontSize: 10, padding: '3px 10px', borderRadius: 4,
          background: 'transparent', border: '1px solid var(--border2)',
          color: 'var(--muted2)', fontFamily: 'var(--mono)', cursor: 'pointer',
        }}>
          Reset Rate Limits
        </button>
      </div>

      {/* Existing providers */}
      {providers.map((p: any) => (
        <div key={p.name} style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: p.rateLimited ? 'var(--red)' : p.enabled ? 'var(--green)' : 'var(--muted)',
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
              {p.name}
              {p.rateLimited && <span style={{ color: 'var(--red)', marginLeft: 8, fontSize: 10 }}>rate limited</span>}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>
              {p.provider} · {p.model} · {p.usageCount || 0} calls
            </div>
          </div>
          <button onClick={() => toggleProvider(p.name, !p.enabled)} style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: 'transparent', border: '1px solid var(--border2)',
            color: p.enabled ? 'var(--green)' : 'var(--muted)', fontFamily: 'var(--mono)', cursor: 'pointer',
          }}>
            {p.enabled ? 'on' : 'off'}
          </button>
          <button onClick={() => deleteProvider(p.name)} style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 4,
            background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--red)', fontFamily: 'var(--mono)', cursor: 'pointer',
          }}>
            ✕
          </button>
        </div>
      ))}

      {/* Add new provider */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, fontFamily: 'var(--mono)' }}>
          Add Provider
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {Object.entries(PROVIDER_INFO).map(([id, info]) => (
            <button key={id} onClick={() => setAddingProvider(addingProvider === id ? null : id)} style={{
              padding: '4px 12px', borderRadius: 6,
              background: addingProvider === id ? 'rgba(249,115,22,0.12)' : 'var(--bg2)',
              border: `1px solid ${addingProvider === id ? 'rgba(249,115,22,0.3)' : 'var(--border2)'}`,
              color: addingProvider === id ? 'var(--orange)' : 'var(--muted2)',
              fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer',
            }}>
              {info.label}
            </button>
          ))}
        </div>

        {addingProvider && (
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 14, marginBottom: 8,
          }}>
            <div style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: 'var(--mono)', marginBottom: 10 }}>
              Get free key:{' '}
              <a href={PROVIDER_INFO[addingProvider]?.freeUrl} target="_blank" rel="noopener"
                style={{ color: 'var(--orange)', textDecoration: 'none' }}>
                {PROVIDER_INFO[addingProvider]?.freeUrl}
              </a>
            </div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                placeholder="Paste API key..."
                value={newKey}
                onChange={e => {
                  setNewKey(e.target.value)
                  // Reset status when user edits
                  if (addingProvider) setKeyValidation(prev => ({ ...prev, [addingProvider]: null }))
                }}
                onBlur={async (e) => {
                  const key = e.target.value.trim()
                  if (!key || !addingProvider) return
                  setKeyValidation(prev => ({ ...prev, [addingProvider]: 'checking' }))
                  const valid = await validateApiKey(addingProvider, key)
                  setKeyValidation(prev => ({ ...prev, [addingProvider]: valid ? 'valid' : 'invalid' }))
                }}
                style={{
                  width: '100%', background: 'var(--bg3)',
                  border: `1px solid ${
                    addingProvider && keyValidation[addingProvider] === 'valid'   ? 'rgba(34,197,94,0.5)'  :
                    addingProvider && keyValidation[addingProvider] === 'invalid' ? 'rgba(239,68,68,0.5)'  :
                    'var(--border2)'
                  }`,
                  borderRadius: 6,
                  padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 12,
                  color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
              />
              {/* Inline validation badge */}
              {addingProvider && keyValidation[addingProvider] === 'checking' && (
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--mono)', fontSize: 10, color: '#888' }}>
                  checking...
                </span>
              )}
              {addingProvider && keyValidation[addingProvider] === 'valid' && (
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--mono)', fontSize: 10, color: '#22c55e' }}>
                  ✓ valid
                </span>
              )}
              {addingProvider && keyValidation[addingProvider] === 'invalid' && (
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--mono)', fontSize: 10, color: '#ef4444' }}>
                  ✗ invalid
                </span>
              )}
            </div>
            <select
              value={newModel}
              onChange={e => setNewModel(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg3)',
                border: '1px solid var(--border2)', borderRadius: 6,
                padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 12,
                color: 'var(--text)', outline: 'none', marginBottom: 10,
              }}
            >
              <option value="">Default model</option>
              {PROVIDER_INFO[addingProvider]?.models.map((m: string) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              onClick={() => saveKey(addingProvider)}
              disabled={!newKey.trim() || savingKey}
              style={{
                width: '100%', padding: '8px', borderRadius: 6,
                background: 'var(--orange)', border: 'none',
                color: '#000', fontFamily: 'var(--mono)', fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
                opacity: !newKey.trim() || savingKey ? 0.5 : 1,
              }}
            >
              {savingKey ? 'Saving...' : 'Save API Key'}
            </button>
          </div>
        )}
      </div>

      {/* Routing info */}
      <div style={{ marginTop: 16, padding: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontFamily: 'var(--mono)' }}>
          Routing
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>
          Mode: {routing?.mode || 'auto'} · Ollama fallback: {routing?.fallbackToOllama ? 'on' : 'off'}
        </div>
      </div>
    </div>
  )
}

// ── KnowledgeBaseTab ──────────────────────────────────────────

// Format badge colours: PDF=red, EPUB=purple, TXT=blue, MD=green
const FORMAT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pdf:      { bg: 'rgba(239,68,68,0.15)',   text: '#ef4444', label: 'PDF'  },
  epub:     { bg: 'rgba(168,85,247,0.15)',  text: '#a855f7', label: 'EPUB' },
  txt:      { bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6', label: 'TXT'  },
  md:       { bg: 'rgba(34,197,94,0.15)',   text: '#22c55e', label: 'MD'   },
  markdown: { bg: 'rgba(34,197,94,0.15)',   text: '#22c55e', label: 'MD'   },
}

function KnowledgeBaseTab() {
  const {
    knowledgeFiles, knowledgeStats, uploadingFile,
    uploadCategory, setUploadCategory,
    knowledgeInputRef, handleKnowledgeUpload, handleKnowledgeDelete,
  } = useDevOS()

  return (
    <div>
      <SettingsSection title="Knowledge Base">
        {knowledgeStats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Files',  value: knowledgeStats.files  || 0 },
              { label: 'Chunks', value: knowledgeStats.chunks || 0 },
            ].map(s => (
              <div key={s.label} style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '10px 12px',
              }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, fontFamily: 'var(--mono)' }}>{s.label}</div>
                <div style={{ fontSize: 18, color: 'var(--text)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Upload row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select
            value={uploadCategory}
            onChange={e => setUploadCategory(e.target.value)}
            style={{
              flex: 1, background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 6, padding: '8px 10px', fontFamily: 'var(--mono)',
              fontSize: 12, color: 'var(--muted2)', outline: 'none',
            }}
          >
            {['general', 'work', 'personal', 'research', 'code'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={() => knowledgeInputRef.current?.click()}
            disabled={uploadingFile}
            style={{
              padding: '8px 16px', borderRadius: 6,
              background: 'var(--orange)', border: 'none',
              color: '#000', fontFamily: 'var(--mono)', fontSize: 12,
              fontWeight: 600, cursor: 'pointer',
              opacity: uploadingFile ? 0.5 : 1,
            }}
          >
            {uploadingFile ? 'Processing…' : '+ Upload File'}
          </button>
          <input
            ref={knowledgeInputRef}
            type="file" accept=".txt,.md,.pdf,.epub,.markdown"
            style={{ display: 'none' }}
            onChange={handleKnowledgeUpload}
          />
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: 12 }}>
          Supports PDF, EPUB, TXT, MD · max 50 MB · processed locally
        </div>

        {/* File list */}
        {knowledgeFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11 }}>
            No files in knowledge base yet
          </div>
        ) : (
          knowledgeFiles.map((f: any) => {
            const fmt      = FORMAT_COLORS[f.format] || FORMAT_COLORS['txt']
            const sizePart = f.fileSizeMB  ? `${f.fileSizeMB} MB` : null
            const wordPart = f.wordCount   ? `${f.wordCount.toLocaleString()} words` : null
            const pagePart = f.pageCount   ? `${f.pageCount} pp` : null
            const meta     = [f.category, f.chunkCount + ' chunks', wordPart, pagePart, sizePart].filter(Boolean).join(' · ')

            return (
              <div key={f.id} style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 12px', marginBottom: 6,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                {/* Format badge */}
                <div style={{
                  background: fmt.bg, color: fmt.text,
                  borderRadius: 4, padding: '2px 6px',
                  fontFamily: 'var(--mono)', fontSize: 9,
                  fontWeight: 700, letterSpacing: '0.05em', flexShrink: 0,
                }}>
                  {fmt.label}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.originalName || f.filename}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                    {meta}
                  </div>
                </div>
                <button onClick={() => handleKnowledgeDelete(f.id)} style={{
                  background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 4, padding: '2px 8px',
                  color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: 10, cursor: 'pointer',
                }}>
                  ✕
                </button>
              </div>
            )
          })
        )}
      </SettingsSection>
    </div>
  )
}

// ── NavBar ────────────────────────────────────────────────────

function NavBar() {
  const {
    isExecuting, uiMode, setUIMode,
    historyOpen, setHistoryOpen,
    liveViewOpen, setLiveViewOpen,
    setSettingsOpen, setSettingsTab,
    licenseStatus, setPricingOpen,
  } = useDevOS()

  return (
    <nav style={{
      height: 48, display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 16px',
      background: 'rgba(14,14,14,0.95)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 100,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 5,
          background: 'var(--orange)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, color: '#000', flexShrink: 0,
          animation: isExecuting ? 'pulse-orange 1s infinite' : 'none',
        }}>◉</div>
        <span style={{ fontSize: 13, color: 'var(--text)', letterSpacing: '0.05em', fontFamily: 'var(--mono)' }}>
          DEVOS
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>·</span>
        <span style={{ fontSize: 13, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>AIDEN</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isExecuting ? 'var(--orange)' : 'var(--green)',
            display: 'inline-block', animation: 'pulse-dot 2s infinite',
          }} />
          <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
            v2 · local
          </span>
        </div>
      </div>

      {/* Mode indicator */}
      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {uiMode === 'focus'     && 'Focus Mode'}
        {uiMode === 'execution' && <span style={{ color: 'var(--orange)' }}>● Executing...</span>}
        {uiMode === 'power'     && 'Power Mode'}
        {uiMode === 'watch'     && 'Watch Mode'}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <NavBtn active={historyOpen || uiMode === 'power'} onClick={() => setHistoryOpen(h => !h)} title="History">☰</NavBtn>
        <NavBtn active={liveViewOpen || uiMode === 'execution' || uiMode === 'power'} onClick={() => setLiveViewOpen(l => !l)} title="Live View">⌄</NavBtn>
        <NavBtn active={uiMode === 'power'} onClick={() => setUIMode(m => m === 'power' ? 'focus' : 'power')} title="Power Mode (Ctrl+P)">⊞</NavBtn>
        <NavBtn active={uiMode === 'watch'} onClick={() => setUIMode(m => m === 'watch' ? 'focus' : 'watch')} title="Watch Mode">⤢</NavBtn>
        <div style={{ width: 1, height: 20, background: 'var(--border2)', margin: '0 4px' }} />
        <NavBtn onClick={() => setSettingsOpen(true)} title="Settings">⚙</NavBtn>
        <div
          style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 10,
            background: licenseStatus.active ? 'rgba(139,92,246,0.15)' : 'var(--odim)',
            border: `1px solid ${licenseStatus.active ? 'rgba(139,92,246,0.4)' : 'rgba(249,115,22,0.25)'}`,
            color: licenseStatus.active ? '#a78bfa' : 'var(--orange)',
            fontFamily: 'var(--mono)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          onClick={() => licenseStatus.active
            ? (() => { setSettingsOpen(true); setSettingsTab('pro') })()
            : setPricingOpen(true)
          }
          title={licenseStatus.active ? `Pro · ${licenseStatus.email}` : 'Upgrade to Pro'}
        >
          {licenseStatus.active ? '★ PRO' : 'PRO'}
        </div>
      </div>
    </nav>
  )
}

// ── HistorySidebar ────────────────────────────────────────────

function HistorySidebar() {
  const { conversations, currentConvId, startNewChat, loadConversation } = useDevOS()

  const grouped = useMemo(() => {
    const now       = Date.now()
    const today     = conversations.filter(c => now - c.timestamp < 86400000)
    const yesterday = conversations.filter(c => now - c.timestamp >= 86400000 && now - c.timestamp < 172800000)
    const earlier   = conversations.filter(c => now - c.timestamp >= 172800000)
    return { today, yesterday, earlier }
  }, [conversations])

  return (
    <aside style={{
      overflow: 'hidden', borderRight: '1px solid var(--border)',
      background: 'var(--bg1)', display: 'flex', flexDirection: 'column',
    }}>
      <button onClick={startNewChat} style={{
        margin: 12, padding: '8px 14px', borderRadius: 6,
        background: 'transparent', border: '1px solid var(--border2)',
        color: 'var(--muted2)', fontFamily: 'var(--mono)', fontSize: 12,
        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        + New Chat
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>⌘K</span>
      </button>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {(Object.entries(grouped) as [string, Conversation[]][]).map(([group, convs]) => convs.length > 0 && (
          <div key={group}>
            <div style={{
              padding: '8px 8px 4px', fontSize: 9,
              color: 'var(--muted)', textTransform: 'uppercase',
              letterSpacing: '0.1em', fontFamily: 'var(--mono)',
            }}>
              {group === 'today' ? 'Today' : group === 'yesterday' ? 'Yesterday' : 'Earlier'}
            </div>
            {convs.map(conv => (
              <button key={conv.id} onClick={() => loadConversation(conv.id)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px', borderRadius: 5, marginBottom: 2,
                background: currentConvId === conv.id ? 'var(--bg2)' : 'transparent',
                border: 'none',
                borderLeft: `2px solid ${currentConvId === conv.id ? 'var(--orange)' : 'transparent'}`,
                color: currentConvId === conv.id ? 'var(--text)' : 'var(--muted2)',
                fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer',
                transition: 'all 0.15s', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {conv.title.slice(0, 32)}{conv.title.length > 32 ? '...' : ''}
              </button>
            ))}
          </div>
        ))}
        {conversations.length === 0 && (
          <div style={{ padding: 16, fontSize: 11, color: 'var(--muted)', textAlign: 'center', fontFamily: 'var(--mono)' }}>
            No conversations yet
          </div>
        )}
      </div>

      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--border)',
        fontSize: 10, color: 'var(--muted)',
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: 'var(--mono)',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
        Aiden v2 · local
      </div>
    </aside>
  )
}

// ── EmptyState ────────────────────────────────────────────────

function EmptyState() {
  const { setInput } = useDevOS()
  const suggestions = [
    'Research top AI agents 2025',
    'What is the weather in Mumbai',
    'Check NSE top gainers today',
    'Create a Python script for me',
  ]
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 40, gap: 24,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 10,
        background: 'var(--orange)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 800, color: '#000',
        fontFamily: 'var(--sans)',
      }}>D/</div>
      <div style={{ fontSize: 18, fontFamily: 'var(--sans)', fontWeight: 600, color: 'var(--text)' }}>
        What can I help you with?
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 480 }}>
        {suggestions.map(s => (
          <button key={s} onClick={() => setInput(s)} style={{
            padding: '6px 14px', borderRadius: 20,
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            color: 'var(--muted2)', fontFamily: 'var(--mono)', fontSize: 11,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>{s} →</button>
        ))}
      </div>
    </div>
  )
}

// ── PlusMenu ──────────────────────────────────────────────────

function PlusMenu() {
  const {
    plusMenuOpen, setPlusMenuOpen,
    activeSubmenu, setActiveSubmenu,
    channelStatuses, miniPrompt, setMiniPrompt,
    miniPromptValue, setMiniPromptValue, submitMiniPrompt,
    kbInputRef, takeScreenshot, setChannelModal,
  } = useDevOS()

  if (!plusMenuOpen) return null

  const CHANNEL_IDS = ['telegram', 'whatsapp', 'discord', 'slack', 'email']

  const PLUS_MENU: MenuItem[] = [
    {
      id: 'upload',
      icon: '📎',
      label: 'Upload to Knowledge Base',
      action: () => { kbInputRef.current?.click(); setPlusMenuOpen(false) },
    },
    {
      id: 'screenshot',
      icon: '🖼️',
      label: 'Take Screenshot',
      action: () => { takeScreenshot(); setPlusMenuOpen(false) },
    },
    {
      id: 'research',
      icon: '🔍',
      label: 'Research',
      children: [
        { id: 'websearch',    icon: '🌐', label: 'Web Search',    action: () => { setMiniPrompt({ type: 'websearch',  placeholder: 'Search for...' }) } },
        { id: 'deepresearch', icon: '🔬', label: 'Deep Research', action: () => { setMiniPrompt({ type: 'research',   placeholder: 'Research topic...' }) } },
        { id: 'stocks',       icon: '📊', label: 'Stock Data',    action: () => { setMiniPrompt({ type: 'stocks',     placeholder: 'e.g. NSE top gainers...' }) } },
      ],
    },
    {
      id: 'connect',
      icon: '📡',
      label: 'Connect',
      children: [
        { id: 'telegram',  icon: '💬', label: 'Telegram',  action: () => setChannelModal('telegram') },
        { id: 'whatsapp',  icon: '📱', label: 'WhatsApp',  action: () => setChannelModal('whatsapp') },
        { id: 'discord',   icon: '🎮', label: 'Discord',   action: () => setChannelModal('discord') },
        { id: 'slack',     icon: '💼', label: 'Slack',     action: () => setChannelModal('slack') },
        { id: 'email',     icon: '📧', label: 'Email',     action: () => setChannelModal('email') },
      ],
    },
    {
      id: 'skills',
      icon: '⚡',
      label: 'Skills',
      children: [
        { id: 'memory',       icon: '🧠', label: 'View Memory',   action: () => setChannelModal('memory') },
        { id: 'skillsbrowse', icon: '📚', label: 'Browse Skills', action: () => setChannelModal('skills') },
        { id: 'mcp',          icon: '🔌', label: 'MCP Plugins',   action: () => setChannelModal('mcp') },
      ],
    },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => { setPlusMenuOpen(false); setActiveSubmenu(null); setMiniPrompt(null) }}
        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
      />

      {/* Main menu */}
      <div style={{
        position: 'absolute', bottom: 52, left: 0,
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 10, padding: '6px 0', minWidth: 220,
        zIndex: 91, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        animation: 'slideUpFade 0.15s ease-out',
      }}>
        {PLUS_MENU.map((item) => (
          <div key={item.id} style={{ position: 'relative' }}>
            {/* Divider before Research */}
            {item.id === 'research' && (
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            )}

            {/* Menu row */}
            <button
              onMouseEnter={() => setActiveSubmenu('children' in item && item.children ? item.id : null)}
              onClick={() => {
                if ('action' in item && item.action) {
                  item.action()
                } else {
                  setActiveSubmenu(activeSubmenu === item.id ? null : item.id)
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '8px 14px',
                background: activeSubmenu === item.id ? 'var(--bg3)' : 'transparent',
                border: 'none', color: 'var(--muted2)',
                fontFamily: 'var(--mono)', fontSize: 12,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.1s',
              }}
            >
              <span style={{ fontSize: 14, minWidth: 20 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {'children' in item && item.children && (
                <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>›</span>
              )}
            </button>

            {/* Submenu */}
            {'children' in item && item.children && activeSubmenu === item.id && (
              <div style={{
                position: 'absolute', left: '100%', top: 0,
                marginLeft: 4, background: 'var(--bg2)',
                border: '1px solid var(--border2)', borderRadius: 10,
                padding: '6px 0', minWidth: 200, zIndex: 92,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                animation: 'slideUpFade 0.12s ease-out',
              }}>
                {item.children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => {
                      child.action()
                      if (!['websearch', 'deepresearch', 'stocks'].includes(child.id)) {
                        setPlusMenuOpen(false)
                        setActiveSubmenu(null)
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '8px 14px',
                      background: 'transparent', border: 'none',
                      color: 'var(--muted2)', fontFamily: 'var(--mono)',
                      fontSize: 12, cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: 14, minWidth: 20 }}>{child.icon}</span>
                    <span style={{ flex: 1 }}>{child.label}</span>
                    {CHANNEL_IDS.includes(child.id) && (
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: channelStatuses[child.id] ? 'var(--green)' : 'var(--muted)',
                      }} />
                    )}
                  </button>
                ))}

                {/* Inline mini-prompt for Research submenu */}
                {item.id === 'research' && miniPrompt && (
                  <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
                    <input
                      autoFocus
                      value={miniPromptValue}
                      onChange={e => setMiniPromptValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { submitMiniPrompt() }
                        if (e.key === 'Escape') { setMiniPrompt(null); setMiniPromptValue('') }
                      }}
                      placeholder={miniPrompt.placeholder}
                      style={{
                        width: '100%', background: 'var(--bg)',
                        border: '1px solid var(--border2)', borderRadius: 5,
                        padding: '7px 10px', fontFamily: 'var(--mono)',
                        fontSize: 12, color: 'var(--text)', outline: 'none',
                      }}
                    />
                    <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                      Enter to run · Esc to cancel
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ── ChatPanel ─────────────────────────────────────────────────

function ChatPanel() {
  const {
    messages, input, setInput, isStreaming, execMode, setExecMode,
    sendMessage, handleQuickUpload,
    inputRef, kbInputRef, messagesEndRef,
    plusMenuOpen, setPlusMenuOpen,
    voiceStatus, isRecording, ttsEnabled, setTtsEnabled, recordingTimer, startRecording,
  } = useDevOS()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, messagesEndRef])

  useEffect(() => {
    inputRef.current?.focus()
  }, [inputRef])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <section style={{
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: 'var(--bg)', minWidth: 0,
    }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '0 24px' }}>
            {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '12px 24px',
        background: 'var(--bg1)', flexShrink: 0,
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'flex-end', position: 'relative' }}>
          {/* Plus menu trigger */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <PlusMenu />
            <button
              onClick={() => setPlusMenuOpen(!plusMenuOpen)}
              title="Actions"
              style={{
                width: 36, height: 36, borderRadius: 6,
                background: plusMenuOpen ? 'rgba(249,115,22,0.12)' : 'var(--bg2)',
                border: plusMenuOpen ? '1px solid rgba(249,115,22,0.35)' : '1px solid var(--border2)',
                color: plusMenuOpen ? 'var(--orange)' : 'var(--muted2)',
                cursor: 'pointer', fontSize: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >+</button>
          </div>
          <input
            ref={kbInputRef} type="file" accept=".txt,.md,.pdf,.epub,.markdown"
            style={{ display: 'none' }} onChange={handleQuickUpload}
          />

          {/* Textarea */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Ask Aiden anything..."
            rows={1}
            disabled={isStreaming}
            style={{
              flex: 1, resize: 'none',
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 8, padding: '9px 14px',
              fontFamily: 'var(--mono)', fontSize: 13,
              color: 'var(--text)', outline: 'none',
              minHeight: 38, maxHeight: 120,
              transition: 'border-color 0.2s', lineHeight: 1.6,
            }}
          />

          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            {(['auto', 'plan', 'chat'] as ExecMode[]).map(m => (
              <button key={m} onClick={() => setExecMode(m)} title={m} style={{
                width: 28, height: 28, borderRadius: 5, border: 'none',
                background: execMode === m ? 'rgba(249,115,22,0.15)' : 'transparent',
                color: execMode === m ? 'var(--orange)' : 'var(--muted)',
                cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
              }}>
                {m === 'auto' ? '⚡' : m === 'plan' ? '📋' : '💬'}
              </button>
            ))}
          </div>

          {/* Voice input button — shown only when STT available */}
          {voiceStatus.stt && (
            <button
              onClick={startRecording}
              disabled={isStreaming}
              title={isRecording ? `Recording... ${recordingTimer}s` : 'Voice input (5s)'}
              style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: isRecording ? 'rgba(239,68,68,0.15)' : 'var(--bg2)',
                border: `1px solid ${isRecording ? 'rgba(239,68,68,0.4)' : 'var(--border2)'}`,
                color: isRecording ? '#ef4444' : 'var(--muted2)',
                cursor: isStreaming ? 'not-allowed' : 'pointer',
                fontSize: isRecording ? 13 : 14,
                fontFamily: isRecording ? 'var(--mono)' : 'inherit',
                transition: 'all 0.2s',
                animation: isRecording ? 'pulse-dot 0.8s infinite' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {isRecording ? `${recordingTimer}` : '🎤'}
            </button>
          )}

          {/* TTS toggle button — shown only when TTS available */}
          {voiceStatus.tts && (
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              title={ttsEnabled ? 'Disable voice responses' : 'Enable voice responses (Aiden speaks)'}
              style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: ttsEnabled ? 'rgba(249,115,22,0.15)' : 'var(--bg2)',
                border: `1px solid ${ttsEnabled ? 'rgba(249,115,22,0.4)' : 'var(--border2)'}`,
                color: ttsEnabled ? 'var(--orange)' : 'var(--muted2)',
                cursor: 'pointer', fontSize: 14, transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >🔊</button>
          )}

          {/* Send */}
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isStreaming}
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: input.trim() && !isStreaming ? 'var(--orange)' : 'var(--bg3)',
              border: 'none',
              color: input.trim() && !isStreaming ? '#000' : 'var(--muted)',
              cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
              fontSize: 14, transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >▶</button>
        </div>
      </div>
    </section>
  )
}

// ── LiveViewPanel ─────────────────────────────────────────────

interface PulseEntry {
  type: string
  agent: string
  message: string
  timestamp: number
  tool?: string
}

function LiveViewPanel() {
  const { isExecuting, uiMode, setUIMode, systemStats, setActivityLogs, activityLogs } = useDevOS()
  const [pulseLog, setPulseLog] = useState<PulseEntry[]>([])
  const bottomRef               = useRef<HTMLDivElement>(null)

  // WebSocket connection to LivePulse bridge
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:4200')
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'pulse' && data.event) {
          const { type, agent, message, tool } = data.event as PulseEntry
          const icon = type === 'done' ? '✅' : type === 'error' ? '❌' : type === 'tool' ? '🔧' : type === 'thinking' ? '💭' : '⚡'
          const now  = new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
          setActivityLogs(prev => [...prev.slice(-99), {
            time: now, icon, agent: agent || 'Aiden',
            message: tool ? `${tool}: ${message}` : message,
            style: (type === 'done' ? 'ok' : type === 'error' ? 'err' : type === 'tool' || type === 'act' ? 'active' : 'default') as ActivityLog['style'],
          }])
          setPulseLog(prev => [...prev.slice(-199), data.event as PulseEntry])
        }
      } catch {}
    }
    ws.onerror = () => {}
    return () => { try { ws.close() } catch {} }
  }, [setActivityLogs])

  // Auto-scroll to bottom on new events
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [pulseLog])

  return (
    <aside style={{
      overflow: 'hidden', borderLeft: '1px solid var(--border)',
      background: 'var(--bg1)', display: 'flex', flexDirection: 'column',
      minWidth: 420,
    }}>
      {/* Header */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 14px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: isExecuting ? 'var(--orange)' : 'var(--green)',
            animation: isExecuting ? 'pulse-dot 1s infinite' : 'none',
          }} />
          Live Activity
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {pulseLog.length > 0 && (
            <button
              onClick={() => setPulseLog([])}
              title="Clear feed"
              style={{
                height: 28, padding: '0 8px', borderRadius: 5,
                background: 'transparent', border: '1px solid transparent',
                color: 'var(--muted)', cursor: 'pointer', fontSize: 10,
                fontFamily: 'var(--mono)', transition: 'all 0.15s',
              }}
            >clear</button>
          )}
          <NavBtn onClick={() => setUIMode((m: UIMode) => m === 'watch' ? 'focus' : 'watch')} title="Watch Mode">
            {uiMode === 'watch' ? '✕' : '⤢'}
          </NavBtn>
        </div>
      </div>

      {/* Activity Feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {pulseLog.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', flex: 1, gap: 10,
            color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11,
          }}>
            <div style={{ fontSize: 28, opacity: 0.3 }}>⚡</div>
            <div>Waiting for activity...</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', opacity: 0.7 }}>Events will appear here as Aiden works</div>
          </div>
        ) : (
          pulseLog.map((entry, i) => {
            const typeColor =
              entry.type === 'error'   ? 'var(--red)' :
              entry.type === 'done'    ? 'var(--green)' :
              entry.type === 'warn'    ? 'var(--orange)' :
              entry.type === 'tool'    ? '#60a5fa' :
              entry.type === 'thinking'? '#a78bfa' :
              'var(--muted2)'
            const typeIcon =
              entry.type === 'error'   ? '✗' :
              entry.type === 'done'    ? '✓' :
              entry.type === 'warn'    ? '⚠' :
              entry.type === 'tool'    ? '⬡' :
              entry.type === 'thinking'? '💭' :
              entry.type === 'act'     ? '▸' :
              '·'
            const isNew = i === pulseLog.length - 1
            return (
              <div key={i} style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                fontSize: 11, fontFamily: 'var(--mono)',
                padding: '4px 8px', borderRadius: 5,
                background: isNew ? 'rgba(249,115,22,0.06)' : 'transparent',
                transition: 'background 0.4s',
              }}>
                <span style={{ color: typeColor, flexShrink: 0, fontSize: 12, lineHeight: '16px' }}>{typeIcon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--muted2)', wordBreak: 'break-word', lineHeight: 1.5 }}>
                    {entry.tool && (
                      <span style={{ color: '#60a5fa', marginRight: 4 }}>[{entry.tool}]</span>
                    )}
                    {entry.message}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>
                    {entry.agent} · {new Date(entry.timestamp).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer stats */}
      <div style={{
        borderTop: '1px solid var(--border)', padding: '8px 14px',
        display: 'flex', gap: 16, flexShrink: 0,
      }}>
        {[
          { label: 'status', value: 'online',  color: 'var(--green)' },
          { label: 'mode',   value: 'local',   color: 'var(--muted2)' },
          { label: 'events', value: `${activityLogs.length}`, color: 'var(--muted2)' },
          { label: 'memory', value: `${systemStats?.recentHistory?.length ?? 0}`, color: 'var(--muted2)' },
        ].map(stat => (
          <div key={stat.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={{ fontSize: 8, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--mono)' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 11, color: stat.color, fontFamily: 'var(--mono)', fontWeight: 500 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

// ── ActivityBar ───────────────────────────────────────────────

function ActivityBar() {
  const { activityOpen, setActivityOpen, activityLogs, logsEndRef } = useDevOS()

  useEffect(() => {
    if (activityOpen) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activityLogs, activityOpen, logsEndRef])

  return (
    <div style={{
      height: activityOpen ? 140 : 32, flexShrink: 0,
      borderTop: '1px solid var(--border)',
      background: 'rgba(0,0,0,0.4)',
      transition: 'height 0.2s ease-out',
      display: 'flex', flexDirection: 'column',
    }}>
      <div
        onClick={() => setActivityOpen(a => !a)}
        style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 14px', cursor: 'pointer', flexShrink: 0, gap: 8 }}
      >
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
          {activityOpen ? '⌃' : '⌄'} Activity
        </span>
        {activityLogs.length > 0 && (
          <span style={{ fontSize: 9, color: 'var(--muted)', background: 'var(--bg3)', borderRadius: 10, padding: '1px 6px', fontFamily: 'var(--mono)' }}>
            {activityLogs.length}
          </span>
        )}
        {!activityOpen && activityLogs.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {activityLogs[activityLogs.length - 1].message.slice(0, 80)}
          </span>
        )}
      </div>

      {activityOpen && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 8px' }}>
          {activityLogs.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 10, padding: '6px 0', fontStyle: 'italic' }}>
              No activity yet — send a message to get started
            </div>
          ) : activityLogs.slice(-100).map((log, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '2px 0', fontFamily: 'var(--mono)', fontSize: 11 }}>
              <span style={{ color: 'var(--muted)', flexShrink: 0, fontSize: 9, paddingTop: 1 }}>{log.time}</span>
              <span style={{ flexShrink: 0 }}>{log.icon}</span>
              <span style={{ color: 'var(--muted2)', flexShrink: 0 }}>[{log.agent}]</span>
              <span style={{
                color: log.style === 'ok'     ? 'var(--green)'  :
                       log.style === 'err'    ? 'var(--red)'    :
                       log.style === 'active' ? 'var(--orange)' : 'var(--muted2)',
              }}>{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  )
}

// ── MemoryView ────────────────────────────────────────────────

function MemoryView() {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    fetch('http://localhost:4200/api/memory').then(r => r.json()).then(setData).catch(() => {})
  }, [])
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted2)' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Recent Facts</div>
        {data?.recentHistory?.slice(0, 5).map((item: any, i: number) => (
          <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid var(--border)', color: 'var(--muted2)', fontSize: 11, lineHeight: 1.5 }}>
            {typeof item === 'string' ? item.slice(0, 120) : JSON.stringify(item).slice(0, 120)}
          </div>
        )) || <div style={{ color: 'var(--muted)' }}>No memory yet</div>}
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Stats</div>
        <div>Semantic items: {data?.semanticItems || 0}</div>
        <div>Sessions: {data?.sessions || 1}</div>
      </div>
      <button onClick={() => {
        if (window.confirm('Clear all memory? Cannot be undone.')) {
          fetch('http://localhost:4200/api/memory', { method: 'DELETE' }).catch(() => {})
          setData(null)
        }
      }} style={{
        marginTop: 16, width: '100%', padding: '8px',
        background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 6, color: 'var(--red)', fontFamily: 'var(--mono)',
        fontSize: 11, cursor: 'pointer',
      }}>Clear All Memory</button>
    </div>
  )
}

// ── SkillsView ────────────────────────────────────────────────

function SkillsView() {
  const [skills, setSkills] = useState<any[]>([])
  useEffect(() => {
    fetch('http://localhost:4200/api/skills').then(r => r.json()).then(d => setSkills(d.skills || [])).catch(() => {})
  }, [])
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
      {skills.length === 0 && (
        <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>No skills loaded yet</div>
      )}
      {skills.map((skill: any, i: number) => (
        <div key={i} style={{ padding: '10px 12px', marginBottom: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }}>
          <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 3 }}>{skill.name}</div>
          <div style={{ color: 'var(--muted2)', fontSize: 11, lineHeight: 1.5 }}>{skill.description}</div>
          {skill.confidence !== undefined && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2 }}>
                <div style={{ width: `${skill.confidence * 100}%`, height: '100%', background: 'var(--orange)', borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{Math.round(skill.confidence * 100)}%</span>
            </div>
          )}
        </div>
      ))}
      <button
        onClick={() => fetch('http://localhost:4200/api/skills/refresh', { method: 'POST' }).then(() => window.location.reload()).catch(() => {})}
        style={{
          width: '100%', padding: '8px', marginTop: 8,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 6, color: 'var(--muted2)', fontFamily: 'var(--mono)',
          fontSize: 11, cursor: 'pointer',
        }}>⟲ Refresh Skills</button>
    </div>
  )
}

// ── MCPView ───────────────────────────────────────────────────

function MCPView() {
  const [url, setUrl] = useState('')
  const [plugins, setPlugins] = useState<any[]>([])
  useEffect(() => {
    fetch('http://localhost:4200/api/mcp/list').then(r => r.json()).then(d => setPlugins(d.plugins || [])).catch(() => {})
  }, [])
  const connect = async () => {
    if (!url.trim()) return
    try {
      await fetch('http://localhost:4200/api/mcp/connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      setUrl('')
      fetch('http://localhost:4200/api/mcp/list').then(r => r.json()).then(d => setPlugins(d.plugins || [])).catch(() => {})
    } catch {}
  }
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Add Plugin</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && connect()}
            placeholder="Plugin URL or npm package..."
            style={{
              flex: 1, background: 'var(--bg)', border: '1px solid var(--border2)',
              borderRadius: 5, padding: '7px 10px', fontFamily: 'var(--mono)',
              fontSize: 11, color: 'var(--text)', outline: 'none',
            }} />
          <button onClick={connect} style={{
            padding: '7px 14px', background: 'var(--orange)', border: 'none',
            borderRadius: 5, color: '#000', fontFamily: 'var(--mono)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>Add</button>
        </div>
      </div>
      {plugins.length === 0
        ? <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>No plugins connected</div>
        : plugins.map((p: any, i: number) => (
          <div key={i} style={{
            padding: '8px 12px', marginBottom: 6,
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--muted2)' }}>{p.name || p.url}</span>
          </div>
        ))
      }
    </div>
  )
}

// ── ChannelModal ──────────────────────────────────────────────

const CHANNEL_IDS_LIST = ['telegram', 'whatsapp', 'discord', 'slack', 'email']

const CHANNEL_CONFIG: Record<string, any> = {
  telegram: {
    title: '💬 Telegram',
    fields: [{ id: 'token', label: 'Bot Token', placeholder: 'Your Telegram bot token...', type: 'password' }],
    help: 'Create a bot via @BotFather on Telegram. Copy the token and paste it here.',
  },
  whatsapp: { title: '📱 WhatsApp', fields: [], help: '' },
  discord: {
    title: '🎮 Discord',
    fields: [
      { id: 'token', label: 'Bot Token', placeholder: 'Discord bot token...', type: 'password' },
      { id: 'channel', label: 'Channel ID', placeholder: 'Channel ID...', type: 'text' },
    ],
    help: 'Create a bot at discord.com/developers. Enable MESSAGE_CONTENT intent.',
  },
  slack: {
    title: '💼 Slack',
    fields: [{ id: 'token', label: 'Bot Token', placeholder: 'xoxb-...', type: 'password' }],
    help: 'Create a Slack app at api.slack.com. Add the bot token (xoxb-...) here.',
  },
  email: {
    title: '📧 Email',
    fields: [
      { id: 'token', label: 'SMTP Password / App Password', placeholder: 'App password...', type: 'password' },
      { id: 'channel', label: 'Email Address', placeholder: 'your@email.com', type: 'text' },
    ],
    help: 'Use a Gmail App Password (2FA required). DevOS sends and receives email on your behalf.',
  },
  memory: { title: '🧠 Memory', renderContent: () => <MemoryView />, fields: [], help: '' },
  skills: { title: '📚 Skills', renderContent: () => <SkillsView />, fields: [], help: '' },
  mcp:    { title: '🔌 MCP Plugins', renderContent: () => <MCPView />, fields: [], help: '' },
}

function ChannelModal() {
  const { channelModal, setChannelModal, channelStatuses, setSettingsOpen, setSettingsTab } = useDevOS()
  const [token, setToken]   = useState('')
  const [extra, setExtra]   = useState('')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => { setToken(''); setExtra(''); setSaving(false); setSaved(false) }, [channelModal])

  if (!channelModal) return null
  const config = CHANNEL_CONFIG[channelModal]
  if (!config) return null

  const saveChannel = async () => {
    setSaving(true)
    try {
      await fetch('http://localhost:4200/api/channels/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: channelModal, token, extra }),
      })
      setSaved(true)
      setTimeout(() => { setChannelModal(null); setSaved(false) }, 1400)
    } catch {
      setSaving(false)
    }
  }

  const isChannel = CHANNEL_IDS_LIST.includes(channelModal)

  return (
    <>
      <div onClick={() => setChannelModal(null)} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 300, backdropFilter: 'blur(4px)',
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 12, padding: 24, width: 380,
        maxHeight: '80vh', overflowY: 'auto',
        zIndex: 301, animation: 'fadeInUp 0.2s ease-out',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
            {config.title}
          </span>
          <button onClick={() => setChannelModal(null)} style={{
            background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18,
          }}>✕</button>
        </div>

        {/* Custom render content (memory, skills, mcp) */}
        {'renderContent' in config && config.renderContent
          ? config.renderContent()
          : (
            <>
              {/* Status badge for channels */}
              {isChannel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontFamily: 'var(--mono)', fontSize: 11 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: channelStatuses[channelModal] ? 'var(--green)' : 'var(--muted)' }} />
                  <span style={{ color: 'var(--muted)' }}>{channelStatuses[channelModal] ? 'Connected' : 'Not connected'}</span>
                </div>
              )}

              {/* WhatsApp QR special case */}
              {channelModal === 'whatsapp' ? (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted2)', lineHeight: 1.8 }}>
                    WhatsApp connects via QR code.<br />
                    Open your DevOS terminal and<br />
                    scan the QR code that appears.
                  </div>
                  <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                    {channelStatuses['whatsapp'] ? '● Connected' : '○ Scan QR to connect'}
                  </div>
                </div>
              ) : (
                <>
                  {/* Input fields */}
                  {config.fields?.map((field: any, i: number) => (
                    <div key={field.id} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {field.label}
                      </div>
                      <input
                        type={field.type || 'text'}
                        placeholder={field.placeholder}
                        onChange={e => i === 0 ? setToken(e.target.value) : setExtra(e.target.value)}
                        style={{
                          width: '100%', background: 'var(--bg)',
                          border: '1px solid var(--border2)', borderRadius: 6,
                          padding: '8px 12px', fontFamily: 'var(--mono)',
                          fontSize: 12, color: 'var(--text)', outline: 'none',
                        }}
                      />
                    </div>
                  ))}

                  {/* Help text */}
                  {config.help && (
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)', lineHeight: 1.6, marginBottom: 16, padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
                      {config.help}
                    </div>
                  )}

                  {/* Save button */}
                  {config.fields?.length > 0 && (
                    <button onClick={saveChannel} disabled={saving || saved} style={{
                      width: '100%', padding: '10px',
                      background: saved ? 'rgba(34,197,94,0.15)' : 'var(--orange)',
                      border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none',
                      borderRadius: 6, color: saved ? 'var(--green)' : '#000',
                      fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}>
                      {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save & Connect'}
                    </button>
                  )}
                </>
              )}

              {/* View Setup Guide link */}
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button onClick={() => { setChannelModal(null); setSettingsTab('setup'); setSettingsOpen(true) }} style={{
                  background: 'none', border: 'none', color: 'var(--muted)',
                  fontFamily: 'var(--mono)', fontSize: 10, cursor: 'pointer',
                  textDecoration: 'underline',
                }}>View Setup Guide →</button>
              </div>
            </>
          )
        }
      </div>
    </>
  )
}

// ── DisclaimerBar ─────────────────────────────────────────────

function DisclaimerBar() {
  return (
    <div style={{
      height: 24, display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 8, flexShrink: 0,
      background: 'var(--bg1)', borderTop: '1px solid var(--border)',
      fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)',
    }}>
      <span>Aiden is an AI and can make mistakes. Always verify important responses.</span>
      <span style={{ color: 'var(--border2)' }}>·</span>
      <span>
        Built by{' '}
        <a href="https://taracod.com" target="_blank" rel="noopener" style={{ color: 'var(--muted2)', textDecoration: 'none' }}>
          Shiva Deore
        </a>
        {' '}at Taracod · White Lotus · © 2026
      </span>
    </div>
  )
}

// ── SettingsDrawer ────────────────────────────────────────────

const SETTINGS_TABS = [
  { id: 'api',      label: '🔑 API Keys'    },
  { id: 'model',    label: '🧠 Model'        },
  { id: 'knowledge',label: '📚 Knowledge'   },
  { id: 'channels', label: '💬 Channels'    },
  { id: 'pro',      label: '🔐 Pro License' },
  { id: 'guide',    label: '📖 User Guide'  },
  { id: 'setup',    label: '🔧 Setup'        },
  { id: 'privacy',  label: '📜 Privacy'     },
  { id: 'legal',    label: '⚖️ Legal'        },
  { id: 'about',    label: 'ℹ️ About'        },
  { id: 'danger',   label: '⚠️ Danger Zone' },
]

function SettingsDrawer() {
  const {
    settingsTab, setSettingsTab, setSettingsOpen, setConversations,
    licenseStatus, licenseKey, setLicenseKey, activatingKey, licenseMsg, setLicenseMsg,
    validateKey, clearProLicense, setPricingOpen,
  } = useDevOS()

  return (
    <>
      <div onClick={() => setSettingsOpen(false)} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 200, backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: 'var(--bg1)', borderLeft: '1px solid var(--border)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        animation: 'slideIn 0.25s ease-out',
      }}>
        {/* Header */}
        <div style={{
          height: 52, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '0 20px',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)' }}>⚙ Settings</span>
          <button onClick={() => setSettingsOpen(false)} style={{
            background: 'none', border: 'none', color: 'var(--muted)',
            cursor: 'pointer', fontSize: 18, padding: '0 4px',
          }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {SETTINGS_TABS.map(tab => (
            <button key={tab.id} onClick={() => setSettingsTab(tab.id)} style={{
              textAlign: 'left', padding: '7px 12px', borderRadius: 5,
              background: settingsTab === tab.id ? 'var(--bg2)' : 'transparent',
              border: 'none',
              borderLeft: `2px solid ${settingsTab === tab.id ? 'var(--orange)' : 'transparent'}`,
              color: settingsTab === tab.id ? 'var(--text)' : 'var(--muted2)',
              fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {settingsTab === 'api'       && <ApiKeysTab />}
          {settingsTab === 'knowledge' && <KnowledgeBaseTab />}

          {settingsTab === 'model' && (
            <SettingsSection title="Active Model">
              <p style={settingsTextStyle}>Configure your LLM provider in the API Keys tab. DevOS automatically routes between providers based on availability.</p>
            </SettingsSection>
          )}

          {settingsTab === 'channels' && (
            <div>
              {['Telegram', 'WhatsApp', 'Discord', 'Slack', 'Email'].map(ch => (
                <SettingsSection key={ch} title={ch}>
                  <p style={settingsTextStyle}>{ch} integration — configure in your .env or DevOS config. See Setup Guide for details.</p>
                </SettingsSection>
              ))}
            </div>
          )}

          {settingsTab === 'pro' && (
            <SettingsSection title="Pro License">
              {/* Status */}
              <div style={{
                background: licenseStatus.active ? 'rgba(139,92,246,0.08)' : 'var(--bg2)',
                border: `1px solid ${licenseStatus.active ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`,
                borderRadius: 8, padding: 14, marginBottom: 14,
              }}>
                <div style={{ fontSize: 12, color: 'var(--muted2)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
                  Status:{' '}
                  <span style={{ color: licenseStatus.active ? '#a78bfa' : 'var(--muted)' }}>
                    {licenseStatus.active ? '★ Pro active' : 'Free'}
                  </span>
                </div>
                {licenseStatus.active && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: 2 }}>
                      Licensed to: {licenseStatus.email}
                    </div>
                    {licenseStatus.expiry > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                        Expires: {new Date(licenseStatus.expiry).toLocaleDateString()}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Activate input */}
              {!licenseStatus.active && (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <input
                      value={licenseKey}
                      onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                      placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                      style={{
                        width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)',
                        borderRadius: 6, padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 12,
                        color: 'var(--text)', outline: 'none', marginBottom: 6, letterSpacing: 1,
                        boxSizing: 'border-box',
                      }}
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && licenseKey.trim()) await validateKey(licenseKey)
                      }}
                    />
                    <button
                      onClick={async () => { if (licenseKey.trim()) await validateKey(licenseKey) }}
                      disabled={activatingKey || !licenseKey.trim()}
                      style={{
                        width: '100%', padding: '8px', borderRadius: 6,
                        background: activatingKey ? 'var(--bg3)' : '#7c3aed',
                        border: 'none', color: '#fff',
                        fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
                        cursor: activatingKey ? 'wait' : 'pointer',
                        opacity: !licenseKey.trim() ? 0.5 : 1,
                      }}
                    >{activatingKey ? 'Activating…' : 'Activate Key'}</button>
                  </div>
                  {licenseMsg && (
                    <div style={{
                      padding: '8px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--mono)',
                      background: licenseMsg.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${licenseMsg.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      color: licenseMsg.type === 'success' ? '#86efac' : '#fca5a5',
                      marginBottom: 10,
                    }}>{licenseMsg.text}</div>
                  )}
                  <button
                    onClick={() => setPricingOpen(true)}
                    style={{
                      width: '100%', padding: '9px', borderRadius: 6,
                      background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
                      color: '#a78bfa', fontFamily: 'var(--mono)', fontSize: 12,
                      cursor: 'pointer', marginBottom: 12,
                    }}
                  >View pricing & buy →</button>
                </>
              )}

              {/* Clear license */}
              {licenseStatus.active && (
                <button
                  onClick={clearProLicense}
                  style={{
                    width: '100%', padding: '8px', borderRadius: 6,
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11,
                    cursor: 'pointer', marginBottom: 12,
                  }}
                >Deactivate license</button>
              )}

              <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)', lineHeight: 1.6 }}>
                Pro includes: PDF/EPUB knowledge base · Voice input/output · Priority support
              </div>
            </SettingsSection>
          )}

          {settingsTab === 'guide' && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted2)', lineHeight: 1.8 }}>
              <SettingsSection title="Quick Start">
                <ol style={{ paddingLeft: 16, color: 'var(--muted2)' }}>
                  <li>Start DevOS: <code style={codeStyle}>npx ts-node index.ts serve</code></li>
                  <li>Open <code style={codeStyle}>http://localhost:3000</code></li>
                  <li>Add an API key in Settings → API Keys (Groq is free)</li>
                  <li>Ask Aiden anything in the chat</li>
                  <li>Click + to upload files to your knowledge base</li>
                </ol>
              </SettingsSection>
              <SettingsSection title="Tips">
                <ul style={{ paddingLeft: 16 }}>
                  <li>Be specific: "research X and save a detailed report to Desktop"</li>
                  <li>For web search: "search for X and give me the top 5 results"</li>
                  <li>For stocks: "show me NSE top gainers today"</li>
                </ul>
              </SettingsSection>
              <SettingsSection title="Keyboard Shortcuts">
                {[['Ctrl+K', 'New chat'], ['Ctrl+P', 'Toggle Power Mode'], ['Escape', 'Close settings'], ['Enter', 'Send message'], ['Shift+Enter', 'New line']].map(([key, desc]) => (
                  <div key={key} style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
                    <code style={{ ...codeStyle, minWidth: 100 }}>{key}</code>
                    <span>{desc}</span>
                  </div>
                ))}
              </SettingsSection>
            </div>
          )}

          {settingsTab === 'setup' && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted2)', lineHeight: 1.8 }}>
              <SettingsSection title="Prerequisites">
                <ul style={{ paddingLeft: 16 }}>
                  <li>Node.js 18+</li>
                  <li>Ollama (local models) — <a href="https://ollama.com" target="_blank" rel="noopener" style={{ color: 'var(--orange)' }}>ollama.com</a></li>
                  <li>Windows 10/11</li>
                </ul>
              </SettingsSection>
              <SettingsSection title="Recommended Models (GTX 1060 6GB)">
                {[['Chat', 'mistral:7b or qwen2.5:7b'], ['Code', 'qwen2.5-coder:7b'], ['Vision', 'llava:7b'], ['Embedding', 'nomic-embed-text']].map(([type, model]) => (
                  <div key={type} style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
                    <span style={{ minWidth: 80, color: 'var(--muted)' }}>{type}</span>
                    <code style={codeStyle}>{model}</code>
                  </div>
                ))}
              </SettingsSection>
              <SettingsSection title="Voice Setup (Optional)">
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted2)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8, color: 'var(--muted3)' }}>Voice input requires Python + faster-whisper:</div>
                  <code style={codeStyle}>pip install faster-whisper</code>
                  <div style={{ marginTop: 12, marginBottom: 8, color: 'var(--muted3)' }}>Voice output (edge-tts) — natural Aria voice:</div>
                  <code style={codeStyle}>pip install edge-tts</code>
                  <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ color: 'var(--muted)' }}>Once installed, restart DevOS. The 🎤 and 🔊 buttons appear automatically in chat — no config needed.</div>
                    <div style={{ marginTop: 6, color: 'var(--muted)' }}>Without edge-tts, Windows SAPI (built-in) is used as fallback.</div>
                  </div>
                </div>
              </SettingsSection>
              <SettingsSection title="Web Search Setup (Optional)">
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted2)', lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 8, color: 'var(--muted3)' }}>SearxNG gives unlimited self-hosted search (requires Docker):</div>
                  <code style={codeStyle}>.\scripts\start-searxng.ps1</code>
                  <div style={{ marginTop: 10, marginBottom: 8, color: 'var(--muted3)' }}>Or add a Brave Search API key to .env for a free fallback:</div>
                  <code style={codeStyle}>BRAVE_SEARCH_API_KEY=your_key</code>
                </div>
              </SettingsSection>
            </div>
          )}

          {settingsTab === 'privacy' && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted2)', lineHeight: 1.8 }}>
              <SettingsSection title="Privacy Policy">
                <p style={settingsTextStyle}><strong style={{ color: 'var(--text)' }}>DevOS runs entirely on your machine.</strong></p>
                <br />
                <strong style={{ color: 'var(--muted3)' }}>Stays on your device:</strong>
                <ul style={{ paddingLeft: 16, marginTop: 6 }}>
                  <li>All conversations and chat history</li>
                  <li>Knowledge base files and embeddings (stored in <code style={codeStyle}>workspace/knowledge/</code>)</li>
                  <li>PDF, EPUB, and document files you upload — text is extracted locally, no cloud OCR</li>
                  <li>Task history and execution logs</li>
                  <li>Memory, entity graph, semantic index</li>
                  <li>Screenshots and workspace files</li>
                  <li>Your API keys (stored locally)</li>
                </ul>
                <br />
                <strong style={{ color: 'var(--muted3)' }}>Leaves your device:</strong>
                <ul style={{ paddingLeft: 16, marginTop: 6 }}>
                  <li>Only message text sent to your configured AI provider</li>
                  <li>Zero telemetry or analytics collected</li>
                </ul>
                <br />
                <p style={settingsTextStyle}>Contact: <a href="mailto:contact@taracod.com" style={{ color: 'var(--orange)' }}>contact@taracod.com</a></p>
                <p style={{ ...settingsTextStyle, marginTop: 4 }}>Last updated: March 2026</p>
              </SettingsSection>
            </div>
          )}

          {settingsTab === 'legal' && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted2)', lineHeight: 1.8 }}>
              <SettingsSection title="License & Copyright">
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 8 }}>DevOS · Aiden</div>
                  <div>Built by <strong style={{ color: 'var(--text)' }}>Shiva Deore</strong></div>
                  <div>
                    <a href="https://taracod.com" target="_blank" rel="noopener" style={{ color: 'var(--orange)', textDecoration: 'none' }}>Taracod</a>
                    {' · '}<strong style={{ color: 'var(--muted3)' }}>White Lotus</strong>
                  </div>
                  <div style={{ marginTop: 8, color: 'var(--muted)' }}>© 2026 All rights reserved</div>
                </div>
                <p style={settingsTextStyle}>
                  <a href="mailto:contact@taracod.com" style={{ color: 'var(--orange)' }}>contact@taracod.com</a>
                  {' · '}
                  <a href="https://taracod.com" target="_blank" rel="noopener" style={{ color: 'var(--orange)' }}>taracod.com</a>
                </p>
              </SettingsSection>
            </div>
          )}

          {settingsTab === 'about' && (
            <div>
              <div style={{ textAlign: 'center', padding: '24px 0 16px', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 10, background: 'var(--orange)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: '#000', margin: '0 auto 12px',
                  fontFamily: 'var(--sans)',
                }}>D/</div>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>DevOS · Aiden</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>v2 · Local AI OS</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Discord',          href: 'https://discord.gg/8mBwwBcp' },
                  { label: 'Follow @shivafpx', href: 'https://x.com/shivafpx' },
                  { label: 'Visit taracod.com',href: 'https://taracod.com' },
                  { label: 'Report a bug',     href: 'mailto:contact@taracod.com' },
                ].map(link => (
                  <a key={link.label} href={link.href} target="_blank" rel="noopener" style={{
                    display: 'block', padding: '10px 14px', borderRadius: 6,
                    background: 'var(--bg2)', border: '1px solid var(--border)',
                    color: 'var(--muted2)', fontFamily: 'var(--mono)', fontSize: 12,
                    textDecoration: 'none', transition: 'all 0.15s',
                  }}>{link.label} →</a>
                ))}
              </div>
            </div>
          )}

          {settingsTab === 'danger' && (
            <div>
              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--red)', fontFamily: 'var(--mono)', marginBottom: 4 }}>⚠️ Danger Zone</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>These actions cannot be undone.</div>
              </div>
              {[
                {
                  label: 'Clear conversation history',
                  action: () => { setConversations([]); localStorage.removeItem('devos_conversations') },
                },
                {
                  label: 'Clear all memory',
                  action: () => fetch('http://localhost:4200/api/memory', { method: 'DELETE' }).catch(() => {}),
                },
                { label: 'Clear knowledge base', action: () => {} },
              ].map(item => (
                <button key={item.label} onClick={() => {
                  if (window.confirm(`Are you sure? This cannot be undone.\n\n${item.label}`)) item.action()
                }} style={{
                  width: '100%', marginBottom: 8, padding: '10px 14px',
                  background: 'transparent', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 6, color: 'var(--red)', fontFamily: 'var(--mono)',
                  fontSize: 12, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                }}>{item.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main component ────────────────────────────────────────────

export default function Home() {

  // ── Onboarding ──────────────────────────────────────────────
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('http://localhost:4200/api/providers')
      .then(r => r.json())
      .then((d: any) => {
        // Show onboarding if no API key is working (no enabled, non-rate-limited provider with a key)
        const hasWorkingKey = d.apis?.some((a: any) => a.hasKey && a.enabled && !a.rateLimited)
        setOnboardingDone(hasWorkingKey ? true : false)
      })
      .catch(() => setOnboardingDone(true)) // server not running yet — skip onboarding
  }, [])

  // ── UI Mode ─────────────────────────────────────────────────
  const [uiMode,         setUIMode]         = useState<UIMode>('focus')
  const [execMode,       setExecMode]       = useState<ExecMode>('auto')
  const [historyOpen,    setHistoryOpen]    = useState(false)
  const [liveViewOpen,   setLiveViewOpen]   = useState(false)
  const [activityOpen,   setActivityOpen]   = useState(false)
  const [settingsOpen,   setSettingsOpen]   = useState(false)
  const [settingsTab,    setSettingsTab]    = useState('api')
  const [isExecuting,    setIsExecuting]    = useState(false)
  const [isStreaming,    setIsStreaming]    = useState(false)

  // ── Messages / conversations ────────────────────────────────
  const [messages,       setMessages]       = useState<Message[]>([])
  const [conversations,  setConversations]  = useState<Conversation[]>([])
  const [currentConvId,  setCurrentConvId]  = useState<string>('')
  const [input,          setInput]          = useState('')

  // ── Activity / screenshot ───────────────────────────────────
  const [activityLogs,   setActivityLogs]   = useState<ActivityLog[]>([])
  const [screenshot,     setScreenshot]     = useState<string | null>(null)

  // ── Plus menu state ─────────────────────────────────────────
  const [plusMenuOpen,      setPlusMenuOpen]      = useState(false)
  const [activeSubmenu,     setActiveSubmenu]     = useState<string | null>(null)
  const [channelStatuses,   setChannelStatuses]   = useState<Record<string, boolean>>({})  // eslint-disable-line @typescript-eslint/no-unused-vars
  const [channelModal,      setChannelModal]      = useState<string | null>(null)
  const [miniPrompt,        setMiniPrompt]        = useState<MiniPromptConfig | null>(null)
  const [miniPromptValue,   setMiniPromptValue]   = useState('')

  // ── Voice state ─────────────────────────────────────────────
  const [voiceStatus,    setVoiceStatus]    = useState<{ stt: boolean; tts: boolean }>({ stt: false, tts: false })
  const [isRecording,    setIsRecording]    = useState(false)
  const [ttsEnabled,     setTtsEnabled]     = useState(false)
  const [recordingTimer, setRecordingTimer] = useState(0)

  // ── Live view data ──────────────────────────────────────────
  const [systemStats,    setSystemStats]    = useState<any>(null)
  const [recentTasks,    setRecentTasks]    = useState<any[]>([])

  // ── Session ID ──────────────────────────────────────────────
  const [sessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return `session_${Date.now()}`
    const stored = sessionStorage.getItem('devos_session')
    if (stored) return stored
    const newId = `session_${Date.now()}`
    sessionStorage.setItem('devos_session', newId)
    return newId
  })

  // ── Settings state ──────────────────────────────────────────
  const [providers,       setProviders]       = useState<any[]>([])
  const [routing,         setRouting]         = useState<any>({ mode: 'auto', fallbackToOllama: true })
  const [addingProvider,  setAddingProvider]  = useState<string | null>(null)
  const [newKey,          setNewKey]          = useState('')
  const [newModel,        setNewModel]        = useState('')
  const [savingKey,       setSavingKey]       = useState(false)

  // ── Knowledge Base state ────────────────────────────────────
  const [knowledgeFiles,    setKnowledgeFiles]    = useState<any[]>([])
  const [knowledgeStats,    setKnowledgeStats]    = useState<any>(null)
  const [uploadingFile,     setUploadingFile]     = useState(false)
  const [uploadCategory,    setUploadCategory]    = useState('general')

  // ── License / Pro state ──────────────────────────────────────
  const [pricingOpen,    setPricingOpen]    = useState(false)
  const [licenseStatus,  setLicenseStatus]  = useState<{ active: boolean; tier: string; email: string; expiry: number }>({ active: false, tier: 'free', email: '', expiry: 0 })
  const [activatingKey,  setActivatingKey]  = useState(false)   // eslint-disable-line @typescript-eslint/no-unused-vars
  const [licenseKey,     setLicenseKey]     = useState('')
  const [licenseMsg,     setLicenseMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ── Refs ────────────────────────────────────────────────────
  const inputRef         = useRef<HTMLTextAreaElement>(null)
  const kbInputRef       = useRef<HTMLInputElement>(null)
  const messagesEndRef   = useRef<HTMLDivElement>(null)
  const logsEndRef       = useRef<HTMLDivElement>(null)
  const knowledgeInputRef= useRef<HTMLInputElement>(null)

  // ── Auto-switch modes based on execution state ──────────────
  useEffect(() => {
    if (isExecuting) {
      setUIMode('execution')
      setLiveViewOpen(true)
      setActivityOpen(true)
    } else if (uiMode === 'execution') {
      const t = setTimeout(() => {
        setUIMode('focus')
        setLiveViewOpen(false)
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [isExecuting])

  // ── Voice availability check ─────────────────────────────────
  useEffect(() => {
    fetch('http://localhost:4200/api/voice/status')
      .then(r => r.json())
      .then(data => setVoiceStatus(data))
      .catch(() => {})
  }, [])

  // ── Auto-speak Aiden responses when TTS enabled ──────────────
  useEffect(() => {
    if (!ttsEnabled) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role === 'assistant' && !(lastMsg as any).isStreaming && lastMsg.content) {
      fetch('http://localhost:4200/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: lastMsg.content }),
      }).catch(() => {})
    }
  }, [messages, ttsEnabled])

  // ── Load license status on mount ────────────────────────────
  useEffect(() => {
    fetch('http://localhost:4200/api/license/status')
      .then(r => r.json())
      .then(data => setLicenseStatus(data))
      .catch(() => {})
  }, [])

  // ── Load conversations from localStorage ────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('devos_conversations')
      if (saved) setConversations(JSON.parse(saved))
    } catch {}
  }, [])

  // ── Save conversations to localStorage ──────────────────────
  useEffect(() => {
    try { localStorage.setItem('devos_conversations', JSON.stringify(conversations)) } catch {}
  }, [conversations])

  // Screenshot polling is handled inside LiveViewPanel (adaptive 800ms/3000ms)

  // ── Load system stats + recent tasks (idle) ─────────────────
  useEffect(() => {
    if (isExecuting) return
    Promise.all([
      fetch('http://localhost:4200/api/memory').then(r => r.json()).catch(() => null),
      fetch('http://localhost:4200/api/tasks').then(r => r.json()).catch(() => []),
    ]).then(([mem, tasks]) => {
      setSystemStats(mem)
      setRecentTasks(Array.isArray(tasks) ? tasks.slice(0, 3) : [])
    })
  }, [isExecuting])

  // ── Load providers when settings opens ──────────────────────
  useEffect(() => {
    if (!settingsOpen) return
    fetch('http://localhost:4200/api/providers')
      .then(r => r.json())
      .then((d: any) => { setProviders(d.apis || []); setRouting(d.routing || {}) })
      .catch(() => {})
    fetch('http://localhost:4200/api/knowledge')
      .then(r => r.json())
      .then((d: any) => setKnowledgeFiles(Array.isArray(d.files) ? d.files : []))
      .catch(() => {})
    fetch('http://localhost:4200/api/knowledge/stats')
      .then(r => r.json())
      .then((d: any) => setKnowledgeStats(d))
      .catch(() => {})
  }, [settingsOpen])

  // ── Keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); startNewChat() }
      if (e.key === 'Escape') {
        if (uiMode === 'watch') setUIMode('focus')
        if (settingsOpen) setSettingsOpen(false)
        if (plusMenuOpen) { setPlusMenuOpen(false); setActiveSubmenu(null); setMiniPrompt(null) }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setUIMode(m => m === 'power' ? 'focus' : 'power')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [uiMode, settingsOpen])

  // ── Grid columns ────────────────────────────────────────────
  const gridColumns = useMemo(() => {
    if (uiMode === 'watch')     return '0px 1fr 0px'
    if (uiMode === 'power')     return '260px 1fr 420px'
    if (uiMode === 'execution') return '0px 1fr 420px'
    const left  = historyOpen  ? '260px' : '0px'
    const right = liveViewOpen ? '380px' : '0px'
    return `${left} 1fr ${right}`
  }, [uiMode, historyOpen, liveViewOpen])

  // ── License helpers ─────────────────────────────────────────
  const validateKey = useCallback(async (key: string): Promise<{ success: boolean; error?: string }> => {
    setActivatingKey(true)
    setLicenseMsg(null)
    try {
      const res  = await fetch('http://localhost:4200/api/license/validate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      const data = await res.json()
      setActivatingKey(false)
      if (data.valid) {
        setLicenseStatus({ active: true, tier: data.tier, email: data.email, expiry: data.expiry })
        setLicenseMsg({ type: 'success', text: 'Pro activated!' })
        return { success: true }
      } else {
        setLicenseMsg({ type: 'error', text: data.error || 'Invalid key' })
        return { success: false, error: data.error }
      }
    } catch (e: any) {
      setActivatingKey(false)
      setLicenseMsg({ type: 'error', text: `Server error: ${e.message}` })
      return { success: false, error: e.message }
    }
  }, [])

  const clearProLicense = useCallback(async () => {
    await fetch('http://localhost:4200/api/license/clear', { method: 'POST' }).catch(() => {})
    setLicenseStatus({ active: false, tier: 'free', email: '', expiry: 0 })
    setLicenseMsg({ type: 'success', text: 'License cleared.' })
  }, [])

  // ── Conversation helpers ────────────────────────────────────
  const startNewChat = useCallback(() => {
    const id = `conv_${Date.now()}`
    setCurrentConvId(id)
    setMessages([])
  }, [])

  const loadConversation = useCallback((id: string) => {
    const conv = conversations.find(c => c.id === id)
    if (conv) { setCurrentConvId(id); setMessages(conv.messages) }
  }, [conversations])

  const saveToConversation = useCallback((msgs: Message[]) => {
    const title = msgs.find(m => m.role === 'user')?.content.slice(0, 40) || 'New Chat'
    setConversations(prev => {
      const existing = prev.find(c => c.id === currentConvId)
      if (existing) return prev.map(c => c.id === currentConvId ? { ...c, messages: msgs } : c)
      return [{ id: currentConvId, title, timestamp: Date.now(), messages: msgs }, ...prev]
    })
  }, [currentConvId])

  // ── Send message ────────────────────────────────────────────
  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = overrideText ?? input
    if (!text.trim() || isStreaming) return

    const userMsg: Message = {
      id: `msg_${Date.now()}`, role: 'user',
      content: text.trim(), timestamp: Date.now(),
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    if (!overrideText) setInput('')
    if (!overrideText && inputRef.current) inputRef.current.style.height = 'auto'
    setIsStreaming(true)

    const thinkingId = `thinking_${Date.now()}`
    setMessages(m => [...m, { id: thinkingId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true }])

    let fullReply = ''
    let provider  = ''

    try {
      const resp = await fetch('http://localhost:4200/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:  userMsg.content,
          history:  newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          mode:     execMode,
          sessionId,
        }),
      })

      if (!resp.body) throw new Error('No response body')
      const reader  = resp.body.getReader()
      const decoder = new TextDecoder()
      let   buf     = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))

            // Activity events
            if (data.activity) {
              if (!isExecuting) setIsExecuting(true)
              const log: ActivityLog = {
                time:    new Date().toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                icon:    data.activity.icon    || '▸',
                agent:   data.activity.agent   || 'Aiden',
                message: data.activity.message || '',
                style:   data.activity.style === 'done'    ? 'ok'     :
                         data.activity.style === 'error'   ? 'err'    :
                         data.activity.style === 'act' || data.activity.style === 'tool' ? 'active' : 'default',
              }
              setActivityLogs(prev => [...prev.slice(-99), log])
            }

            // Token
            if (data.token) {
              fullReply += data.token
              setMessages(m => m.map(msg =>
                msg.id === thinkingId ? { ...msg, content: fullReply, isStreaming: true } : msg
              ))
            }

            // Provider
            if (data.provider) provider = data.provider

            // Done
            if (data.done) {
              setIsExecuting(false)
              setIsStreaming(false)
              const finalMsg: Message = {
                id: thinkingId, role: 'assistant',
                content: fullReply, provider,
                timestamp: Date.now(), isStreaming: false,
              }
              setMessages(prev => {
                const updated = prev.map(m => m.id === thinkingId ? finalMsg : m)
                saveToConversation(updated)
                return updated
              })
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setIsExecuting(false)
      setIsStreaming(false)
      setMessages(m => m.map(msg =>
        msg.id === thinkingId
          ? { ...msg, content: 'Something went wrong. Please try again.', isStreaming: false }
          : msg
      ))
    }
  }, [input, isStreaming, messages, execMode, sessionId, saveToConversation])

  // ── Quick upload (chat + button) ────────────────────────────
  const handleQuickUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', 'general')

      const r = await fetch('http://localhost:4200/api/knowledge/upload/async', { method: 'POST', body: fd })
      const d = await r.json() as any
      if (!d.success) return

      // Poll for completion
      const jobId = d.jobId as string
      const pollResult = await new Promise<any>((resolve) => {
        const iv = setInterval(async () => {
          try {
            const pr = await fetch(`http://localhost:4200/api/knowledge/progress/${encodeURIComponent(jobId)}`).then(x => x.json()) as any
            if (pr.status === 'done' || pr.status === 'error') { clearInterval(iv); resolve(pr) }
          } catch { clearInterval(iv); resolve({ status: 'error', message: 'Poll failed' }) }
        }, 700)
      })

      if (pollResult.status === 'done') {
        const res = pollResult.result as any
        const details = res
          ? `${res.chunkCount} chunks${res.wordCount ? `, ${res.wordCount.toLocaleString()} words` : ''}${res.pageCount ? `, ${res.pageCount} pages` : ''}`
          : ''
        setMessages(prev => [...prev, {
          id: `sys_${Date.now()}`, role: 'assistant' as const,
          content: `📎 Added **${file.name}** to knowledge base (${details}). You can now reference this file in your questions.`,
          timestamp: Date.now(), isStreaming: false,
        }])
      }
    } catch {}
    if (kbInputRef.current) kbInputRef.current.value = ''
  }, [])

  // ── Settings: API Key handlers ──────────────────────────────
  const saveKey = useCallback(async (providerID: string) => {
    if (!newKey.trim()) return
    setSavingKey(true)
    try {
      await fetch('http://localhost:4200/api/providers/add', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerID, key: newKey.trim(), model: newModel || undefined }),
      })
      setNewKey('')
      setNewModel('')
      setAddingProvider(null)
      const d = await fetch('http://localhost:4200/api/providers').then(r => r.json()) as any
      setProviders(d.apis || [])
    } catch {}
    setSavingKey(false)
  }, [newKey, newModel])

  const toggleProvider = useCallback(async (name: string, enabled: boolean) => {
    await fetch(`http://localhost:4200/api/providers/${encodeURIComponent(name)}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).catch(() => {})
    setProviders(prev => prev.map((p: any) => p.name === name ? { ...p, enabled } : p))
  }, [])

  const deleteProvider = useCallback(async (name: string) => {
    if (!window.confirm(`Remove ${name}?`)) return
    await fetch(`http://localhost:4200/api/providers/${encodeURIComponent(name)}`, { method: 'DELETE' }).catch(() => {})
    setProviders(prev => prev.filter((p: any) => p.name !== name))
  }, [])

  const resetLimits = useCallback(async () => {
    await fetch('http://localhost:4200/api/providers/reset-limits', { method: 'POST' }).catch(() => {})
    setProviders(prev => prev.map((p: any) => ({ ...p, rateLimited: false })))
  }, [])

  // ── Settings: Knowledge Base handlers ───────────────────────
  const handleKnowledgeUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', uploadCategory)

      // Start async upload — get jobId immediately
      const r = await fetch('http://localhost:4200/api/knowledge/upload/async', { method: 'POST', body: fd })
      const d = await r.json() as any
      if (!d.success) { setUploadingFile(false); return }

      const jobId = d.jobId as string

      // Poll until done or error
      await new Promise<void>((resolve) => {
        const iv = setInterval(async () => {
          try {
            const pr = await fetch(`http://localhost:4200/api/knowledge/progress/${encodeURIComponent(jobId)}`).then(x => x.json()) as any
            if (pr.status === 'done' || pr.status === 'error') { clearInterval(iv); resolve() }
          } catch { clearInterval(iv); resolve() }
        }, 600)
      })

      // Refresh list + stats after completion
      const updated = await fetch('http://localhost:4200/api/knowledge').then(r2 => r2.json()) as any
      setKnowledgeFiles(Array.isArray(updated.files) ? updated.files : [])
      const stats = await fetch('http://localhost:4200/api/knowledge/stats').then(r2 => r2.json()) as any
      setKnowledgeStats(stats)

    } catch {}
    setUploadingFile(false)
    if (knowledgeInputRef.current) knowledgeInputRef.current.value = ''
  }, [uploadCategory])

  const handleKnowledgeDelete = useCallback(async (fileId: string) => {
    if (!window.confirm('Remove this file from knowledge base?')) return
    await fetch(`http://localhost:4200/api/knowledge/${encodeURIComponent(fileId)}`, { method: 'DELETE' }).catch(() => {})
    setKnowledgeFiles(prev => prev.filter((f: any) => f.id !== fileId))
  }, [])

  // ── Plus menu handlers ───────────────────────────────────────
  const takeScreenshot = useCallback(async () => {
    setPlusMenuOpen(false)
    setActiveSubmenu(null)

    const now = new Date().toLocaleTimeString('en', { hour12: false })
    setActivityLogs(prev => [...prev, { time: now, icon: '📷', agent: 'System', message: 'Taking screenshot...', style: 'active' }])

    try {
      await fetch('http://localhost:4200/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'take a screenshot of the current screen and save it', mode: 'auto', sessionId }),
      })
    } catch {}

    let attempts = 0
    const poll = setInterval(async () => {
      attempts++
      try {
        const r = await fetch('http://localhost:4200/api/screenshot?' + Date.now())
        if (r.ok) {
          const blob = await r.blob()
          if (blob.size > 0) {
            const url = URL.createObjectURL(blob)
            setScreenshot(url)
            setLiveViewOpen(true)
            clearInterval(poll)
            const t = new Date().toLocaleTimeString('en', { hour12: false })
            setActivityLogs(prev => [...prev, { time: t, icon: '✓', agent: 'System', message: 'Screenshot captured', style: 'ok' }])
          }
        }
      } catch {}
      if (attempts > 10) clearInterval(poll)
    }, 800)
  }, [sessionId, setPlusMenuOpen, setActiveSubmenu, setActivityLogs, setScreenshot, setLiveViewOpen])

  const submitMiniPrompt = useCallback(() => {
    if (!miniPromptValue.trim() || !miniPrompt) return

    const val = miniPromptValue.trim()
    setPlusMenuOpen(false)
    setActiveSubmenu(null)
    setMiniPrompt(null)
    setMiniPromptValue('')

    if (miniPrompt.type === 'stocks') {
      // Stocks: use direct phrasing and send
      sendMessage(`get stock data for ${val}`)
    } else {
      const prefixes: Record<string, string> = {
        websearch: 'Search the web for:',
        research:  'Do deep research on:',
      }
      sendMessage(`${prefixes[miniPrompt.type] ?? ''} ${val}`.trim())
    }
  }, [miniPromptValue, miniPrompt, sendMessage])

  // ── Voice recording handler ──────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecording || isStreaming) return
    setIsRecording(true)
    setRecordingTimer(5)

    // Countdown display
    const countdown = setInterval(() => {
      setRecordingTimer(t => {
        if (t <= 1) { clearInterval(countdown); return 0 }
        return t - 1
      })
    }, 1000)

    try {
      // Record 5 seconds of audio
      const r1   = await fetch('http://localhost:4200/api/voice/record', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ duration: 5000 }),
      })
      const { path: audioPath } = await r1.json()

      // Transcribe
      const r2   = await fetch('http://localhost:4200/api/voice/transcribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ path: audioPath }),
      })
      const { text } = await r2.json()

      if (text?.trim()) {
        setInput(text.trim())
        setTimeout(() => sendMessage(text.trim()), 300)
      }
    } catch (e) {
      console.error('[Voice] Recording error:', e)
    } finally {
      clearInterval(countdown)
      setIsRecording(false)
      setRecordingTimer(0)
    }
  }, [isRecording, isStreaming, sendMessage])

  // ── Context value ───────────────────────────────────────────
  const ctxValue: DevOSCtxType = {
    uiMode, setUIMode, execMode, setExecMode,
    historyOpen, setHistoryOpen, liveViewOpen, setLiveViewOpen,
    activityOpen, setActivityOpen, settingsOpen, setSettingsOpen,
    settingsTab, setSettingsTab,
    isExecuting, isStreaming,
    messages, setMessages, conversations, setConversations, currentConvId,
    input, setInput,
    activityLogs, setActivityLogs, screenshot, setScreenshot, sessionId,
    systemStats, recentTasks,
    sendMessage, startNewChat, loadConversation,
    handleQuickUpload,
    inputRef, kbInputRef, messagesEndRef, logsEndRef,
    // Plus menu
    plusMenuOpen, setPlusMenuOpen,
    activeSubmenu, setActiveSubmenu,
    channelStatuses,
    channelModal, setChannelModal,
    miniPrompt, setMiniPrompt,
    miniPromptValue, setMiniPromptValue,
    takeScreenshot, submitMiniPrompt,
    // Voice
    voiceStatus, isRecording, ttsEnabled, setTtsEnabled, recordingTimer, startRecording,
    // API keys
    providers, routing, addingProvider, setAddingProvider,
    newKey, setNewKey, newModel, setNewModel,
    savingKey, saveKey, toggleProvider, deleteProvider, resetLimits,
    // Knowledge base
    knowledgeFiles, knowledgeStats, uploadingFile,
    uploadCategory, setUploadCategory, knowledgeInputRef,
    handleKnowledgeUpload, handleKnowledgeDelete,
    // License / Pro
    pricingOpen, setPricingOpen,
    licenseStatus, licenseKey, setLicenseKey,
    activatingKey, licenseMsg, setLicenseMsg,
    validateKey, clearProLicense,
  }

  // ── Loading splash ──────────────────────────────────────────
  if (onboardingDone === null) return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12,
    }}>
      loading...
    </div>
  )

  // ── Dashboard ───────────────────────────────────────────────
  return (
    <DevOSCtx.Provider value={ctxValue}>
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100vh', background: 'var(--bg)',
        color: 'var(--text)', fontFamily: 'var(--mono)', overflow: 'hidden',
      }}>
        <NavBar />
        <div style={{
          flex: 1, display: 'grid', overflow: 'hidden',
          gridTemplateColumns: gridColumns,
          transition: 'grid-template-columns 0.3s cubic-bezier(0.22,1,0.36,1)',
        }}>
          <HistorySidebar />
          <ChatPanel />
          <LiveViewPanel />
        </div>
        <ActivityBar />
        <DisclaimerBar />
        {settingsOpen && <SettingsDrawer />}
        {channelModal && <ChannelModal />}
        {pricingOpen && (
          <PricingModal
            onClose={() => { setPricingOpen(false); setLicenseMsg(null) }}
            onActivate={validateKey}
            currentStatus={licenseStatus}
          />
        )}
        {!onboardingDone && (
          <OnboardingModal onComplete={(name) => {
            setOnboardingDone(true)
          }} />
        )}
      </div>
    </DevOSCtx.Provider>
  )
}
