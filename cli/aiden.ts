#!/usr/bin/env node
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
//
// cli/aiden.ts — Terminal Interface for Aiden
// Connects to the same API server as the dashboard.
// Same brain, same memory, same tools — just a different front-end.
//
// Usage:
//   npm run cli              — run with ts-node
//   AIDEN_API=http://... npm run cli  — custom server URL

import readline from 'readline'

const API_BASE = process.env.AIDEN_API || 'http://localhost:4200'

// Colors
const ORANGE = '\x1b[38;5;208m'
const GREEN  = '\x1b[32m'
const DIM    = '\x1b[2m'
const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'
const CYAN   = '\x1b[36m'
const RED    = '\x1b[31m'

function printBanner(): void {
  console.log(`
${ORANGE}  ╔═══════════════════════════╗
  ║  ${BOLD}A/ Aiden${RESET}${ORANGE}  —  Personal AI  ║
  ╚═══════════════════════════╝${RESET}
  ${DIM}Type naturally. /help for commands.${RESET}
`)
}

async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`)
    return res.ok
  } catch {
    return false
  }
}

async function streamChat(message: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/stream`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message }),
    })

    if (!res.ok || !res.body) {
      console.log(`${RED}Error: ${res.statusText}${RESET}`)
      return
    }

    const reader  = (res.body as any).getReader()
    const decoder = new TextDecoder()
    let buffer    = ''

    process.stdout.write(`\n${ORANGE}Aiden${RESET} `)

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        try {
          const event = JSON.parse(data)

          if (event.type === 'chat' && event.content) {
            process.stdout.write(event.content)
          }

          if (event.type === 'thinking') {
            process.stdout.write(
              `\n${DIM}  ⟳ ${event.message}${RESET}\n`
            )
          }

          if (event.type === 'tool_call') {
            process.stdout.write(
              `\n${CYAN}  ▸ ${event.tool}${RESET}${DIM} ${
                event.status || ''
              }${RESET}`
            )
          }

          if (event.type === 'delegation') {
            process.stdout.write(
              `\n${DIM}  ${event.from} → ${event.to}: ${
                (event.task || '').substring(0, 60)
              }${RESET}`
            )
          }
        } catch { /* ignore malformed SSE frames */ }
      }
    }

    console.log('\n')
  } catch (error) {
    console.log(`${RED}Connection error: ${error}${RESET}`)
    console.log(`${DIM}Is Aiden running? Start the desktop app first.${RESET}`)
  }
}

function handleCommand(cmd: string): boolean {
  const command = cmd.trim().toLowerCase()

  if (command === '/help') {
    console.log(`
${BOLD}Commands:${RESET}
  /help          Show this help
  /status        Check Aiden health
  /models        Show active models
  /memory        Show memory stats
  /goals         Show active goals
  /skills        List loaded skills
  /export        Export conversation
  /clear         Clear screen
  /quit          Exit

${BOLD}Just type naturally:${RESET}
  "Research top AI tools"
  "Check NIFTY price"
  "Write a Python script for..."
  "Open YouTube and play lofi"
`)
    return true
  }

  if (command === '/status') {
    fetch(`${API_BASE}/api/debug/health`)
      .then(r => r.json())
      .then((h: any) => {
        console.log(`
${GREEN}✓ Aiden Online${RESET}
  Uptime:   ${Math.floor(h.uptime / 60)}m
  RAM:      ${Math.round((h.memory?.heapUsed || 0) / 1024 / 1024)}MB
  Ollama:   ${h.ollama || 'unknown'}
  Sessions: ${h.workspace?.sessions || 0}
  Memories: ${h.workspace?.memories || 0}
`)
      })
      .catch(() => console.log(`${RED}Cannot reach Aiden${RESET}`))
    return true
  }

  if (command === '/models') {
    fetch(`${API_BASE}/api/debug/models`)
      .then(r => r.json())
      .then((m: any) => {
        console.log(`
${BOLD}Active Models:${RESET}
  Provider: ${m.activeProvider || m.activeModel || 'unknown'}
  Cloud:    ${(m.providers || []).join(', ') || 'none'}
  Local:    ${(m.ollamaModels || []).join(', ') || 'none'}
`)
      })
      .catch(() => console.log(`${RED}Cannot reach Aiden${RESET}`))
    return true
  }

  if (command === '/memory') {
    fetch(`${API_BASE}/api/memories`)
      .then(r => r.json())
      .then((m: any) => {
        const count = Array.isArray(m) ? m.length : (m.total || 0)
        console.log(`${DIM}Memories: ${count}${RESET}`)
      })
      .catch(() => {})
    return true
  }

  if (command === '/goals') {
    fetch(`${API_BASE}/api/goals`)
      .then(r => r.json())
      .then((g: any) => {
        const goals = Array.isArray(g) ? g : (g.goals || [])
        if (goals.length > 0) {
          goals.forEach((goal: any) =>
            console.log(`  ${goal.status === 'active' ? '◉' : '○'} ${goal.title}`)
          )
        } else {
          console.log(`${DIM}No active goals${RESET}`)
        }
      })
      .catch(() => {})
    return true
  }

  if (command === '/skills') {
    fetch(`${API_BASE}/api/skills`)
      .then(r => r.json())
      .then((skills: any[]) => {
        console.log(`\n${BOLD}Skills (${skills.length}):${RESET}`)
        skills.forEach(s =>
          console.log(`  ${s.enabled ? '✓' : '✗'} ${s.name} ${DIM}(${s.source})${RESET}`)
        )
        console.log()
      })
      .catch(() => {})
    return true
  }

  if (command === '/export') {
    fetch(`${API_BASE}/api/export/conversation?format=json`)
      .then(r => r.json())
      .then((data: any) => {
        const count = data.messageCount || data.messages?.length || 0
        console.log(`${DIM}Exported ${count} messages${RESET}`)
      })
      .catch(() => console.log(`${RED}Export failed${RESET}`))
    return true
  }

  if (command === '/clear') {
    console.clear()
    printBanner()
    return true
  }

  if (command === '/quit' || command === '/exit' || command === '/q') {
    console.log(`${DIM}Goodbye.${RESET}`)
    process.exit(0)
  }

  return false
}

async function main(): Promise<void> {
  printBanner()

  const serverOk = await checkServer()
  if (!serverOk) {
    console.log(
      `${RED}Cannot connect to Aiden at ${API_BASE}${RESET}`
    )
    console.log(
      `${DIM}Start the Aiden desktop app first, or set AIDEN_API env var.${RESET}\n`
    )
    process.exit(1)
  }

  console.log(`${GREEN}✓ Connected to Aiden${RESET}\n`)

  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    prompt: `${DIM}you${RESET} ${BOLD}›${RESET} `,
  })

  rl.prompt()

  rl.on('line', async (line: string) => {
    const input = line.trim()
    if (!input) {
      rl.prompt()
      return
    }

    if (input.startsWith('/')) {
      const handled = handleCommand(input)
      if (handled) {
        setTimeout(() => rl.prompt(), 500)
        return
      }
    }

    await streamChat(input)
    rl.prompt()
  })

  rl.on('close', () => {
    console.log(`\n${DIM}Goodbye.${RESET}`)
    process.exit(0)
  })
}

main()
