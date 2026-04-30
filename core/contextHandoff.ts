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

  return [
    '[PROTECTED CONTEXT — AUTHORITATIVE, REFRESHED THIS TURN]',
    '',
    sections.join('\n\n'),
    '',
    '[END PROTECTED CONTEXT]',
  ].join('\n')
}
