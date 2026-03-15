'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type ActiveView = 'chat' | 'goals' | 'missions' | 'agents' | 'pilots' | 'memory'

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

interface StoreState {
  activeView: ActiveView
  setActiveView: (v: ActiveView) => void
  settings: DevOSSettings
  setSettings: (s: DevOSSettings) => void
  isSetupOpen: boolean
  setIsSetupOpen: (v: boolean) => void
  mounted: boolean
}

const Store = createContext<StoreState | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<ActiveView>('chat')
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [settings, setSettingsState] = useState<DevOSSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('devos_settings')
      if (saved) setSettingsState(JSON.parse(saved))
    } catch {}
    setMounted(true)
  }, [])

  const setSettings = (s: DevOSSettings) => {
    setSettingsState(s)
    try { localStorage.setItem('devos_settings', JSON.stringify(s)) } catch {}
  }

  return (
    <Store.Provider value={{
      activeView, setActiveView,
      settings, setSettings,
      isSetupOpen, setIsSetupOpen,
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
