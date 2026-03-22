import { describe, it, expect } from 'vitest'
import { SkillMemory } from '../skills/skillMemory'

describe('SkillMemory', () => {
  it('records a successful execution', async () => {
    const memory = new SkillMemory()
    await memory.record({ skillName: 'testSkill', success: true, durationMs: 100 })
    const stats = await memory.getStats('testSkill')
    expect(stats).toBeDefined()
    expect(stats?.successRate).toBeGreaterThan(0)
  })

  it('returns undefined for unknown skill', async () => {
    const memory = new SkillMemory()
    const stats = await memory.getStats('nonexistentSkill')
    expect(stats).toBeUndefined()
  })
})
