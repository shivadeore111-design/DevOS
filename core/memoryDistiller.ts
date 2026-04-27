// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/memoryDistiller.ts — Session-end memory distillation (N+27).
// After a session ends (exit, idle, or SSE close), distils the full
// conversation into 5-15 compact facts via LLM and persists them
// into semantic memory. Next session they surface via BM25 search
// without re-loading any conversation history.

import fs   from 'fs'
import path from 'path'
import { conversationMemory }           from './conversationMemory'
import { semanticMemory }               from './semanticMemory'
import { callLLM }                      from './agentLoop'
import { getModelForTask }              from '../providers/router'

// ── Types ──────────────────────────────────────────────────────

export interface DistillResult {
  factsExtracted: number
  facts:          string[]
  skipped?:       string   // reason if skipped
}

// ── Constants ─────────────────────────────────────────────────

const DISTILL_PROMPT = `You are a memory distillation system. You will be given a conversation transcript.
Extract 5 to 15 concise, self-contained facts that would be useful to know in a future session.
Focus on:
- Files created, modified, or deleted (include full paths)
- Decisions made and the reasons behind them
- Problems solved and the approach that worked
- User preferences observed (style, tools, workflows)
- Important entities: repos, APIs, services, credentials locations
- Tasks completed and their outcomes

Output ONLY a plain list, one fact per line, each starting with "- ".
No headings, no explanations, no blank lines between facts.
Facts must be self-contained (understandable without the conversation).
Maximum 15 facts. Minimum 5 facts if the conversation has meaningful content.`

const MAX_TRANSCRIPT_CHARS = 32_000  // ~8k tokens
const DISTILL_MARKER_PATH  = path.join(process.cwd(), 'workspace', 'distilled_sessions.json')

// ── distillSession ────────────────────────────────────────────
// Main entry point. Reads exchanges for the given sessionId,
// calls LLM to extract facts, persists to semantic memory.
// Never throws — all errors are logged and swallowed.

export async function distillSession(
  sessionId: string,
  timeoutMs = 15_000,
): Promise<DistillResult> {
  try {
    // Load the correct session
    conversationMemory.setSession(sessionId)
    const exchanges = (conversationMemory as any).state?.exchanges as Array<{
      userMessage: string
      aiReply:     string
      timestamp?:  number
    }> | undefined

    if (!exchanges || exchanges.length < 3) {
      return { factsExtracted: 0, facts: [], skipped: 'too few exchanges' }
    }

    // Check if already distilled
    if (isAlreadyDistilled(sessionId)) {
      return { factsExtracted: 0, facts: [], skipped: 'already distilled' }
    }

    // Build transcript
    let transcript = ''
    for (const ex of exchanges) {
      const turn = `User: ${ex.userMessage}\nAssistant: ${ex.aiReply}\n\n`
      if (transcript.length + turn.length > MAX_TRANSCRIPT_CHARS) break
      transcript += turn
    }

    if (!transcript.trim()) {
      return { factsExtracted: 0, facts: [], skipped: 'empty transcript' }
    }

    // Call LLM with timeout
    const tier = getModelForTask('planner')
    const prompt = `${DISTILL_PROMPT}\n\n---TRANSCRIPT---\n${transcript}`

    const raw = await Promise.race([
      callLLM(prompt, tier.apiKey, tier.model, tier.providerName),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('distill timeout')), timeoutMs)
      ),
    ])

    // Parse bullet lines
    const facts = (raw || '')
      .split('\n')
      .map(l => l.replace(/^[-*•]\s*/, '').trim())
      .filter(l => l.length > 10)
      .slice(0, 15)

    if (facts.length === 0) {
      return { factsExtracted: 0, facts: [], skipped: 'no facts parsed' }
    }

    // Persist each fact to semantic memory
    for (const fact of facts) {
      semanticMemory.add(fact, 'fact', ['distilled', sessionId])
    }

    // N+33: update structured Honcho user profile from distilled facts (non-blocking)
    import('./userProfile').then(({ updateProfile }) => updateProfile(facts)).catch(() => {})

    // Mark session as distilled
    markDistilled(sessionId)

    console.log(`[MemoryDistiller] Distilled ${facts.length} facts from session ${sessionId}`)
    return { factsExtracted: facts.length, facts }

  } catch (err: any) {
    console.warn('[MemoryDistiller] distillSession failed (non-fatal):', err?.message)
    return { factsExtracted: 0, facts: [], skipped: err?.message ?? 'unknown error' }
  }
}

// ── distillAllActiveSessions ──────────────────────────────────
// Distils every known session — used on SIGINT/SIGTERM so no
// session is lost when the server shuts down.

export async function distillAllActiveSessions(timeoutMs = 8_000): Promise<void> {
  try {
    const sessions = conversationMemory.getSessions()
    await Promise.allSettled(
      sessions.map(sid => distillSession(sid, timeoutMs))
    )
  } catch (err: any) {
    console.warn('[MemoryDistiller] distillAllActiveSessions failed:', err?.message)
  }
}

// ── Distilled-session tracking ────────────────────────────────

function loadDistilledSet(): Set<string> {
  try {
    if (fs.existsSync(DISTILL_MARKER_PATH)) {
      return new Set(JSON.parse(fs.readFileSync(DISTILL_MARKER_PATH, 'utf-8')) as string[])
    }
  } catch {}
  return new Set()
}

function isAlreadyDistilled(sessionId: string): boolean {
  return loadDistilledSet().has(sessionId)
}

function markDistilled(sessionId: string): void {
  try {
    const set = loadDistilledSet()
    set.add(sessionId)
    fs.mkdirSync(path.dirname(DISTILL_MARKER_PATH), { recursive: true })
    fs.writeFileSync(DISTILL_MARKER_PATH, JSON.stringify([...set], null, 2) + '\n', 'utf-8')
  } catch {}
}
