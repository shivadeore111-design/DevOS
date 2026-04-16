// Deep-research a topic and save to a markdown file
// Usage: edit the TOPIC below before running
const TOPIC = 'latest developments in AI agents 2026'
const OUTPUT = '/tmp/research.md'

console.log(`Researching: ${TOPIC}`)
const result = await aiden.web.research(TOPIC)
const md = `# Research: ${TOPIC}\n\n_Generated ${new Date().toISOString()}_\n\n${result}`
await aiden.file.write(OUTPUT, md)
console.log(`✓ Saved to ${OUTPUT}`)
