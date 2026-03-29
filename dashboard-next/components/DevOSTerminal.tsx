'use client'
// dashboard-next/components/DevOSTerminal.tsx
// Sprint 25: xterm.js terminal panel wired to DevOS WebSocket.
// Install deps: npm install @xterm/xterm @xterm/addon-fit @xterm/addon-web-links

import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

export default function DevOSTerminal() {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef      = useRef<Terminal | null>(null)
  const fitRef       = useRef<FitAddon | null>(null)
  // wsRef used in cleanup — stored so the resize observer close can reach it
  const wsRef        = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: {
        background:    '#141414',
        foreground:    '#e8e8e8',
        cursor:        '#f97316',
        cursorAccent:  '#141414',
        black:         '#141414',
        brightBlack:   '#555555',
        red:           '#f87171',
        green:         '#22c55e',
        yellow:        '#fbbf24',
        blue:          '#60a5fa',
        magenta:       '#a78bfa',
        cyan:          '#22d3ee',
        white:         '#e8e8e8',
        brightWhite:   '#ffffff',
      },
      fontFamily:       '"JetBrains Mono", "Fira Code", monospace',
      fontSize:         13,
      lineHeight:       1.5,
      cursorBlink:      true,
      cursorStyle:      'bar',
      scrollback:       1000,
      allowTransparency: true,
    })

    const fitAddon      = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitRef.current  = fitAddon

    // Welcome message
    term.writeln('\x1b[38;2;249;115;22mDevOS v1.0\x1b[0m — Terminal ready')
    term.writeln('\x1b[2mConnecting to DevOS server...\x1b[0m')
    term.writeln('')

    // WebSocket connection to DevOS API
    let ws: WebSocket | null = null
    try {
      ws          = new WebSocket('ws://localhost:4200/terminal')
      wsRef.current = ws

      ws.onopen = () => {
        term.writeln('\x1b[32m✓ Connected\x1b[0m')
        term.write('$ ')
      }

      ws.onmessage = (e) => {
        term.write(e.data as string)
      }

      ws.onerror = () => {
        term.writeln('\x1b[33m⚠ Server offline — start with: devos serve\x1b[0m')
        term.write('$ ')
      }

      ws.onclose = () => {
        term.writeln('\x1b[2m[disconnected]\x1b[0m')
      }

      // Send keystrokes to server
      term.onData((data) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        } else {
          // Offline mode — echo locally
          term.write(data)
        }
      })
    } catch {
      term.writeln('\x1b[33m⚠ WebSocket unavailable — offline mode\x1b[0m')
      term.write('$ ')
      // Offline mode — just echo
      term.onData((data) => term.write(data))
    }

    // Resize handler
    const observer = new ResizeObserver(() => fitAddon.fit())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      ws?.close()
      term.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width:        '100%',
        height:       '100%',
        minHeight:    '300px',
        background:   '#141414',
        borderRadius: '8px',
        overflow:     'hidden',
        padding:      '8px',
      }}
    />
  )
}
