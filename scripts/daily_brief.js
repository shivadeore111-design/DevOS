// Daily briefing — top news + market summary → desktop notification
const briefing = await aiden.data.briefing()
const lines = briefing.split('\n').slice(0, 5).join('\n')
await aiden.system.notify(lines, 'Daily Brief')
console.log('✓ Daily brief sent as notification')
console.log(briefing)
