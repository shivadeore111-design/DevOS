// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/conversationMemory.ts — Cross-session conversation memory.
// Tracks exchanges, extracts facts, resolves pronouns/references,
// and provides context injection for the planner.

import fs   from 'fs'
import path from 'path'

// ── Types ──────────────────────────────────────────────────────

export interface Exchange {
  id:          string
  userMessage: string
  aiReply:     string
  timestamp:   number
  toolsUsed:   string[]
  filesCreated: string[]
  searchQueries: string[]
  planId?:     string
}

export interface MemoryFacts {
  lastFilesCreated:  string[]
  lastSearchQueries: string[]
  lastToolsUsed:     string[]
  lastPlanId?:       string
  mentionedEntities: string[]   // names, topics, files mentioned across session
  preferredPaths:    string[]   // file paths user has used/referenced
}

export interface ConversationState {
  exchanges:  Exchange[]
  facts:      MemoryFacts
  sessionId:  string
  updatedAt:  number
}

const MEMORY_PATH = path.join(process.cwd(), 'workspace', 'conversation.json')

// ── ConversationMemory ─────────────────────────────────────────

export class ConversationMemory {
  private state: ConversationState

  constructor() {
    this.state = this.load()
  }

  // ── Persistence ──────────────────────────────────────────────

  private load(): ConversationState {
    try {
      if (fs.existsSync(MEMORY_PATH)) {
        const raw = fs.readFileSync(MEMORY_PATH, 'utf-8')
        return JSON.parse(raw) as ConversationState
      }
    } catch {}
    return this.fresh()
  }

  private fresh(): ConversationState {
    return {
      exchanges: [],
      facts: {
        lastFilesCreated:  [],
        lastSearchQueries: [],
        lastToolsUsed:     [],
        mentionedEntities: [],
        preferredPaths:    [],
      },
      sessionId: `session_${Date.now()}`,
      updatedAt: Date.now(),
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(MEMORY_PATH)
      fs.mkdirSync(dir, { recursive: true })
      const tmp = MEMORY_PATH + '.tmp'
      this.state.updatedAt = Date.now()
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2))
      fs.renameSync(tmp, MEMORY_PATH)
    } catch (e: any) {
      console.error('[ConversationMemory] Save failed:', e.message)
    }
  }

  // ── Add messages ─────────────────────────────────────────────

  addUserMessage(message: string): string {
    // Return resolved version (with references replaced)
    return this.resolveReferences(message)
  }

  addAssistantMessage(
    reply:    string,
    metadata: {
      toolsUsed?:    string[]
      filesCreated?: string[]
      searchQueries?: string[]
      planId?:       string
    } = {},
  ): void {
    const lastExchange = this.state.exchanges[this.state.exchanges.length - 1]

    if (lastExchange && !lastExchange.aiReply) {
      // Fill in the reply on the most recent exchange
      lastExchange.aiReply      = reply.slice(0, 2000)
      lastExchange.toolsUsed    = metadata.toolsUsed    || []
      lastExchange.filesCreated = metadata.filesCreated || []
      lastExchange.searchQueries = metadata.searchQueries || []
      lastExchange.planId       = metadata.planId
    } else {
      // Create a new exchange with no user message (edge case)
      const ex: Exchange = {
        id:            `ex_${Date.now()}`,
        userMessage:   '',
        aiReply:       reply.slice(0, 2000),
        timestamp:     Date.now(),
        toolsUsed:     metadata.toolsUsed    || [],
        filesCreated:  metadata.filesCreated || [],
        searchQueries: metadata.searchQueries || [],
        planId:        metadata.planId,
      }
      this.state.exchanges.push(ex)
    }

    // Keep only last 20 exchanges
    if (this.state.exchanges.length > 20) {
      this.state.exchanges = this.state.exchanges.slice(-20)
    }

    this.save()
  }

  // Called at the start of processing each user message — records the user turn
  recordUserTurn(resolvedMessage: string): void {
    const ex: Exchange = {
      id:            `ex_${Date.now()}`,
      userMessage:   resolvedMessage.slice(0, 500),
      aiReply:       '',  // filled in by addAssistantMessage
      timestamp:     Date.now(),
      toolsUsed:     [],
      filesCreated:  [],
      searchQueries: [],
    }
    this.state.exchanges.push(ex)
    this.save()
  }

  // ── Update facts from execution ───────────────────────────────

  updateFromExecution(
    toolsUsed:     string[],
    filesCreated:  string[],
    searchQueries: string[],
    planId?:       string,
  ): void {
    const facts = this.state.facts

    // Overwrite "last" facts with latest execution results
    if (toolsUsed.length)     facts.lastToolsUsed     = toolsUsed
    if (filesCreated.length)  facts.lastFilesCreated  = filesCreated
    if (searchQueries.length) facts.lastSearchQueries = searchQueries
    if (planId)               facts.lastPlanId        = planId

    // Accumulate unique file paths the user has worked with
    for (const f of filesCreated) {
      if (!facts.preferredPaths.includes(f)) {
        facts.preferredPaths.push(f)
      }
    }
    // Keep only last 10 paths
    if (facts.preferredPaths.length > 10) {
      facts.preferredPaths = facts.preferredPaths.slice(-10)
    }

    // Extract entity names from search queries (capitalized words)
    for (const q of searchQueries) {
      const matches = q.match(/\b[A-Z][a-zA-Z]{2,}\b/g) || []
      for (const m of matches) {
        if (!facts.mentionedEntities.includes(m)) {
          facts.mentionedEntities.push(m)
        }
      }
    }
    if (facts.mentionedEntities.length > 30) {
      facts.mentionedEntities = facts.mentionedEntities.slice(-30)
    }

    this.save()
  }

  // ── Reference resolution ─────────────────────────────────────
  // Replaces "that file", "the report", "it", "that" etc. with concrete values
  // from the most recent execution context.

  resolveReferences(message: string): string {
    const facts  = this.state.facts
    let resolved = message

    // "that file" / "the file" / "that document" / "that report"
    if (/\b(that file|the file|that document|that report|that script)\b/i.test(resolved)) {
      const lastFile = facts.lastFilesCreated[facts.lastFilesCreated.length - 1]
      if (lastFile) {
        resolved = resolved.replace(
          /\b(that file|the file|that document|that report|that script)\b/gi,
          lastFile,
        )
      }
    }

    // "that search" / "those results" / "the results"
    if (/\b(that search|those results|the results|that query)\b/i.test(resolved)) {
      const lastQuery = facts.lastSearchQueries[facts.lastSearchQueries.length - 1]
      if (lastQuery) {
        resolved = resolved.replace(
          /\b(that search|those results|the results|that query)\b/gi,
          `"${lastQuery}"`,
        )
      }
    }

    return resolved
  }

  // ── Context building for planner ─────────────────────────────

  buildContext(): string {
    const facts     = this.state.facts
    const recent    = this.state.exchanges.slice(-6)  // last 6 exchanges

    const lines: string[] = []

    if (facts.lastFilesCreated.length > 0) {
      lines.push(`Recently created files: ${facts.lastFilesCreated.join(', ')}`)
    }
    if (facts.lastSearchQueries.length > 0) {
      lines.push(`Recent searches: ${facts.lastSearchQueries.join(', ')}`)
    }
    if (facts.lastToolsUsed.length > 0) {
      lines.push(`Last tools used: ${facts.lastToolsUsed.join(', ')}`)
    }
    if (facts.mentionedEntities.length > 0) {
      lines.push(`Topics discussed: ${facts.mentionedEntities.slice(-10).join(', ')}`)
    }
    if (facts.preferredPaths.length > 0) {
      lines.push(`User file paths: ${facts.preferredPaths.slice(-5).join(', ')}`)
    }

    if (recent.length > 0) {
      lines.push('')
      lines.push('Recent exchanges:')
      for (const ex of recent) {
        if (ex.userMessage) lines.push(`  User: ${ex.userMessage.slice(0, 150)}`)
        if (ex.aiReply)     lines.push(`  Aiden: ${ex.aiReply.slice(0, 100)}`)
      }
    }

    return lines.join('\n')
  }

  // ── Accessors ─────────────────────────────────────────────────

  getRecentHistory(): Exchange[] {
    return this.state.exchanges.slice(-10)
  }

  getFacts(): MemoryFacts {
    return this.state.facts
  }

  // ── Clear ─────────────────────────────────────────────────────

  clear(): void {
    this.state = this.fresh()
    this.save()
  }
}

export const conversationMemory = new ConversationMemory()
