// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/slashAsTool.ts — Phase 3: Slash commands mirrored as agent tools.
//
// Exposes read-only informational slash commands as callable tools so the
// planner can query system state without the user typing them manually.
// State-mutating commands (/new, /reset, /model, etc.) are NOT exposed.
//
// Call registerSlashMirrorTools() once at server startup.

import fs   from 'fs'
import path from 'path'
import os   from 'os'

import { registerExternalTool }  from './toolRegistry'
import { conversationMemory }    from './conversationMemory'
import { learningMemory }        from './learningMemory'
import { skillLoader }           from './skillLoader'
import { costTracker }           from './costTracker'
import { getActiveGoalsSummary } from './goalTracker'
import { loadConfig }            from '../providers/index'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip ANSI escape codes so the LLM gets plain text. */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
}

const LESSONS_PATH = path.join(process.cwd(), 'workspace', 'LESSONS.md')

function loadLessonsText(): string {
  try {
    if (fs.existsSync(LESSONS_PATH)) return fs.readFileSync(LESSONS_PATH, 'utf-8').trim()
  } catch {}
  return ''
}

// ── Mirror tool implementations ───────────────────────────────────────────────

async function toolStatus(_: any): Promise<{ success: boolean; output: string }> {
  const uptimeSec = Math.floor(process.uptime())
  const ramMB     = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  const sessions  = conversationMemory.getSessions().length
  const lines = [
    'SYSTEM STATUS',
    `Uptime       ${Math.floor(uptimeSec / 60)}m ${uptimeSec % 60}s`,
    `RAM          ${ramMB} MB`,
    `Sessions     ${sessions}`,
    `Platform     ${os.platform()} ${os.arch()}`,
    `Node         ${process.version}`,
  ]
  return { success: true, output: lines.join('\n') }
}

async function toolAnalytics(_: any): Promise<{ success: boolean; output: string }> {
  const stats = learningMemory.getStats()
  const lines = [
    'LEARNING ANALYTICS',
    `Total tasks    ${stats.total}`,
    `Success rate   ${stats.successRate}%`,
    `Avg duration   ${stats.avgDuration}ms`,
  ]
  return { success: true, output: lines.join('\n') }
}

async function toolSpend(_: any): Promise<{ success: boolean; output: string }> {
  try {
    const summary = costTracker.getDailySummary()
    const byProvider = Object.entries(summary.byProvider || {})
      .map(([p, c]) => `  ${p}: $${(c as number).toFixed(4)}`)
      .join('\n')
    const lines = [
      `SPEND — ${summary.date}`,
      `Total   $${summary.totalUSD.toFixed(4)}`,
      `User    $${summary.userUSD.toFixed(4)}`,
      `System  $${summary.systemUSD.toFixed(4)}`,
      byProvider ? `By provider:\n${byProvider}` : '',
    ].filter(Boolean)
    return { success: true, output: lines.join('\n') }
  } catch {
    return { success: true, output: 'Spend data unavailable.' }
  }
}

async function toolMemoryShow(_: any): Promise<{ success: boolean; output: string }> {
  const facts   = conversationMemory.getFacts()
  const history = conversationMemory.getRecentHistory()
  const lines = [
    'MEMORY FACTS',
    facts.lastFilesCreated.length  ? `Files created : ${facts.lastFilesCreated.join(', ')}`  : '',
    facts.lastSearchQueries.length ? `Last searches : ${facts.lastSearchQueries.join(', ')}` : '',
    facts.lastToolsUsed.length     ? `Last tools    : ${facts.lastToolsUsed.join(', ')}`     : '',
    facts.mentionedEntities.length ? `Topics        : ${facts.mentionedEntities.slice(-10).join(', ')}` : '',
    '',
    `Recent exchanges: ${history.length}`,
    ...history.slice(-3).map(e =>
      e.userMessage ? `  User: ${e.userMessage.slice(0, 80)}` : ''
    ).filter(Boolean),
  ].filter(l => l !== undefined)
  return { success: true, output: lines.join('\n') }
}

async function toolLessons(_: any): Promise<{ success: boolean; output: string }> {
  const lessons = loadLessonsText()
  if (!lessons) return { success: true, output: 'No lessons recorded yet.' }
  return { success: true, output: `LESSONS (permanent failure rules):\n${lessons}` }
}

async function toolSkillsList(_: any): Promise<{ success: boolean; output: string }> {
  const skills = skillLoader.loadAll()
  if (skills.length === 0) return { success: true, output: 'No skills loaded.' }
  const lines = [
    `SKILLS (${skills.length} loaded)`,
    ...skills.map(s => `  ${s.name.padEnd(20)} ${s.description || ''}`),
  ]
  return { success: true, output: lines.join('\n') }
}

async function toolToolsList(_: any): Promise<{ success: boolean; output: string }> {
  // Import lazily to avoid circular dependency
  const { TOOLS } = await import('./toolRegistry')
  const names = Object.keys(TOOLS).sort()
  return { success: true, output: `TOOLS (${names.length}):\n${names.join(', ')}` }
}

async function toolWhoami(_: any): Promise<{ success: boolean; output: string }> {
  const cfg      = loadConfig()
  const userName = (cfg as any).userName || process.env.USERNAME || os.userInfo().username || 'User'
  const homeDir  = os.homedir()
  const lines = [
    'USER PROFILE',
    `Name         ${userName}`,
    `Home         ${homeDir}`,
    `Platform     ${os.platform()}`,
  ]
  return { success: true, output: lines.join('\n') }
}

async function toolChannelsStatus(_: any): Promise<{ success: boolean; output: string }> {
  try {
    const cfg  = loadConfig()
    const apis = (cfg as any)?.providers?.apis || []
    const lines = [
      'PROVIDER CHANNELS',
      ...apis.map((api: any) => {
        const key    = String(api.key || '')
        const hasKey = key.startsWith('env:')
          ? !!(process.env[key.replace('env:', '')] || '').trim()
          : key.trim().length > 0
        const status = !api.enabled ? 'disabled' : api.rateLimited ? 'rate-limited' : hasKey ? 'active' : 'no key'
        return `  ${(api.name || api.provider || '').padEnd(20)} ${api.model || ''}  [${status}]`
      }),
    ]
    return { success: true, output: lines.join('\n') }
  } catch {
    return { success: true, output: 'Provider status unavailable.' }
  }
}

// ── Goals tool ────────────────────────────────────────────────────────────────

async function toolGoals(_: any): Promise<{ success: boolean; output: string }> {
  const summary = getActiveGoalsSummary()
  return { success: true, output: summary ? `ACTIVE GOALS:\n${summary}` : 'No active goals.' }
}

// ── Registration ──────────────────────────────────────────────────────────────

const MIRROR_TOOLS: Array<{
  name:        string
  description: string
  fn:          (input: any) => Promise<{ success: boolean; output: string }>
}> = [
  { name: 'status',          description: 'Show system status: uptime, RAM, session count',           fn: toolStatus         },
  { name: 'analytics',       description: 'Show learning analytics: task count, success rate',        fn: toolAnalytics      },
  { name: 'spend',           description: 'Show today\'s token cost and spend by provider',           fn: toolSpend          },
  { name: 'memory_show',     description: 'Show conversation memory facts and recent history',        fn: toolMemoryShow     },
  { name: 'lessons',         description: 'Show permanent failure rules learned from past tasks',     fn: toolLessons        },
  { name: 'skills_list',     description: 'List all loaded skills with descriptions',                 fn: toolSkillsList     },
  { name: 'tools_list',      description: 'List all registered tool names',                           fn: toolToolsList      },
  { name: 'whoami',          description: 'Show current user profile: name, home dir, platform',     fn: toolWhoami         },
  { name: 'channels_status', description: 'Show provider channel status: active, disabled, no-key',  fn: toolChannelsStatus },
  { name: 'goals',           description: 'Show currently active goals',                             fn: toolGoals          },
]

/** Names of all slash mirror tools — used to add them to VALID_TOOLS / ALLOWED_TOOLS. */
export const SLASH_MIRROR_TOOL_NAMES = MIRROR_TOOLS.map(t => t.name)

/**
 * Register all read-only slash mirror tools into the tool registry.
 * Call once at server startup.
 */
export function registerSlashMirrorTools(): void {
  for (const { name, description, fn } of MIRROR_TOOLS) {
    registerExternalTool(name, fn, 'slash-mirror')
    console.log(`[SlashAsTool] Registered mirror tool: ${name} — ${description}`)
  }
}
