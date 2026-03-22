// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/github/index.ts — Pure Node.js GitHub REST API client.

import https from "https"
import fs    from "fs"
import path  from "path"

const INTEGRATIONS_FILE = path.join(process.cwd(), "config", "integrations.json")
const API_HOST          = "api.github.com"
const TIMEOUT_MS        = 15_000

export interface GithubConfig {
  token:       string
  defaultRepo: string
}

export interface GithubIssue {
  id:        number
  title:     string
  body:      string
  state:     string
  labels:    string[]
  createdAt: string
}

function loadToken(): string {
  // Env overrides config file
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  try {
    const cfg = JSON.parse(fs.readFileSync(INTEGRATIONS_FILE, "utf-8"))
    return cfg?.github?.token ?? ""
  } catch {
    return ""
  }
}

function loadDefaultRepo(): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(INTEGRATIONS_FILE, "utf-8"))
    return cfg?.github?.defaultRepo ?? ""
  } catch {
    return ""
  }
}

function httpsRequest(
  method:  string,
  urlPath: string,
  token:   string,
  body?:   string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      "User-Agent":    "DevOS/1.0",
      "Accept":        "application/vnd.github.v3+json",
      "Content-Type":  "application/json",
    }
    if (token) headers["Authorization"] = `token ${token}`
    if (body)  headers["Content-Length"] = Buffer.byteLength(body).toString()

    const options: https.RequestOptions = {
      hostname: API_HOST,
      port:     443,
      path:     urlPath,
      method,
      headers,
      timeout:  TIMEOUT_MS,
    }

    const req = https.request(options, res => {
      let data = ""
      res.setEncoding("utf-8")
      res.on("data",  chunk => { data += chunk })
      res.on("end",   () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`GitHub API ${res.statusCode}: ${data.slice(0, 200)}`))
          return
        }
        try { resolve(JSON.parse(data)) }
        catch { resolve(data) }
      })
      res.on("error", reject)
    })

    req.on("timeout", () => { req.destroy(); reject(new Error("GitHub request timed out")) })
    req.on("error",   reject)
    if (body) req.write(body)
    req.end()
  })
}

export class GithubIntegration {

  private get token(): string { return loadToken() }
  get defaultRepo(): string   { return loadDefaultRepo() }

  /** List issues for a repo. State: "open" | "closed" | "all" (default "open"). */
  async listIssues(repo: string, state: string = "open"): Promise<GithubIssue[]> {
    const raw = await httpsRequest(
      "GET",
      `/repos/${repo}/issues?state=${state}&per_page=30`,
      this.token,
    ) as any[]

    return (Array.isArray(raw) ? raw : []).map(i => ({
      id:        i.number,
      title:     i.title      ?? "",
      body:      i.body       ?? "",
      state:     i.state      ?? "",
      labels:    (i.labels ?? []).map((l: any) => l.name ?? ""),
      createdAt: i.created_at ?? "",
    }))
  }

  /** Create a new issue. */
  async createIssue(repo: string, title: string, body: string): Promise<GithubIssue> {
    const raw = await httpsRequest(
      "POST",
      `/repos/${repo}/issues`,
      this.token,
      JSON.stringify({ title, body }),
    ) as any

    return {
      id:        raw.number   ?? 0,
      title:     raw.title    ?? title,
      body:      raw.body     ?? body,
      state:     raw.state    ?? "open",
      labels:    [],
      createdAt: raw.created_at ?? new Date().toISOString(),
    }
  }

  /** List pull requests. */
  async listPRs(repo: string): Promise<any[]> {
    const raw = await httpsRequest("GET", `/repos/${repo}/pulls?per_page=30`, this.token)
    return Array.isArray(raw) ? raw : []
  }

  /** Get repository metadata. */
  async getRepoInfo(repo: string): Promise<any> {
    return httpsRequest("GET", `/repos/${repo}`, this.token)
  }
}

export const github = new GithubIntegration()
