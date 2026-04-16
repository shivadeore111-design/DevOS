// Generate a changelog from git log and save it
const status = await aiden.git.status()
console.log('Git status:\n' + status)

const log = await aiden.shell.exec('git log --oneline -20')
const changelog = `# Recent Commits\n\n${log.stdout}`
await aiden.file.write('./CHANGELOG_RECENT.md', changelog)
console.log('✓ Saved CHANGELOG_RECENT.md')
