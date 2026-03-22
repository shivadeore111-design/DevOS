// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// cli/installer.ts — DevOS setup wizard

import * as fs    from 'fs'
import * as path  from 'path'
import * as http  from 'http'
import { execSync } from 'child_process'

export async function runInstaller(): Promise<void> {
  console.log('\n╔══════════════════════════════════╗')
  console.log('║         DevOS Installer          ║')
  console.log('╚══════════════════════════════════╝\n')

  const steps: { label: string; fn: () => void | Promise<void> }[] = [
    { label: 'Checking Node version',    fn: checkNode      },
    { label: 'Creating workspace',       fn: createWorkspace },
    { label: 'Installing dependencies',  fn: installDeps    },
    { label: 'Creating default config',  fn: createConfig   },
    { label: 'Checking Ollama',          fn: checkOllama    },
  ]

  for (const step of steps) {
    process.stdout.write(`  ⏳ ${step.label}...`)
    try {
      await step.fn()
      process.stdout.write(`\r  ✅ ${step.label}               \n`)
    } catch (e: any) {
      process.stdout.write(`\r  ⚠️  ${step.label}: ${e.message}\n`)
    }
  }

  console.log('\n╔══════════════════════════════════╗')
  console.log('║       DevOS Ready! 🚀            ║')
  console.log('╚══════════════════════════════════╝')
  console.log('\n  Start DevOS:')
  console.log('    npx ts-node index.ts serve')
  console.log('\n  Open Mission Control:')
  console.log('    npx ts-node index.ts ui')
  console.log('\n  Run your first goal:')
  console.log('    npx ts-node index.ts goal "Build a REST API" "Express with auth"\n')
}

function checkNode(): void {
  const version = process.version
  const major   = parseInt(version.slice(1).split('.')[0], 10)
  if (major < 18) throw new Error(`Node 18+ required, found ${version}`)
}

function createWorkspace(): void {
  const dirs = [
    'workspace', 'workspace/tasks', 'workspace/reports',
    'artifacts', 'logs', 'config/pilots', 'config/blueprints',
    'knowledge', 'memory', 'skills/generated', 'research',
  ]
  for (const d of dirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  }
}

function installDeps(): void {
  if (!fs.existsSync('node_modules')) {
    execSync('npm install', { stdio: 'pipe' })
  }
}

function createConfig(): void {
  const apiConfig = path.join('config', 'api.json')
  if (!fs.existsSync(apiConfig)) {
    fs.writeFileSync(apiConfig, JSON.stringify({
      host:          '127.0.0.1',
      port:          4200,
      apiKey:        '',
      corsOrigins:   ['*'],
      rateLimit:     { windowMs: 60000, maxRequests: 100 },
      enableSwagger: true,
      roles: {
        admin:        ['*'],
        automation:   ['POST /api/goals', 'GET /api/goals'],
        'read-only':  ['GET /api/system/health'],
      },
    }, null, 2))
  }

  // Also ensure integrations.json exists
  const intConfig = path.join('config', 'integrations.json')
  if (!fs.existsSync(intConfig)) {
    fs.writeFileSync(intConfig, JSON.stringify({
      github:        { token: '', defaultRepo: '' },
      slack:         { webhookUrl: '', defaultChannel: '#devos-alerts' },
      vercel:        { token: '', teamId: '' },
      railway:       { token: '' },
      notifications: { onGoalComplete: false, onGoalFailed: true, onEmergencyStop: true },
    }, null, 2))
  }
}

function checkOllama(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 11434, path: '/api/tags', method: 'GET' },
      res => {
        if (res.statusCode === 200) resolve()
        else reject(new Error('Ollama not running — start with: ollama serve'))
      }
    )
    req.on('error', () => reject(new Error('Ollama not found — install from ollama.ai')))
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('Ollama timeout')) })
    req.end()
  })
}
