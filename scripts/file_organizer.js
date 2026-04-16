// List a directory and report file count by extension
const DIR = process.env.ORGANIZE_DIR || 'C:/Users/' + (await aiden.shell.exec('echo %USERNAME%')).stdout.trim()

console.log(`Scanning: ${DIR}`)
const files = await aiden.file.list(DIR)
const byExt = {}
for (const f of files) {
  const ext = f.includes('.') ? f.split('.').pop().toLowerCase() : '(none)'
  byExt[ext] = (byExt[ext] || 0) + 1
}
const sorted = Object.entries(byExt).sort((a, b) => b[1] - a[1])
console.log('\nFiles by extension:')
for (const [ext, count] of sorted) {
  console.log(`  .${ext.padEnd(12)} ${count}`)
}
