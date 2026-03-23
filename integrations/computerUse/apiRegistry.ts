// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// integrations/computerUse/apiRegistry.ts
// API-first execution hub.  Falls back to Playwright (BrowserVault) only
// when no registered API handler exists for the requested service.

export type ApiHandler = (params: {
  endpoint: string
  method:   string
  payload?: any
  headers?: Record<string, string>
}) => Promise<any>

class APIRegistry {
  private readonly registry: Map<string, ApiHandler> = new Map()

  // ── Registration ─────────────────────────────────────────────

  register(serviceName: string, handler: ApiHandler): void {
    this.registry.set(serviceName.toLowerCase(), handler)
  }

  hasAPI(service: string): boolean {
    return this.registry.has(service.toLowerCase())
  }

  // ── Execute ──────────────────────────────────────────────────

  /**
   * Execute a service call.
   *
   * Resolution order:
   *   1. Registered API handler → fast, structured, no UI
   *   2. BrowserVault UI fallback → slow, visual, always works
   *
   * Returns `{ result, usedAPI: true }` when a handler succeeded,
   * or `{ result: { status: 'ui_fallback', ... }, usedAPI: false }` for fallback.
   */
  async execute(
    service: string,
    params: { endpoint: string; method: string; payload?: any; headers?: Record<string, string> },
  ): Promise<{ result: any; usedAPI: boolean }> {
    const handler = this.registry.get(service.toLowerCase())

    if (handler) {
      try {
        const result = await handler(params)
        return { result, usedAPI: true }
      } catch (err: any) {
        console.warn(`[APIRegistry] ${service} API handler failed — falling back to UI: ${err?.message}`)
      }
    }

    // UI fallback — open BrowserVault on the service's web app
    const { browserVault } = await import('../../security/browserVault')

    const SERVICE_URLS: Record<string, string> = {
      gmail:   'https://mail.google.com',
      notion:  'https://notion.so',
      github:  'https://github.com',
      slack:   'https://app.slack.com',
      sheets:  'https://docs.google.com/spreadsheets',
      linear:  'https://linear.app',
      jira:    'https://id.atlassian.com',
      figma:   'https://www.figma.com',
      trello:  'https://trello.com',
      asana:   'https://app.asana.com',
    }

    const url = SERVICE_URLS[service.toLowerCase()]
    if (!url) throw new Error(`[APIRegistry] No API handler and no UI fallback for service: ${service}`)

    const taskId = `api-fallback-${Date.now()}`
    const vault  = await browserVault.createBrowserVault(taskId)
    const liveViewUrl = browserVault.getLiveViewUrl(taskId)

    console.log(`[APIRegistry] 🌐 UI fallback → ${url}  (vault: ${vault.containerName})`)

    return {
      result: {
        status:      'ui_fallback',
        url,
        vaultId:     vault.taskId,
        liveViewUrl,
      },
      usedAPI: false,
    }
  }

  // ── Introspection ─────────────────────────────────────────────

  listServices(): string[] {
    return Array.from(this.registry.keys())
  }
}

export const apiRegistry = new APIRegistry()

// ── Built-in registrations ────────────────────────────────────
// Extend via config/api-keys.json or register() calls at startup.
// Example: apiRegistry.register('github', githubHandler)
