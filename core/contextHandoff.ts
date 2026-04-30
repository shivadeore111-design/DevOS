import type { ProtectedContext } from './protectedContext'

export function buildProtectedContextBlock(ctx: ProtectedContext, previousHash?: string): string {
  const sections: string[] = []
  const soulUnchanged = previousHash !== undefined && ctx.hash === previousHash

  if (soulUnchanged) {
    sections.push(`Identity (SOUL.md): [unchanged from previous turn, hash: ${ctx.hash}]`)
  } else if (ctx.soul) {
    sections.push(`Identity (SOUL.md):\n${ctx.soul}`)
  }
  if (ctx.user)          sections.push(`User (USER.md):\n${ctx.user}`)
  if (ctx.goals)         sections.push(`Active Goals (GOALS.md):\n${ctx.goals}`)
  if (ctx.standingOrders)sections.push(`Standing Orders (STANDING_ORDERS.md):\n${ctx.standingOrders}`)
  if (ctx.lessons)       sections.push(`Lessons Learned (LESSONS.md):\n${ctx.lessons}`)

  if (sections.length === 0) return ''

  // C4-preview: per-turn injection decision logged to stderr
  process.stderr.write(
    `[ProtectedCtx] soul=${soulUnchanged ? 'REF' : (ctx.soul ? 'FULL' : 'EMPTY')}` +
    ` hash=${ctx.hash}` +
    ` user=${ctx.user.length}c goals=${ctx.goals.length}c` +
    ` so=${ctx.standingOrders.length}c lessons=${ctx.lessons.length}c\n`
  )

  return [
    '[PROTECTED CONTEXT — AUTHORITATIVE, REFRESHED THIS TURN]',
    '',
    sections.join('\n\n'),
    '',
    '[END PROTECTED CONTEXT]',
  ].join('\n')
}
