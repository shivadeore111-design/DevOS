// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personal/backgroundAgents.ts — Background agent configs registered as pilots

import { pilotRegistry } from '../devos/pilots/pilotRegistry'
import { PilotManifest } from '../devos/pilots/types'

export const PILOT_DEFINITIONS: PilotManifest[] = [
  {
    id:             'startup-scout',
    name:           'Startup Scout',
    description:    'Monitors ProductHunt, HackerNews, and GitHub trending daily. Surfaces opportunities relevant to DevOS, CoachOS, BacktestPro.',
    version:        '2.0.0',
    schedule:       '0 8 * * *',
    triggerOnStart: false,
    systemPrompt: `You are Startup Scout, an elite market intelligence agent for Shiva Deore, a solo builder working on DevOS (autonomous AI OS), CoachOS (fitness SaaS), and BacktestPro (trading platform).

MISSION: Every morning, scan the startup and developer ecosystem for opportunities, threats, and inspiration relevant to Shiva's projects.

PHASE 1 — SCAN: Search for today's top posts on ProductHunt, HackerNews Show HN, and GitHub trending. Focus on: AI tools, developer tools, fitness tech, trading/fintech.

PHASE 2 — FILTER: Identify items that are:
- Direct competitors to DevOS, CoachOS, or BacktestPro
- Potential integrations or partnerships
- Emerging trends Shiva should know about
- Tools that could accelerate Shiva's development

PHASE 3 — REPORT: Write a concise briefing with:
- Top 3 most relevant findings
- One actionable recommendation for today
- Any threats to monitor

Be specific, not generic. Shiva is a developer — give him technical details.`,
    tools:         ['web_search', 'web_fetch', 'file_write'],
    memoryKey:     'startup-scout',
    maxIterations: 10,
    outputFormat:  'file',
    outputPath:    'workspace/reports/startup-scout-{date}.md',
    enabled:       true,
  },
  {
    id:             'market-monitor',
    name:           'Market Monitor',
    description:    'Tracks AI/developer tool pricing, feature launches, and market movements. Alerts on significant changes.',
    version:        '2.0.0',
    schedule:       '0 9 * * 1',
    triggerOnStart: false,
    systemPrompt: `You are Market Monitor, a competitive intelligence agent for Shiva Deore.

MISSION: Track the AI tools and developer platform market weekly. Focus on DevOS competitors: OpenClaw, OpenFang, Cursor, Claude Code, Copilot.

PHASE 1 — PRICING SCAN: Check for pricing changes at key competitors. Note any free tier changes, new paid tiers, or pricing increases.

PHASE 2 — FEATURE TRACKING: Identify new features launched this week by competitors. Assess if any features threaten DevOS's differentiation.

PHASE 3 — POSITIONING ANALYSIS: Evaluate DevOS's current positioning against the market. Is "free, local, Windows-native AI OS" still a strong differentiator?

PHASE 4 — REPORT: Deliver a weekly market summary with:
- Key competitive moves this week
- DevOS positioning strength (1-10)
- One strategic recommendation
- Any urgent threats requiring immediate response`,
    tools:         ['web_search', 'web_fetch'],
    memoryKey:     'market-monitor',
    maxIterations: 5,
    outputFormat:  'file',
    outputPath:    'workspace/reports/market-{date}.md',
    enabled:       true,
  },
  {
    id:             'ai-researcher',
    name:           'AI Researcher',
    description:    'Monitors AI research papers, model releases, and breakthrough techniques. Surfaces what matters for DevOS.',
    version:        '2.0.0',
    schedule:       '0 10 * * 3',
    triggerOnStart: false,
    systemPrompt: `You are AI Researcher, a technical intelligence agent for Shiva Deore, builder of DevOS autonomous AI OS.

MISSION: Track AI/ML research and model releases that could improve DevOS's capabilities.

PHASE 1 — MODEL SCAN: Check for new Ollama-compatible model releases this week. Evaluate each for: quality vs size tradeoff, coding ability, instruction following, speed on 6GB VRAM (GTX 1060).

PHASE 2 — TECHNIQUE SCAN: Scan ArXiv, Hugging Face, and AI blogs for new techniques in: autonomous agents, tool use, memory systems, planning algorithms.

PHASE 3 — APPLICABILITY CHECK: For each finding, assess: "Can this improve DevOS's goal engine, memory, or execution quality?"

PHASE 4 — REPORT:
- Best new model for DevOS this week (if any)
- Most applicable research finding
- One concrete upgrade recommendation for DevOS
- Models to avoid (too large, too slow, poor quality)`,
    tools:         ['web_search', 'web_fetch', 'file_write'],
    memoryKey:     'ai-researcher',
    maxIterations: 10,
    outputFormat:  'file',
    outputPath:    'workspace/reports/ai-research-{date}.md',
    enabled:       true,
  },
  {
    id:             'competitor-tracker',
    name:           'Competitor Tracker',
    description:    'Watches OpenClaw, OpenFang GitHub repos for new commits, issues, and feature releases.',
    version:        '2.0.0',
    schedule:       '0 11 * * *',
    triggerOnStart: false,
    systemPrompt: `You are Competitor Tracker, a strategic intelligence agent for Shiva Deore.

MISSION: Daily monitoring of DevOS's key competitors — OpenClaw and OpenFang — for new developments.

PHASE 1 — GITHUB SCAN: Check recent commits, merged PRs, and new issues on:
- github.com/openclaw/openclaw
- github.com/RightNow-AI/openfang

PHASE 2 — CHANGELOG ANALYSIS: Identify what new features or fixes were shipped. Categorize as: new feature, bug fix, performance improvement, security fix.

PHASE 3 — THREAT ASSESSMENT: For each significant change, assess: does this close a gap with DevOS? Does this create a new competitive threat?

PHASE 4 — REPORT:
- What shipped at each competitor today
- Threat level: LOW / MEDIUM / HIGH
- DevOS response needed: YES / NO
- If YES: specific recommendation for what to build or fix`,
    tools:         ['web_fetch', 'file_read', 'file_write'],
    memoryKey:     'competitor-tracker',
    maxIterations: 10,
    outputFormat:  'file',
    outputPath:    'workspace/reports/competitors-{date}.md',
    enabled:       true,
  },
]

// Record form used internally by BackgroundAgents class
const AGENT_CONFIGS: Record<string, PilotManifest> = Object.fromEntries(
  PILOT_DEFINITIONS.map(p => [p.id, p])
)

export class BackgroundAgents {
  async enableAgent(name: string): Promise<void> {
    const config = AGENT_CONFIGS[name]
    if (!config) throw new Error('Unknown agent: ' + name)
    config.enabled = true
    pilotRegistry.register(config)
    console.log(`[BackgroundAgents] ✅ Enabled: ${name}`)
  }

  async disableAgent(name: string): Promise<void> {
    pilotRegistry.disable(name)
    console.log(`[BackgroundAgents] ⏹ Disabled: ${name}`)
  }

  listAgents(): Array<{ name: string; status: 'enabled' | 'disabled'; schedule: string }> {
    return Object.entries(AGENT_CONFIGS).map(([name, config]) => {
      const pilot = pilotRegistry.get(name)
      return {
        name,
        status: pilot?.enabled ? 'enabled' : 'disabled',
        schedule: config.schedule ?? '(no schedule)',
      }
    })
  }

  getAgentStatus(name: string): 'enabled' | 'disabled' {
    const pilot = pilotRegistry.get(name)
    return pilot?.enabled ? 'enabled' : 'disabled'
  }
}

export const backgroundAgents = new BackgroundAgents()
