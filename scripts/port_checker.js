// Check if common dev ports are in use
const PORTS = [3000, 4200, 5173, 8080, 8443, 9000]

console.log('Checking dev ports...\n')
for (const port of PORTS) {
  const r = await aiden.shell.exec(`netstat -ano | findstr :${port}`)
  const inUse = r.stdout.trim().length > 0
  const status = inUse ? '● IN USE' : '○ free'
  console.log(`  ${String(port).padEnd(6)} ${status}`)
  if (inUse) {
    const lines = r.stdout.trim().split('\n').slice(0, 2)
    for (const l of lines) console.log(`         ${l.trim()}`)
  }
}
