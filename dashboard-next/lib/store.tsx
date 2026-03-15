'use client'
import { createContext, useContext, useState, ReactNode } from 'react'

export type ActiveView = 'chat' | 'goals' | 'missions' | 'agents' | 'pilots' | 'memory'

export interface DevOSSettings {
  selectedModel: string
  apiProvider: 'ollama' | 'openai' | 'anthropic'
  apiKey?: string
  userName?: string
  isSetupComplete: boolean
}

interface StoreState {
  activeView: ActiveView
  setActiveView: (v: ActiveView) => void
  settings: DevOSSettings
  setSettings: (s: DevOSSettings) => void
  isSetupOpen: boolean
  setIsSetupOpen: (v: boolean) => void
}

const Store = createContext<StoreState | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<ActiveView>('chat')
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [settings, setSettings] = useState<DevOSSettings>(() => {
    if (typeof window === 'undefined') return { selectedModel: '', apiProvider: 'ollama', isSetupComplete: false }
    try {
      const saved = localStorage.getItem('devos_settings')
      return saved ? JSON.parse(saved) : { selectedModel: '', apiProvider: 'ollama', isSetupComplete: false }
    } catch { return { selectedModel: '', apiProvider: 'ollama', isSetupComplete: false } }
  })

  const updateSettings = (s: DevOSSettings) => {
    setSettings(s)
    if (typeof window !== 'undefined') localStorage.setItem('devos_settings', JSON.stringify(s))
  }

  return (
    <Store.Provider value={{ activeView, setActiveView, settings, setSettings: updateSettings, isSetupOpen, setIsSetupOpen }}>
      {children}
    </Store.Provider>
  )
}

export function useStore() {
  const ctx = useContext(Store)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
