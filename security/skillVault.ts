// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// security/skillVault.ts — Docker-based sandbox for untrusted skill execution.
//
// Each task gets an isolated Docker container:
//   - Node 20-slim base image
//   - Memory capped at 512 MB, CPU at 0.5 cores
//   - No network access (--network=none)
//   - Ephemeral workspace volume → workspace/vault/<taskId>
//
// Usage:
//   const vault = await skillVault.createVault("task-123")
//   const result = await skillVault.runInVault("task-123", "node index.js")
//   await skillVault.destroyVault("task-123")

import { execSync, exec } from "child_process"
import path from "path"
import fs   from "fs"

// ── Types ──────────────────────────────────────────────────────

export interface Vault {
  taskId:      string
  containerName: string
  workspacePath: string
  createdAt:   number
}

export interface VaultResult {
  stdout:   string
  stderr:   string
  exitCode: number
  duration: number  // ms
}

// ── SkillVault ─────────────────────────────────────────────────

class SkillVault {

  private readonly vaults = new Map<string, Vault>()

  // ── Availability ─────────────────────────────────────────────

  /**
   * Returns true if Docker is available and the daemon is running.
   * Uses `docker info` — fast, exits 0 only if daemon is reachable.
   */
  isAvailable(): boolean {
    try {
      execSync("docker info", { stdio: "pipe" })
      return true
    } catch {
      return false
    }
  }

  // ── Create ────────────────────────────────────────────────────

  /**
   * Provision a Docker container for the given task.
   * The container is named `devos-vault-<taskId>` and mounts a host workspace
   * volume at `/workspace` inside the container.
   */
  async createVault(taskId: string): Promise<Vault> {
    if (!this.isAvailable()) {
      throw new Error("[SkillVault] Docker is not available. Run: docker info")
    }

    const containerName   = `devos-vault-${taskId}`
    const hostWorkspace   = path.join(process.cwd(), "workspace", "vault", taskId)
    const guestWorkspace  = "/workspace"

    // Ensure host workspace exists
    fs.mkdirSync(hostWorkspace, { recursive: true })

    // Build the docker run command
    const dockerCmd = [
      "docker run",
      "--detach",
      "--rm",
      `--name ${containerName}`,
      "--memory=512m",
      "--cpus=0.5",
      "--network=none",
      `--workdir=${guestWorkspace}`,
      `-v "${hostWorkspace}:${guestWorkspace}"`,
      "node:20-slim",
      "tail -f /dev/null",   // keep container alive
    ].join(" ")

    try {
      execSync(dockerCmd, { stdio: "pipe" })
    } catch (err: any) {
      throw new Error(`[SkillVault] Failed to create container: ${err.message}`)
    }

    const vault: Vault = {
      taskId,
      containerName,
      workspacePath: hostWorkspace,
      createdAt:     Date.now(),
    }

    this.vaults.set(taskId, vault)
    console.log(`[SkillVault] ✅ Created vault for task ${taskId} → ${containerName}`)
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

    const dockerExec = `docker exec ${vault.containerName} sh -c ${JSON.stringify(command)}`
    const start      = Date.now()

    return new Promise<VaultResult>((resolve) => {
      exec(dockerExec, { timeout: 60_000 }, (err, stdout, stderr) => {
        const duration = Date.now() - start
        const exitCode = err?.code ?? 0

        if (exitCode !== 0) {
          console.warn(`[SkillVault] Command exited ${exitCode} in ${vault.containerName}: ${stderr.slice(0, 200)}`)
        }

        resolve({
          stdout:   stdout ?? "",
          stderr:   stderr ?? "",
          exitCode: typeof exitCode === "number" ? exitCode : 1,
          duration,
        })
      })
    })
  }

  // ── Destroy ───────────────────────────────────────────────────

  /**
   * Stop and remove the container for the given task.
   * Safe to call if already destroyed (Docker will return an error, which we ignore).
   */
  async destroyVault(taskId: string): Promise<void> {
    const vault = this.vaults.get(taskId)
    const containerName = vault?.containerName ?? `devos-vault-${taskId}`

    try {
      execSync(`docker stop ${containerName}`, { stdio: "pipe" })
    } catch {
      // Already stopped or never started — ignore
    }

    this.vaults.delete(taskId)
    console.log(`[SkillVault] 🗑  Destroyed vault for task ${taskId}`)
  }

  // ── Helpers ───────────────────────────────────────────────────

  /** List all active vaults (task ID → container name). */
  listActive(): Vault[] {
    return Array.from(this.vaults.values())
  }

  /** Stop all active vaults — called on graceful shutdown. */
  async destroyAll(): Promise<void> {
    const ids = Array.from(this.vaults.keys())
    await Promise.all(ids.map(id => this.destroyVault(id)))
  }
}

export const skillVault = new SkillVault()
