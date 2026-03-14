// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/vercel/index.ts — Vercel REST API integration

import * as https from 'https'
import * as fs    from 'fs'
import * as path  from 'path'

interface VercelConfig {
  token:   string
  teamId?: string
}

function loadConfig(): VercelConfig {
  try {
    const configPath = path.join(process.cwd(), 'config', 'integrations.json')
    const config     = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return config.vercel ?? { token: process.env.VERCEL_TOKEN ?? '' }
  } catch {
    return { token: process.env.VERCEL_TOKEN ?? '' }
  }
}

async function vercelRequest(method: string, endpoint: string, body?: any): Promise<any> {
  const config = loadConfig()
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined
    const req  = https.request(
      {
        hostname: 'api.vercel.com',
        path:     endpoint,
        method,
        headers: {
          Authorization:   `Bearer ${config.token}`,
          'Content-Type':  'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      res => {
        let raw = ''
        res.on('data', (c: Buffer) => { raw += c })
        res.on('end', () => {
          try { resolve(JSON.parse(raw)) } catch { resolve(raw) }
        })
      }
    )
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

export class VercelIntegration {
  async listProjects(): Promise<any[]> {
    const res = await vercelRequest('GET', '/v9/projects')
    return res.projects ?? []
  }

  async deploy(projectPath: string, projectName: string): Promise<any> {
    console.log(`[Vercel] 🚀 Deploying ${projectName}...`)
    return vercelRequest('POST', '/v13/deployments', {
      name:      projectName,
      gitSource: { type: 'github', repoId: projectName },
    })
  }

  async getDeployment(deploymentId: string): Promise<any> {
    return vercelRequest('GET', `/v13/deployments/${deploymentId}`)
  }

  async listDeployments(projectName: string): Promise<any[]> {
    const res = await vercelRequest('GET', `/v6/deployments?app=${encodeURIComponent(projectName)}&limit=5`)
    return res.deployments ?? []
  }
}

export const vercel = new VercelIntegration()
