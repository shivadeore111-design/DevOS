// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// sandbox/sandboxManager.ts — Docker container lifecycle management

import { Sandbox, SandboxOptions, SandboxResult } from './types'

const DEFAULT_IMAGE   = 'node:20-alpine'
const DEFAULT_MEMORY  = 256  // MB
const DEFAULT_TIMEOUT = 30000 // ms

class SandboxManager {
  private activeSandboxes = new Map<string, Sandbox>()
  private docker: any = null

  private getDocker(): any {
    if (!this.docker) {
      const Dockerode = require('dockerode')
      this.docker = new Dockerode()
    }
    return this.docker
  }

  async createSandbox(taskId: string, options: SandboxOptions = {}): Promise<Sandbox> {
    const docker = this.getDocker()
    const image  = options.image    ?? DEFAULT_IMAGE
    const memMb  = options.memoryMb ?? DEFAULT_MEMORY
    const env    = options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : []

    console.log(`[SandboxManager] Creating sandbox for task ${taskId} (image: ${image})`)

    const container = await docker.createContainer({
      Image:      image,
      Cmd:        ['/bin/sh', '-c', 'tail -f /dev/null'], // idle; commands exec'd in
      WorkingDir: options.workDir ?? '/app',
      Env:        env,
      HostConfig: {
        Memory:     memMb * 1024 * 1024,
        CpuShares:  options.cpuShares ?? 512,
        AutoRemove: false,
        NetworkMode: 'none', // no network by default
      },
    })

    await container.start()

    const sandbox: Sandbox = {
      id:          container.id,
      taskId,
      containerId: container.id,
      status:      'running',
      createdAt:   Date.now(),
      options,
    }

    this.activeSandboxes.set(taskId, sandbox)
    console.log(`[SandboxManager] ✅ Sandbox ready: ${container.id.slice(0, 12)} for task ${taskId}`)
    return sandbox
  }

  async runInSandbox(
    taskId: string,
    command: string[],
    timeoutMs: number = DEFAULT_TIMEOUT,
  ): Promise<SandboxResult> {
    const sandbox = this.activeSandboxes.get(taskId)
    if (!sandbox) throw new Error(`[SandboxManager] No sandbox for task ${taskId}`)

    const docker    = this.getDocker()
    const container = docker.getContainer(sandbox.containerId)
    const startMs   = Date.now()

    const exec = await container.exec({
      Cmd:          command,
      AttachStdout: true,
      AttachStderr: true,
    })

    return new Promise<SandboxResult>(async (resolve) => {
      const timer = setTimeout(async () => {
        console.warn(`[SandboxManager] ⏱️  Timeout for task ${taskId} — killing container`)
        try { await container.kill() } catch { /* ignore */ }
        resolve({
          taskId,
          exitCode:   -1,
          stdout:     '',
          stderr:     'Execution timed out',
          success:    false,
          durationMs: Date.now() - startMs,
        })
      }, timeoutMs)

      try {
        const stream = await exec.start({ hijack: true, stdin: false })
        let stdout = ''
        let stderr = ''

        stream.on('data', (chunk: Buffer) => {
          // Docker multiplexed stream: byte 0 = stream type (1=stdout, 2=stderr)
          if (chunk.length > 8) {
            const type = chunk[0]
            const payload = chunk.slice(8).toString('utf8')
            if (type === 1) stdout += payload
            else stderr += payload
          } else {
            stdout += chunk.toString('utf8')
          }
        })

        stream.on('end', async () => {
          clearTimeout(timer)
          const inspect  = await exec.inspect()
          const exitCode: number = inspect.ExitCode ?? 0
          const durationMs = Date.now() - startMs

          if (sandbox) sandbox.status = exitCode === 0 ? 'completed' : 'failed'

          resolve({
            taskId,
            exitCode,
            stdout:    stdout.trim(),
            stderr:    stderr.trim(),
            success:   exitCode === 0,
            durationMs,
          })
        })

        stream.on('error', (err: Error) => {
          clearTimeout(timer)
          resolve({
            taskId,
            exitCode:   -1,
            stdout:     '',
            stderr:     err.message,
            success:    false,
            durationMs: Date.now() - startMs,
          })
        })
      } catch (err: any) {
        clearTimeout(timer)
        resolve({
          taskId,
          exitCode:   -1,
          stdout:     '',
          stderr:     err?.message ?? String(err),
          success:    false,
          durationMs: Date.now() - startMs,
        })
      }
    })
  }

  async destroySandbox(taskId: string): Promise<void> {
    const sandbox = this.activeSandboxes.get(taskId)
    if (!sandbox) return

    try {
      const docker    = this.getDocker()
      const container = docker.getContainer(sandbox.containerId)
      await container.stop({ t: 2 }).catch(() => {})
      await container.remove({ force: true }).catch(() => {})
      console.log(`[SandboxManager] 🗑️  Destroyed sandbox for task ${taskId}`)
    } catch (err: any) {
      console.warn(`[SandboxManager] Could not destroy container for ${taskId}: ${err?.message}`)
    } finally {
      this.activeSandboxes.delete(taskId)
    }
  }

  async cleanupAll(): Promise<void> {
    const ids = [...this.activeSandboxes.keys()]
    console.log(`[SandboxManager] Cleaning up ${ids.length} active sandboxes...`)
    await Promise.all(ids.map(id => this.destroySandbox(id)))
  }

  listActiveSandboxes(): Sandbox[] {
    return [...this.activeSandboxes.values()]
  }

  getSandbox(taskId: string): Sandbox | undefined {
    return this.activeSandboxes.get(taskId)
  }
}

export const sandboxManager = new SandboxManager()

// Cleanup on process exit
process.on('SIGTERM', () => { sandboxManager.cleanupAll().then(() => process.exit(0)) })
process.on('SIGINT',  () => { sandboxManager.cleanupAll().then(() => process.exit(0)) })
