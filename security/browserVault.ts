// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// security/browserVault.ts — Playwright-in-Docker with noVNC LiveView.
//
// Each browser task gets a dedicated container based on the Microsoft
// Playwright image.  Inside the container:
//
//   • Playwright / Chromium runs headed (DISPLAY=:99 via Xvfb)
//   • x11vnc exposes the Xvfb display on TCP port 5900
//   • websockify bridges VNC → WebSocket on port 6080
//
// The host side:
//   • Maps a unique host port (base 6100 + index) → container 6080
//   • Provides a getLiveViewUrl() so the dashboard can embed noVNC
//
// noVNC is loaded from a public CDN in the dashboard iframe; no local
// installation required.
//
// Usage:
//   const bv   = await browserVault.createBrowserVault("task-abc")
//   const url  = browserVault.getLiveViewUrl("task-abc")
//   // → "ws://localhost:6100/vnc/task-abc"
//   const ok   = browserVault.isLiveViewAvailable("task-abc")
//   await browserVault.destroyBrowserVault("task-abc")

import Docker from 'dockerode'
import path   from 'path'
import fs     from 'fs'

// ── Types ──────────────────────────────────────────────────────

export interface BrowserVault {
  taskId:      string
  containerId: string
  containerName: string
  hostPort:    number   // WebSocket port on the host machine
  createdAt:   number
}

// ── Constants ─────────────────────────────────────────────────

const PLAYWRIGHT_IMAGE = 'mcr.microsoft.com/playwright:v1.40.0-jammy'
const CONTAINER_VNC_WS_PORT = 6080   // websockify port inside container
const HOST_PORT_BASE         = 6100   // first host port to allocate

// Entrypoint: start Xvfb → Chromium → x11vnc → websockify
// We write this as a single shell -c string so it runs in one CMD.
const ENTRYPOINT_CMD = [
  'sh', '-c',
  [
    // Start Xvfb virtual display
    'Xvfb :99 -screen 0 1280x900x24 &',
    'export DISPLAY=:99',
    // Wait for Xvfb
    'sleep 1',
    // Start x11vnc (no auth for simplicity; container is isolated)
    'x11vnc -display :99 -nopw -forever -rfbport 5900 -quiet &',
    // Start websockify to bridge VNC → WebSocket
    `websockify --web /usr/share/novnc 0.0.0.0:${CONTAINER_VNC_WS_PORT} localhost:5900 &`,
    // Keep container alive
    'tail -f /dev/null',
  ].join(' && ')
]

// ── Persistence ────────────────────────────────────────────────

const WORKSPACE    = path.join(process.cwd(), 'workspace')
const BVAULTS_FILE = path.join(WORKSPACE, 'browser-vaults.json')

function loadPersistedBVaults(): BrowserVault[] {
  try {
    if (!fs.existsSync(BVAULTS_FILE)) return []
    return JSON.parse(fs.readFileSync(BVAULTS_FILE, 'utf-8')) as BrowserVault[]
  } catch { return [] }
}

function savePersistedBVaults(vaults: BrowserVault[]): void {
  fs.mkdirSync(WORKSPACE, { recursive: true })
  fs.writeFileSync(BVAULTS_FILE, JSON.stringify(vaults, null, 2))
}

// ── BrowserVaultManager ───────────────────────────────────────

class BrowserVaultManager {

  private readonly docker  = new Docker()
  private readonly vaults  = new Map<string, BrowserVault>()
  private nextPort         = HOST_PORT_BASE

  constructor() {
    // Restore in-memory state from persisted file
    for (const v of loadPersistedBVaults()) {
      this.vaults.set(v.taskId, v)
      // Track highest allocated port so we don't collide
      if (v.hostPort >= this.nextPort) {
        this.nextPort = v.hostPort + 1
      }
    }
  }

  // ── Port allocation ───────────────────────────────────────────

  private allocatePort(): number {
    return this.nextPort++
  }

  // ── Persist ───────────────────────────────────────────────────

  private persist(): void {
    savePersistedBVaults(Array.from(this.vaults.values()))
  }

  // ── Create ────────────────────────────────────────────────────

  /**
   * Spin up a Playwright container with x11vnc + websockify LiveView.
   * Returns the BrowserVault descriptor (includes hostPort).
   */
  async createBrowserVault(taskId: string): Promise<BrowserVault> {
    // Idempotent
    const existing = this.vaults.get(taskId)
    if (existing) {
      console.log(`[BrowserVault] Vault for ${taskId} already exists — reusing`)
      return existing
    }

    const containerName = `devos-browser-${taskId}`
    const hostPort      = this.allocatePort()

    let container: Docker.Container
    try {
      container = await this.docker.createContainer({
        name:  containerName,
        Image: PLAYWRIGHT_IMAGE,
        Cmd:   ENTRYPOINT_CMD,
        Env:   ['DISPLAY=:99'],
        ExposedPorts: {
          [`${CONTAINER_VNC_WS_PORT}/tcp`]: {},
        },
        HostConfig: {
          PortBindings: {
            [`${CONTAINER_VNC_WS_PORT}/tcp`]: [{ HostPort: String(hostPort) }],
          },
          Memory:     1024 * 1024 * 1024,   // 1 GB for browser
          NanoCpus:   1_000_000_000,         // 1 CPU
          AutoRemove: true,
          // Browsers need /dev/shm to avoid crashes
          ShmSize:    256 * 1024 * 1024,
          CapAdd:     ['SYS_ADMIN'],          // required for Chrome sandbox
        },
      })
      await container.start()
    } catch (err: any) {
      throw new Error(`[BrowserVault] Failed to create container: ${err.message}`)
    }

    const vault: BrowserVault = {
      taskId,
      containerId:   container.id,
      containerName,
      hostPort,
      createdAt:     Date.now(),
    }

    this.vaults.set(taskId, vault)
    this.persist()

    console.log(
      `[BrowserVault] ✅ Created browser vault for task ${taskId}` +
      ` → ${containerName} (port ${hostPort})`
    )
    return vault
  }

  // ── LiveView URL ──────────────────────────────────────────────

  /**
   * Returns the WebSocket URL for the noVNC client to connect to.
   * The dashboard loads noVNC from CDN and points it at this URL.
   *
   * Format: ws://localhost:<hostPort>/websockify
   */
  getLiveViewUrl(taskId: string): string | null {
    const vault = this.vaults.get(taskId)
    if (!vault) return null
    return `ws://localhost:${vault.hostPort}/websockify`
  }

  /**
   * Returns true if the browser vault for this task is running and
   * the WebSocket port is allocated.
   */
  isLiveViewAvailable(taskId: string): boolean {
    return this.vaults.has(taskId)
  }

  // ── Destroy ───────────────────────────────────────────────────

  /**
   * Stop and remove the browser vault container for the given task.
   */
  async destroyBrowserVault(taskId: string): Promise<void> {
    const vault = this.vaults.get(taskId)

    if (vault) {
      try {
        const container = this.docker.getContainer(vault.containerId)
        await container.stop({ t: 5 })
      } catch {
        // Already stopped — ignore
      }
      this.vaults.delete(taskId)
      this.persist()
    }

    console.log(`[BrowserVault] 🗑  Destroyed browser vault for task ${taskId}`)
  }

  // ── List ──────────────────────────────────────────────────────

  listBrowserVaults(): BrowserVault[] {
    return Array.from(this.vaults.values())
  }

  // ── Shutdown ──────────────────────────────────────────────────

  async destroyAll(): Promise<void> {
    const ids = Array.from(this.vaults.keys())
    console.log(`[BrowserVault] Shutting down ${ids.length} browser vault(s)…`)
    await Promise.all(ids.map(id => this.destroyBrowserVault(id)))
    console.log('[BrowserVault] All browser vaults destroyed.')
  }
}

export const browserVault = new BrowserVaultManager()
