// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/passiveSkillObserver.ts — Background observer that detects
// repeated tool-call patterns and auto-drafts skills for review.
//
// Gated by: AIDEN_PASSIVE_LEARNING !== 'false'
// Throttled: 1 proposal per hour, max 5 pending at once.

import { writeSkillDraft, listPending, sanitizeSkillId } from './skillWriter'

// ── Types ─────────────────────────────────────────────────────

export interface ObservedTask {
  sessionId:   string
  userPrompt:  string
  toolCalls:   ToolCallRecord[]
  completedAt: number          // epoch ms
}

export interface ToolCallRecord {
  tool:   string
  params: Record<string, unknown>
}

// ── Rolling buffer ────────────────────────────────────────────

const BUFFER_SIZE  = 100
const MIN_SEQUENCE = 2   // min distinct tool calls in a workflow
const PATTERN_HITS = 3   // how many times pattern must recur

const taskBuffer: ObservedTask[] = []

// ── Throttle ──────────────────────────────────────────────────

let lastProposalAt = 0
const THROTTLE_MS  = 60 * 60 * 1000   // 1 hour
const MAX_PENDING  = 5

// ── Proposed set (in-memory, to avoid duplicate drafts) ───────

const proposedPatterns = new Set<string>()

// ── recordTask ────────────────────────────────────────────────
// Called by executionLoop after each successful task completion.

export function recordTask(task: ObservedTask): void {
  taskBuffer.push(task)
  if (taskBuffer.length > BUFFER_SIZE) taskBuffer.shift()
  analyzePatterns()
}

// ── analyzePatterns ───────────────────────────────────────────
// Looks for recurring multi-step tool sequences.

function analyzePatterns(): void {
  // Throttle check
  const now = Date.now()
  if (now - lastProposalAt < THROTTLE_MS) return

  // Max pending check
  try {
    const pending = listPending()
    if (pending.length >= MAX_PENDING) return
  } catch { return }

  // Extract tool sequences (multi-step only)
  const sequences = taskBuffer
    .filter(t => t.toolCalls.length >= MIN_SEQUENCE)
    .map(t => ({
      key:    sequenceKey(t.toolCalls),
      prompt: t.userPrompt,
      tools:  t.toolCalls,
    }))

  if (sequences.length < PATTERN_HITS) return

  // Count occurrences by sequence key
  const counts = new Map<string, typeof sequences[number][]>()
  for (const s of sequences) {
    const arr = counts.get(s.key) ?? []
    arr.push(s)
    counts.set(s.key, arr)
  }

  for (const [key, matches] of counts) {
    if (matches.length < PATTERN_HITS) continue
    if (proposedPatterns.has(key)) continue

    // Check prompt keyword overlap (user is doing similar things)
    const prompts = matches.map(m => m.prompt.toLowerCase().split(/\s+/))
    if (!hasKeywordOverlap(prompts)) continue

    // Draft the skill
    const tools    = matches[0].tools
    const skillName = inferSkillName(tools, matches.map(m => m.prompt))
    proposedPatterns.add(key)

    proposeDraft(skillName, tools, matches.map(m => m.prompt))
      .then(() => { lastProposalAt = Date.now() })
      .catch(e => {
        // Remove from proposed set so it can retry later
        proposedPatterns.delete(key)
        console.debug('[PassiveObserver] Draft failed:', e.message)
      })
    return  // one proposal per analyze cycle
  }
}

// ── sequenceKey ───────────────────────────────────────────────
// Creates a stable string key from a tool call sequence.
// Params are normalized to detect patterns even when values vary.

function sequenceKey(calls: ToolCallRecord[]): string {
  return calls
    .map(c => `${c.tool}(${Object.keys(c.params).sort().join(',')})`)
    .join('→')
}

// ── hasKeywordOverlap ─────────────────────────────────────────
// Returns true if prompts share ≥2 significant words.

function hasKeywordOverlap(promptWords: string[][]): boolean {
  if (promptWords.length < 2) return true
  const STOP = new Set(['the','a','an','is','are','and','or','to','for','of','in','on','with','this','that','do','can','how'])
  const firstSig = promptWords[0].filter(w => w.length > 3 && !STOP.has(w))
  return promptWords.slice(1).some(words => {
    const sig = new Set(words.filter(w => w.length > 3 && !STOP.has(w)))
    return firstSig.filter(w => sig.has(w)).length >= 2
  })
}

// ── inferSkillName ────────────────────────────────────────────
// Generates a skill name from tool sequence + user prompts.

function inferSkillName(tools: ToolCallRecord[], prompts: string[]): string {
  const toolNames = [...new Set(tools.map(t => t.tool))]
  // Pick the first two meaningful words from the most common prompt
  const words = prompts[0]
    .replace(/[^a-z0-9 ]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 3)
  const base = words.length >= 2
    ? words.join(' ')
    : toolNames.slice(0, 2).join(' + ')
  return base.charAt(0).toUpperCase() + base.slice(1) + ' Workflow'
}

// ── templateParams ────────────────────────────────────────────
// Replaces highly-variable values with <placeholder> tokens.

function templateParams(tools: ToolCallRecord[]): string {
  return tools
    .map(c => {
      const params = Object.entries(c.params)
        .map(([k, v]) => {
          const str = String(v)
          // Long/URL/path values → placeholder
          if (str.length > 40 || /^https?:\/\/|[\/\\]/.test(str)) {
            return `${k}: <${k}>`
          }
          return `${k}: ${str}`
        })
        .join(', ')
      return `  - ${c.tool}(${params})`
    })
    .join('\n')
}

// ── proposeDraft ──────────────────────────────────────────────
// Writes a skill draft and logs a CLI notification.

async function proposeDraft(
  name: string,
  tools: ToolCallRecord[],
  prompts: string[],
): Promise<void> {
  const description = `Auto-detected workflow: ${tools.map(t => t.tool).join(' → ')}`
  const toolSection = templateParams(tools)
  const examplePrompts = prompts.slice(0, 3)
    .map(p => `- "${p.slice(0, 80)}"`)
    .join('\n')

  const content = `# ${name}

This workflow was automatically detected by Aiden's passive skill observer.
Review and edit before enabling.

## Tool Sequence

${toolSection}

## Example Prompts That Triggered This Pattern

${examplePrompts}

## Usage

When the user asks for a task similar to the examples above, follow the tool
sequence defined here. Adapt parameters as appropriate for the specific request.
`

  await writeSkillDraft({
    name,
    description,
    category:  'productivity',
    platform:  'any',
    tags:      [...new Set(tools.map(t => t.tool))].slice(0, 6),
    version:   '0.1.0',
    content,
    source:    'passive_observer',
    sourceDetails: {
      detectedAt:  new Date().toISOString(),
      toolSequence: tools.map(t => t.tool),
      samplePrompts: prompts.slice(0, 3),
    },
  }, 'pending')

  const id = sanitizeSkillId(name)
  // Notify via stdout so the CLI can surface it
  console.log(`\n  💡 Aiden proposed a new skill: ${name}`)
  console.log(`     Review: /skills review ${id}\n`)
}

// ── start ─────────────────────────────────────────────────────
// Wired by api/server.ts. No-op if AIDEN_PASSIVE_LEARNING=false.

export function start(): void {
  if (process.env.AIDEN_PASSIVE_LEARNING === 'false') {
    console.log('[PassiveObserver] Disabled via AIDEN_PASSIVE_LEARNING=false')
    return
  }
  console.log('[PassiveObserver] Started — watching for repeated tool patterns')
}

// ── getBuffer ─────────────────────────────────────────────────
// Exposed for testing.

export function getBuffer(): ObservedTask[] {
  return [...taskBuffer]
}
