// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/railway/index.ts — Railway GraphQL API integration

import * as https from 'https'
import * as fs    from 'fs'
import * as path  from 'path'

function loadToken(): string {
  try {
    const configPath = path.join(process.cwd(), 'config', 'integrations.json')
    const config     = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return config.railway?.token ?? process.env.RAILWAY_TOKEN ?? ''
  } catch {
    return process.env.RAILWAY_TOKEN ?? ''
  }
}

async function railwayGraphQL(query: string, variables?: Record<string, any>): Promise<any> {
  const token = loadToken()
  const body  = JSON.stringify({ query, variables })
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'backboard.railway.app',
        path:     '/graphql/v2',
        method:   'POST',
        headers: {
          Authorization:   `Bearer ${token}`,
          'Content-Type':  'application/json',
          'Content-Length': Buffer.byteLength(body),
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
    req.write(body)
    req.end()
  })
}

export class RailwayIntegration {
  async listProjects(): Promise<any[]> {
    const res = await railwayGraphQL(`{ projects { edges { node { id name } } } }`)
    return res.data?.projects?.edges?.map((e: any) => e.node) ?? []
  }

  async deployService(projectId: string, serviceId: string): Promise<any> {
    console.log(`[Railway] 🚂 Deploying service ${serviceId} in project ${projectId}...`)
    return railwayGraphQL(`
      mutation Deploy($serviceId: String!) {
        serviceInstanceDeploy(serviceId: $serviceId) { id status }
      }
    `, { serviceId })
  }

  async getDeploymentStatus(deploymentId: string): Promise<string> {
    const res = await railwayGraphQL(`
      query Status($id: String!) {
        deployment(id: $id) { status }
      }
    `, { id: deploymentId })
    return res.data?.deployment?.status ?? 'unknown'
  }
}

export const railway = new RailwayIntegration()
