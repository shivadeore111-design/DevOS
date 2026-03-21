// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/doctor.ts — System health checks for DevOS

import * as fs   from 'fs'
import * as path from 'path'
import * as http from 'http'
import { execSync } from 'child_process'
import { kvCacheMetrics } from './kvCacheMetrics'

export interface CheckResult {
  name:    string
  status:  'pass' | 'warn' | 'fail'
  message: string
  fix?:    string
}

async function checkNode(): Promise<CheckResult> {
  const version = process.version
  const major   = parseInt(version.slice(1))
  return major >= 18
    ? { name: 'Node.js', status: 'pass', message: version }
    : { name: 'Node.js', status: 'fail', message: version + ' (need 18+)', fix: 'Install Node 18+ from nodejs.org' }
}

async function checkOllama(): Promise<CheckResult> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port: 11434, path: '/api/tags', method: 'GET' },
      (res) => {
        let data = ''
        res.on('data', (c) => data += c)
        res.on('end', () => {
          try {
            const tags   = JSON.parse(data)
            const models = tags.models?.map((m: any) => m.name) || []
            resolve({
              name:    'Ollama',
              status:  'pass',
              message: `Running — ${models.length} models: ${models.slice(0, 3).join(', ')}`,
            })
          } catch {
            resolve({
              name:    'Ollama',
              status:  'warn',
              message: 'Running but no models found',
              fix:     'Run: ollama pull mistral-nemo:12b',
            })
          }
        })
      },
    )
    req.on('error', () =>
      resolve({ name: 'Ollama', status: 'fail', message: 'Not running', fix: 'Run: ollama serve' }),
    )
    req.setTimeout(3000, () => {
      req.destroy()
      resolve({ name: 'Ollama', status: 'fail', message: 'Timeout', fix: 'Run: ollama serve' })
    })
    req.end()
  })
}

async function checkDocker(): Promise<CheckResult> {
  try {
    execSync('docker info', { stdio: 'pipe' })
    return { name: 'Docker', status: 'pass', message: 'Running' }
  } catch {
    return {
      name:    'Docker',
      status:  'warn',
      message: 'Not running (optional — needed for sandbox)',
      fix:     'Install Docker Desktop from docker.com',
    }
  }
}

async function checkWorkspace(): Promise<CheckResult> {
  const required = ['workspace', 'config', 'skills', 'logs']
  const missing  = required.filter((d) => !fs.existsSync(path.join(process.cwd(), d)))
  if (missing.length === 0) return { name: 'Workspace', status: 'pass', message: 'All directories present' }
  return {
    name:    'Workspace',
    status:  'warn',
    message: `Missing: ${missing.join(', ')}`,
    fix:     'Run: npx ts-node index.ts install',
  }
}

async function checkKVCache(): Promise<CheckResult> {
  const m       = kvCacheMetrics.get()
  const total   = m.ollamaCalls
  const hits    = m.cacheHits
  const rate    = total > 0 ? Math.round((hits / total) * 100) : 0

  if (total === 0) {
    return {
      name:    'KV-cache',
      status:  'warn',
      message: 'No Ollama calls recorded yet — run a goal first',
      fix:     'npx ts-node index.ts goal "your goal here"',
    }
  }

  if (rate >= 80) {
    return {
      name:    'KV-cache',
      status:  'pass',
      message: `Hit rate: ${rate}% (${hits}/${total} calls) — good`,
    }
  }

  return {
    name:    'KV-cache',
    status:  'warn',
    message: `Hit rate: ${rate}% (${hits}/${total} calls) — system prompts varying`,
    fix:     'All LLM calls must use coreBoot.getSystemPrompt() — check for dynamic system prompts',
  }
}

async function checkApiConfig(): Promise<CheckResult> {
  const configPath = path.join(process.cwd(), 'config/api.json')
  if (!fs.existsSync(configPath))
    return {
      name:    'API Config',
      status:  'fail',
      message: 'config/api.json missing',
      fix:     'Run: npx ts-node index.ts install',
    }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  return { name: 'API Config', status: 'pass', message: `Port: ${config.port}, Host: ${config.host}` }
}

async function checkModels(): Promise<CheckResult> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port: 11434, path: '/api/tags', method: 'GET' },
      (res) => {
        let data = ''
        res.on('data', (c) => data += c)
        res.on('end', () => {
          try {
            const tags       = JSON.parse(data)
            const models     = tags.models?.map((m: any) => m.name) || []
            const hasPrimary = models.some((m: string) => m.includes('mistral-nemo'))
            const hasCoder   = models.some((m: string) => m.includes('qwen2.5-coder'))
            if (hasPrimary && hasCoder)
              return resolve({ name: 'Models', status: 'pass', message: 'mistral-nemo:12b ✅  qwen2.5-coder:7b ✅' })
            const missing = []
            if (!hasPrimary) missing.push('mistral-nemo:12b')
            if (!hasCoder)   missing.push('qwen2.5-coder:7b')
            resolve({
              name:    'Models',
              status:  'warn',
              message: `Missing: ${missing.join(', ')}`,
              fix:     `Run: ollama pull ${missing.join(' && ollama pull ')}`,
            })
          } catch {
            resolve({ name: 'Models', status: 'fail', message: 'Cannot check models', fix: 'Ensure Ollama is running' })
          }
        })
      },
    )
    req.on('error', () =>
      resolve({ name: 'Models', status: 'fail', message: 'Ollama offline', fix: 'Run: ollama serve' }),
    )
    req.setTimeout(3000, () => {
      req.destroy()
      resolve({ name: 'Models', status: 'fail', message: 'Timeout' })
    })
    req.end()
  })
}

export async function runDoctor(): Promise<{ allPass: boolean; results: CheckResult[] }> {
  const checks  = [checkNode, checkOllama, checkModels, checkDocker, checkWorkspace, checkApiConfig, checkKVCache]
  const results: CheckResult[] = []
  for (const check of checks) {
    results.push(await check())
  }
  const allPass = results.every((r) => r.status !== 'fail')
  return { allPass, results }
}
