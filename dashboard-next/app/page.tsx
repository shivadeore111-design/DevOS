'use client'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import { LeftSidebar } from '../components/LeftSidebar'
import { ChatPanel } from '../components/ChatPanel'
import { AgentFeed } from '../components/AgentFeed'

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--devos-bg)' }}>
      {/* Left sidebar — hidden on mobile */}
      <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-64 shrink-0`}>
        <LeftSidebar />
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden px-4 py-2 border-b flex items-center"
          style={{ borderColor: 'var(--devos-border)' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-3">
            <Menu size={20} style={{ color: 'var(--devos-muted)' }} />
          </button>
          <span className="font-bold" style={{ color: 'var(--devos-accent)' }}>DevOS</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel />
        </div>
      </div>

      {/* Right agent feed — hidden below lg */}
      <div className="hidden lg:block w-80 shrink-0">
        <AgentFeed />
      </div>
    </div>
  )
}
