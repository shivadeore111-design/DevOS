// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// security/skillVault.ts — Docker-based sandbox for untrusted skill execution.
//
// Each task gets an isolated Docker container (via dockerode):
//   - Node 20-slim base image
//   - Memory capped at 512 MB, CPU at 0.5 cores
//   - No network access (--network=none)
//   - Ephemeral workspace volume → workspace/vault/<taskId>
//
// Active vaults are persisted to workspace/vaults.json so status
// survives hot-reloads; stale records are reconciled on load.
//
// Usage:
//   const vault = await skillVault.createVault("task-123")
//   const result = await skillVault.runInVault("task-123", "node index.js")
//   await skillVault.destroyVault("task-123")

import Docker from 'dockerode'
import path   from 'path'
import fs     from 'fs'

// ── Types ──────────────────────────────────────────────────────

export interface Vault {
  taskId:        string
  containerName: string
  containerId:   string
  workspacePath: string
  createdAt:     number
}

export interface VaultResult {
  stdout:   string
  stderr:   string
  exitCode: number
  duration: number  // ms
}

// ── Persistence ────────────────────────────────────────────────

const WORKSPACE   = path.join(process.cwd(), 'workspace')
const VAULTS_FILE = path.join(WORKSPACE, 'vaults.json')

function loadPersistedVaults(): Vault[] {
  try {
    if (!fs.existsSync(VAULTS_FILE)) return []
    return JSON.parse(fs.readFileSync(VAULTS_FILE, 'utf-8')) as Vault[]
  } catch { return [] }
}

function savePersistedVaults(vaults: Vault[]): void {
  fs.mkdirSync(WORKSPACE, { recursive: true })
  fs.writeFileSync(VAULTS_FILE, JSON.stringify(vaults, null, 2))
}

// ── SkillVault ─────────────────────────────────────────────────

class SkillVault {

  private readonly docker = new Docker()
  private readonly vaults = new Map<string, Vault>()

  constructor() {
    // Restore in-memory map from persisted file (best-effort)
    for (const v of loadPersistedVaults()) {
      this.vaults.set(v.taskId, v)
    }
  }

  // ── Availability ─────────────────────────────────────────────

  /**
   * Returns true if Docker daemon is reachable.
   */
  isAvailable(): boolean {
    try {
      // Synchronous ping via dockerode info — use execSync as fallback
      // because dockerode's info() is async and we need sync here.
      const { execSync } = require('child_process') as typeof import('child_process')
      execSync('docker info', { stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  }

  // ── Persist helpers ───────────────────────────────────────────

  private persist(): void {
    savePersistedVaults(Array.from(this.vaults.values()))
  }

  // ── Create ────────────────────────────────────────────────────

  /**
   * Provision a Docker container for the given task via dockerode.
   * Container: node:20-slim, 512 MB, 0.5 CPU, no network.
   */
  async createVault(taskId: string): Promise<Vault> {
    // Return existing vault for idempotency
    const existing = this.vaults.get(taskId)
    if (existing) {
      console.log(`[SkillVault] Vault for ${taskId} already exists — reusing`)
      return existing
    }

    const containerName  = `devos-vault-${taskId}`
    const hostWorkspace  = path.join(WORKSPACE, 'vault', taskId)
    const guestWorkspace = '/workspace'

    // Ensure host workspace exists
    fs.mkdirSync(hostWorkspace, { recursive: true })

    let container: Docker.Container
    try {
      container = await this.docker.createContainer({
        name:       containerName,
        Image:      'node:20-slim',
        Cmd:        ['tail', '-f', '/dev/null'],   // keep alive
        WorkingDir: guestWorkspace,
        NetworkDisabled: true,
        HostConfig: {
          Memory:     512 * 1024 * 1024,           // 512 MB
          NanoCpus:   500_000_000,                 // 0.5 CPU
          AutoRemove: true,
          Binds:      [`${hostWorkspace}:${guestWorkspace}`],
          NetworkMode: 'none',
        },
      })
      await container.start()
    } catch (err: any) {
      throw new Error(`[SkillVault] Failed to create container: ${err.message}`)
    }

    const vault: Vault = {
      taskId,
      containerName,
      containerId:   container.id,
      workspacePath: hostWorkspace,
      createdAt:     Date.now(),
    }

    this.vaults.set(taskId, vault)
    this.persist()
    console.log(`[SkillVault] ✅ Created vault for task ${taskId} → ${containerName} (${container.id.slice(0, 12)})`)
    return vault
  }

  // ── Run ───────────────────────────────────────────────────────

  /**
   * Execute a shell command inside the task's vault container.
   * Returns stdout, stderr, exit code, and wall-clock duration.
   */
  async runInVault(taskId: string, command: string): Promise<VaultResult> {
    const vault = this.vaults.get(taskId)
    if (!vault) {
      throw new Error(`[SkillVault] No vault found for task: ${taskId}. Call createVault() first.`)
    }

    const container = this.docker.getContainer(vault.containerId)
    const start     = Date.now()

    try {
      // Create exec instance
      const exec = await container.exec({
        Cmd:          ['sh', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
      })

      // Start exec and collect output
      const stream = await exec.start({ hijack: true, stdin: false })

      const stdout: Buffer[] = []
      const stderr: Buffer[] = []

      await new Promise<void>((resolve, reject) => {
        // dockerode multiplexes stdout/stderr on the same stream
        container.modem.demuxStream(stream, {
          write: (chunk: Buffer) => stdout.push(chunk),
        }, {
          write: (chunk: Buffer) => stderr.push(chunk),
        })
        stream.on('end',   resolve)
        stream.on('error', reject)
        // Safety timeout
        setTimeout(resolve, 60_000)
      })

      const inspect  = await exec.inspect()
      const exitCode = inspect.ExitCode ?? 0
      const duration = Date.now() - start

      if (exitCode !== 0) {
        console.warn(`[SkillVault] Command exited ${exitCode} in ${vault.containerName}`)
      }

      return {
        stdout:   Buffer.concat(stdout).toString('utf-8'),
        stderr:   Buffer.concat(stderr).toString('utf-8'),
        exitCode,
        duration,
      }
    } catch (err: any) {
      return {
        stdout:   '',
        stderr:   err?.message ?? String(err),
        exitCode: 1,
        duration: Date.now() - start,
      }
    }
  }

  // ── Destroy ───────────────────────────────────────────────────

  /**
   * Stop the container for the given task.
   * AutoRemove is set, so Docker removes it automatically on stop.
   */
  async destroyVault(taskId: string): Promise<void> {
    const vault = this.vaults.get(taskId)

    if (vault) {
      try {
        const container = this.docker.getContainer(vault.containerId)
        await container.stop({ t: 5 })
      } catch {
        // Already stopped or removed — ignore
      }
      this.vaults.delete(taskId)
      this.persist()
    }

    console.log(`[SkillVault] 🗑  Destroyed vault for task ${taskId}`)
  }

  // ── List ──────────────────────────────────────────────────────

  /** List all active vaults. */
  listVaults(): Vault[] {
    return Array.from(this.vaults.values())
  }

  /** Alias for backward compatibility with existing CLI code. */
  listActive(): Vault[] {
    return this.listVaults()
  }

  // ── Shutdown ──────────────────────────────────────────────────

  /** Stop all active vaults — called on graceful shutdown. */
  async destroyAll(): Promise<void> {
    const ids = Array.from(this.vaults.keys())
    console.log(`[SkillVault] Shutting down ${ids.length} vault(s)…`)
    await Promise.all(ids.map(id => this.destroyVault(id)))
    console.log('[SkillVault] All vaults destroyed.')
  }
}

export const skillVault = new SkillVault()
