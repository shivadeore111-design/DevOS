// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// personal/morningBriefingV2.ts — SQLite-backed morning briefing

import * as http              from 'http'
import { persistentMemory }  from '../memory/persistentMemory'
import { goalStore }         from '../goals/goalStore'
import { wrapWithPersona }   from '../personality/devosPersonality'

export class MorningBriefingV2 {
  async generate(): Promise<string> {
    // Pull rich context from persistent memory (all async with sql.js)
    const [userFacts, recentGoals, memCtx] = await Promise.all([
      persistentMemory.getUserProfile(),
      persistentMemory.getRecentGoals(5),
      persistentMemory.buildContext(),
    ])

    // Also check live goal store for active count
    const activeGoals  = goalStore.listGoals('active').length

    const name = userFacts['name'] || 'there'

    // Build goal summary string
    const goalLines = recentGoals.length > 0
      ? recentGoals.map(g => `  [${g.status}] ${g.title} (${g.tasks_done}/${g.tasks_total} tasks)`).join('\n')
      : '  None yet.'

    const { system, user } = wrapWithPersona(
      `Write a morning briefing for ${name}.
Active goals right now: ${activeGoals}.
Recent goal history:\n${goalLines}

User context:\n${memCtx}

Keep it to 3-4 sentences, conversational and personal. Reference their real projects by name where relevant. End with one concrete suggestion for what to work on today.`
    )

    return new Promise((resolve) => {
      const body = JSON.stringify({
        model:  'mistral-nemo:12b',
        prompt: user,
        system,
        stream: false,
        options: { num_predict: 200 }
      })

      const req = http.request(
        { hostname: 'localhost', port: 11434, path: '/api/generate', method: 'POST' },
        (res) => {
          let data = ''
          res.on('data', (c) => data += c)
          res.on('end', () => {
            try   { resolve(JSON.parse(data).response || this.fallback(name, activeGoals)) }
            catch { resolve(this.fallback(name, activeGoals)) }
          })
        }
      )
      req.on('error', () => resolve(this.fallback(name, activeGoals)))
      req.setTimeout(10000, () => { req.destroy(); resolve(this.fallback(name, activeGoals)) })
      req.write(body)
      req.end()
    })
  }

  private fallback(name: string, activeGoals: number): string {
    return `Good morning, ${name}! DevOS is ready. You have ${activeGoals} active goal${activeGoals !== 1 ? 's' : ''} running. Let's build something great today.`
  }
}

export const morningBriefingV2 = new MorningBriefingV2()
