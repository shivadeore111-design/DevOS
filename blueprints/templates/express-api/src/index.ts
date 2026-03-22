import express from 'express'
import cors    from 'cors'

const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())

// ── Routes ─────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/items', (_req, res) => {
  res.json({ items: [{ id: 1, name: 'Item One' }, { id: 2, name: 'Item Two' }] })
})

app.post('/api/items', (req, res) => {
  const { name } = req.body as { name?: string }
  if (!name) return res.status(400).json({ error: 'name is required' })
  res.status(201).json({ id: Date.now(), name })
})

// ── Start ──────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 PROJECT_NAME API running on http://localhost:${PORT}`)
  console.log(`   GET  /health     → { status: "ok" }`)
  console.log(`   GET  /api/items  → list items`)
  console.log(`   POST /api/items  → create item\n`)
})

export default app
