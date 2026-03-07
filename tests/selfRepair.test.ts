import { describe, it, expect } from 'vitest'
import { SelfRepair } from '../skills/debug/selfRepair'

describe('SelfRepair', () => {
  it('succeeds on first try', async () => {
    const repair = new SelfRepair()
    const result = await repair.execute(async () => 'success')
    expect(result).toBe('success')
  })

  it('retries on failure and eventually succeeds', async () => {
    const repair = new SelfRepair()
    let attempts = 0
    const result = await repair.execute(async () => {
      attempts++
      if (attempts < 3) throw new Error('not yet')
      return 'fixed'
    })
    expect(result).toBe('fixed')
    expect(attempts).toBe(3)
  })

  it('throws after max retries', async () => {
    const repair = new SelfRepair()
    await expect(
      repair.execute(async () => { throw new Error('always fails') }, { maxRetries: 2 })
    ).rejects.toThrow()
  })
})
