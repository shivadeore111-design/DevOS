'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// ── Views ─────────────────────────────────────────────────────────────────

/** Builder mode views */
export type BuilderView =
  | 'chat'
  | 'goals'
  | 'missions'
  | 'agents'
  | 'skills'
  | 'memory'
  | 'knowledge'

/** Personal mode views */
export type PersonalView =
  | 'chat'
  | 'tasks'
  | 'life-canvas'
  | 'agents'
  | 'research'

export type ActiveView = BuilderView | PersonalView

export type DevOSMode = 'builder' | 'personal'

// ── Settings ──────────────────────────────────────────────────────────────

export interface DevOSSettings {
  selectedModel: string
  apiProvider: 'ollama' | 'openai' | 'anthropic'
  apiKey?: string
  userName?: string
  isSetupComplete: boolean
}

const DEFAULT_SETTINGS: DevOSSettings = {
  selectedModel: '',
  apiProvider: 'ollama',
  isSetupComplete: false
}

// ── Store context ─────────────────────────────────────────────────────────

interface StoreState {
  activeView: ActiveView
  setActiveView: (v: ActiveView) => void
  devosMode: DevOSMode
  setDevosMode: (m: DevOSMode) => void
  settings: DevOSSettings
  setSettings: (s: DevOSSettings) => void
  isSetupOpen: boolean
  setIsSetupOpen: (v: boolean) => void
  mounted: boolean
}

const Store = createContext<StoreState | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [activeView,   setActiveView]   = useState<ActiveView>('chat')
  const [devosMode,    setDevodModeState] = useState<DevOSMode>('builder')
  const [isSetupOpen,  setIsSetupOpen]  = useState(false)
  const [mounted,      setMounted]      = useState(false)
  const [settings,     setSettingsState] = useState<DevOSSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('devos_settings')
      if (saved) setSettingsState(JSON.parse(saved))

      // Detect mode from env or localStorage
      const envMode = process.env.NEXT_PUBLIC_DEVOS_MODE as DevOSMode | undefined
      const savedMode = localStorage.getItem('devos_mode') as DevOSMode | null
      const mode = savedMode || envMode || 'builder'
      if (mode === 'personal' || mode === 'builder') setDevodModeState(mode)
    } catch {}
    setMounted(true)
  }, [])

  const setDevosMode = (m: DevOSMode) => {
    setDevodModeState(m)
    try { localStorage.setItem('devos_mode', m) } catch {}
    // When switching modes, reset to chat view
    setActiveView('chat')
  }

  const setSettings = (s: DevOSSettings) => {
    setSettingsState(s)
    try { localStorage.setItem('devos_settings', JSON.stringify(s)) } catch {}
  }

  return (
    <Store.Provider value={{
      activeView,   setActiveView,
      devosMode,    setDevosMode,
      settings,     setSettings,
      isSetupOpen,  setIsSetupOpen,
      mounted
    }}>
      {children}
    </Store.Provider>
  )
}

export function useStore() {
  const ctx = useContext(Store)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
