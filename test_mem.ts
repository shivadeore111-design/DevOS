import { persistentMemory } from './memory/persistentMemory'
async function test() {
  await new Promise(r => setTimeout(r, 600))
  const profile = await persistentMemory.getUserProfile()
  console.log('name:', profile.name)
  const ctx = await persistentMemory.buildContext()
  console.log(ctx.split('\n').slice(0,6).join('\n'))
  const stats = await persistentMemory.getStats()
  console.log('stats:', JSON.stringify(stats))
}
test().catch(console.error)
