// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// personal/morningBriefing.ts — LLM-generated morning briefing

import * as http            from 'http'
import { userProfile }      from '../personality/userProfile'
import { lifeTimeline }     from './lifeTimeline'
import { goalStore }        from '../goals/goalStore'
import { wrapWithPersona }  from '../personality/devosPersonality'

export class MorningBriefing {
  async generate(): Promise<string> {
    const profile    = userProfile.loadProfile()
    const timeline   = lifeTimeline.getTimeline().slice(-10)
    const activeGoals = goalStore.listGoals('active').length

    const summary = {
      activeGoals,
      recentActivity: timeline.map(e => e.action).slice(0, 5),
      name:           profile?.name || 'there',
    }

    const { system, user } = wrapWithPersona(
      `Write a morning briefing for ${summary.name}. Active goals: ${summary.activeGoals}. Recent activity: ${summary.recentActivity.join(', ') || 'none'}. Keep it to 3-4 sentences, conversational, end with one suggestion.`
    )

    return new Promise((resolve) => {
      const body = JSON.stringify({ model: 'mistral-nemo:12b', prompt: user, system, stream: false })
      const req  = http.request(
        { hostname: 'localhost', port: 11434, path: '/api/generate', method: 'POST' },
        (res) => {
          let data = ''
          res.on('data', (c) => data += c)
          res.on('end', () => {
            try   { resolve(JSON.parse(data).response || 'Good morning. DevOS is ready.') }
            catch { resolve('Good morning. DevOS is ready.') }
          })
        }
      )
      req.on('error', () => resolve('Good morning. DevOS is ready — Ollama offline.'))
      req.write(body)
      req.end()
    })
  }
}

export const morningBriefing = new MorningBriefing()
