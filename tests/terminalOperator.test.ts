import { describe, it, expect } from 'vitest'
import { TerminalOperator } from '../skills/system/terminalOperator'

describe('TerminalOperator', () => {
  it('executes a simple command successfully', async () => {
    const terminal = new TerminalOperator()
    const result = await terminal.execute('echo hello')
    expect(result.success).toBe(true)
    expect(result.stdout.trim()).toBe('hello')
    expect(result.exitCode).toBe(0)
  })

  it('handles invalid commands gracefully', async () => {
    const terminal = new TerminalOperator()
    const result = await terminal.execute('notacommand_xyz')
    expect(result.success).toBe(false)
  })

  it('respects timeout', async () => {
    const terminal = new TerminalOperator()
    const result = await terminal.execute('ping -n 10 127.0.0.1', { timeout: 1000 })
    expect(result.success).toBe(false)
  })
})
