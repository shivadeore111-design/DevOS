"use client"
import {
  useState, useEffect, useRef, useMemo, useCallback,
  createContext, useContext,
} from 'react'
import Onboarding from '../components/Onboarding'

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
  activityLogs:   ActivityLog[]
  // Screenshot
  screenshot:     string | null
  // Session
  sessionId:      string
  // Live view data
  systemStats:    any
  recentTasks:    any[]
  // Handlers
  sendMessage:    () => void
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
            <input
              placeholder="Paste API key..."
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg3)',
                border: '1px solid var(--border2)', borderRadius: 6,
                padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 12,
                color: 'var(--text)', outline: 'none', marginBottom: 8,
              }}
            />
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
              { label: 'Files',    value: knowledgeStats.files    || 0 },
              { label: 'Chunks',   value: knowledgeStats.chunks   || 0 },
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

        {/* Upload */}
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
            {uploadingFile ? 'Uploading...' : '+ Upload File'}
          </button>
          <input
            ref={knowledgeInputRef}
            type="file" accept=".txt,.md,.pdf,.csv"
            style={{ display: 'none' }}
            onChange={handleKnowledgeUpload}
          />
        </div>

        {/* File list */}
        {knowledgeFiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11 }}>
            No files in knowledge base yet
          </div>
        ) : (
          knowledgeFiles.map((f: any) => (
            <div key={f.id} style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '8px 12px', marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.originalName || f.filename}
                </div>
                <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                  {f.category} · {f.chunkCount} chunks
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
          ))
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
            background: 'var(--odim)', border: '1px solid rgba(249,115,22,0.25)',
            color: 'var(--orange)', fontFamily: 'var(--mono)', cursor: 'pointer',
          }}
          onClick={() => { setSettingsOpen(true); setSettingsTab('pro') }}
        >
          PRO
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

// ── ChatPanel ─────────────────────────────────────────────────

function ChatPanel() {
  const {
    messages, input, setInput, isStreaming, execMode, setExecMode,
    sendMessage, handleQuickUpload,
    inputRef, kbInputRef, messagesEndRef,
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
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {/* KB upload */}
          <button
            onClick={() => kbInputRef.current?.click()}
            title="Add to Knowledge Base"
            style={{
              width: 36, height: 36, borderRadius: 6, flexShrink: 0,
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              color: 'var(--muted2)', cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >+</button>
          <input
            ref={kbInputRef} type="file" accept=".txt,.md,.pdf"
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

          {/* Send */}
          <button
            onClick={sendMessage}
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

function LiveViewPanel() {
  const { isExecuting, screenshot, uiMode, setUIMode, systemStats, recentTasks } = useDevOS()

  return (
    <aside style={{
      overflow: 'hidden', borderLeft: '1px solid var(--border)',
      background: 'var(--bg1)', display: 'flex', flexDirection: 'column',
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
            background: isExecuting ? 'var(--orange)' : 'var(--muted)',
            animation: isExecuting ? 'pulse-dot 1s infinite' : 'none',
          }} />
          Live View
        </div>
        <NavBtn onClick={() => setUIMode(m => m === 'watch' ? 'focus' : 'watch')} title="Watch Mode">
          {uiMode === 'watch' ? '✕' : '⤢'}
        </NavBtn>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        {screenshot && (
          <div style={{ marginBottom: 14 }}>
            <img src={screenshot} alt="Screen" style={{
              width: '100%', borderRadius: 6, border: '1px solid var(--border)',
            }} />
            <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4, textAlign: 'center', fontFamily: 'var(--mono)' }}>
              live · {new Date().toLocaleTimeString()}
            </div>
          </div>
        )}

        {!isExecuting && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'status', value: 'online',  color: 'var(--green)' },
                { label: 'mode',   value: 'local' },
                { label: 'memory', value: `${systemStats?.recentHistory?.length ?? 0} items` },
                { label: 'skills', value: '3 loaded' },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '10px 12px',
                }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, fontFamily: 'var(--mono)' }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: 13, color: stat.color || 'var(--text)', fontFamily: 'var(--mono)', fontWeight: 500 }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {recentTasks.length > 0 && (
              <>
                <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'var(--mono)' }}>
                  Recent Tasks
                </div>
                {recentTasks.map((task: any, i: number) => (
                  <div key={i} style={{
                    background: 'var(--bg2)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '8px 12px', marginBottom: 6,
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.goal?.slice(0, 40) || 'Task'}
                    </div>
                    <div style={{
                      fontSize: 9, marginTop: 2, fontFamily: 'var(--mono)',
                      color: task.status === 'completed' ? 'var(--green)' : task.status === 'failed' ? 'var(--red)' : 'var(--orange)',
                    }}>
                      {task.status}
                    </div>
                  </div>
                ))}
              </>
            )}

            {!screenshot && recentTasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                No activity yet.<br />
                <span style={{ fontSize: 9, marginTop: 4, display: 'block' }}>
                  Live view activates when Aiden executes a task
                </span>
              </div>
            )}
          </>
        )}
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
          {activityLogs.slice(-100).map((log, i) => (
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
  const { settingsTab, setSettingsTab, setSettingsOpen, setConversations } = useDevOS()

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
            <SettingsSection title="Aiden Pro">
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--muted2)', fontFamily: 'var(--mono)', marginBottom: 12 }}>
                  Current plan: <span style={{ color: 'var(--text)' }}>Free</span>
                </div>
                <input placeholder="Enter license key..." style={{
                  width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)',
                  borderRadius: 6, padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 12,
                  color: 'var(--text)', outline: 'none', marginBottom: 8,
                }} />
                <button style={{
                  width: '100%', padding: '8px', borderRadius: 6,
                  background: 'var(--orange)', border: 'none', color: '#000',
                  fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>Validate License</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: 16 }}>
                Pro includes: PDF/EPUB knowledge base · Voice input/output · Custom pilots · Priority support
              </div>
              <a href="https://taracod.com" target="_blank" rel="noopener" style={{
                display: 'block', textAlign: 'center', padding: '10px',
                background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)',
                borderRadius: 6, color: 'var(--orange)', fontFamily: 'var(--mono)',
                fontSize: 12, textDecoration: 'none',
              }}>Upgrade to Pro →</a>
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
                  <li>Knowledge base files and embeddings</li>
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
    fetch('http://localhost:4200/api/onboarding')
      .then(r => r.json())
      .then((d: any) => { setOnboardingDone(d.onboardingComplete ?? true) })
      .catch(() => setOnboardingDone(true))
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

  // ── Screenshot polling when live view open ──────────────────
  useEffect(() => {
    if (!liveViewOpen) return
    const interval = setInterval(async () => {
      try {
        const r = await fetch('http://localhost:4200/api/screenshot')
        if (r.ok) {
          const blob = await r.blob()
          const url  = URL.createObjectURL(blob)
          setScreenshot(prev => { if (prev) URL.revokeObjectURL(prev); return url })
        }
      } catch {}
    }, 1000)
    return () => clearInterval(interval)
  }, [liveViewOpen])

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
    if (uiMode === 'power')     return '260px 1fr 380px'
    if (uiMode === 'execution') return '0px 1fr 380px'
    const left  = historyOpen  ? '260px' : '0px'
    const right = liveViewOpen ? '380px' : '0px'
    return `${left} 1fr ${right}`
  }, [uiMode, historyOpen, liveViewOpen])

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
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return

    const userMsg: Message = {
      id: `msg_${Date.now()}`, role: 'user',
      content: input.trim(), timestamp: Date.now(),
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
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
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsText(file)
      })
      const r = await fetch('http://localhost:4200/api/knowledge/upload', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename: file.name, category: 'general' }),
      })
      const d = await r.json() as any
      if (d.success) {
        setMessages(prev => [...prev, {
          id: `sys_${Date.now()}`, role: 'assistant' as const,
          content: `📎 Added **${file.name}** to knowledge base (${d.chunkCount} chunks). You can now reference this file in your questions.`,
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
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsText(file)
      })
      const r = await fetch('http://localhost:4200/api/knowledge/upload', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename: file.name, category: uploadCategory }),
      })
      const d = await r.json() as any
      if (d.success) {
        const updated = await fetch('http://localhost:4200/api/knowledge').then(r2 => r2.json()) as any
        setKnowledgeFiles(Array.isArray(updated.files) ? updated.files : [])
        const stats = await fetch('http://localhost:4200/api/knowledge/stats').then(r2 => r2.json()) as any
        setKnowledgeStats(stats)
      }
    } catch {}
    setUploadingFile(false)
    if (knowledgeInputRef.current) knowledgeInputRef.current.value = ''
  }, [uploadCategory])

  const handleKnowledgeDelete = useCallback(async (fileId: string) => {
    if (!window.confirm('Remove this file from knowledge base?')) return
    await fetch(`http://localhost:4200/api/knowledge/${encodeURIComponent(fileId)}`, { method: 'DELETE' }).catch(() => {})
    setKnowledgeFiles(prev => prev.filter((f: any) => f.id !== fileId))
  }, [])

  // ── Context value ───────────────────────────────────────────
  const ctxValue: DevOSCtxType = {
    uiMode, setUIMode, execMode, setExecMode,
    historyOpen, setHistoryOpen, liveViewOpen, setLiveViewOpen,
    activityOpen, setActivityOpen, settingsOpen, setSettingsOpen,
    settingsTab, setSettingsTab,
    isExecuting, isStreaming,
    messages, setMessages, conversations, setConversations, currentConvId,
    input, setInput,
    activityLogs, screenshot, sessionId,
    systemStats, recentTasks,
    sendMessage, startNewChat, loadConversation,
    handleQuickUpload,
    inputRef, kbInputRef, messagesEndRef, logsEndRef,
    // API keys
    providers, routing, addingProvider, setAddingProvider,
    newKey, setNewKey, newModel, setNewModel,
    savingKey, saveKey, toggleProvider, deleteProvider, resetLimits,
    // Knowledge base
    knowledgeFiles, knowledgeStats, uploadingFile,
    uploadCategory, setUploadCategory, knowledgeInputRef,
    handleKnowledgeUpload, handleKnowledgeDelete,
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

  // ── Onboarding ──────────────────────────────────────────────
  if (!onboardingDone) return (
    <Onboarding onComplete={() => setOnboardingDone(true)} />
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
      </div>
    </DevOSCtx.Provider>
  )
}
