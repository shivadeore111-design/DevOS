// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/sandboxRunner.ts — Opt-in Docker sandbox backend (N+34).
// When AIDEN_SANDBOX_MODE is "auto" or "strict", dangerous tools
// (shell_exec, run_python) execute inside short-lived Docker containers
// instead of the host, providing network isolation and resource limits.

import { exec }    from 'child_process'
import { promisify } from 'util'
import path        from 'path'

const execAsync = promisify(exec)

// ── Types ──────────────────────────────────────────────────────

export interface SandboxArgs {
  /** The shell command or Python script content to run */
  command:   string
  /** 'shell' runs command directly; 'python' writes to a tmp .py file first */
  type:      'shell' | 'python'
  /** Timeout in ms (default: 30000) */
  timeout?:  number
  /** Mount a host path as /workspace inside the container */
  workspace?: string
  /** Allow outbound network access (default: false = --network=none) */
  network?:  boolean
}

export interface SandboxResult {
  stdout:   string
  stderr:   string
  exitCode: number
}

// ── Constants ─────────────────────────────────────────────────

const SANDBOX_IMAGE = 'aiden-sandbox:latest'

const DOCKERFILE_CONTENT = `FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip bash curl git
WORKDIR /workspace
# Drop to non-root for safety
RUN addgroup -S aiden && adduser -S aiden -G aiden && chown aiden:aiden /workspace
USER aiden
`

// ── Docker availability check ─────────────────────────────────

let _dockerAvailableCache: boolean | null = null

export async function checkDockerAvailable(): Promise<boolean> {
  if (_dockerAvailableCache !== null) return _dockerAvailableCache
  try {
    await execAsync('docker --version', { timeout: 5000 })
    _dockerAvailableCache = true
    return true
  } catch {
    _dockerAvailableCache = false
    return false
  }
}

// Resets the cache — useful after Docker Desktop starts up
export function resetDockerCache(): void {
  _dockerAvailableCache = null
}

// ── Image build / cache ───────────────────────────────────────

let _imageBuildPromise: Promise<void> | null = null

export async function buildSandboxImage(): Promise<void> {
  // Deduplicate concurrent build calls
  if (_imageBuildPromise) return _imageBuildPromise

  _imageBuildPromise = _doBuild().finally(() => {
    _imageBuildPromise = null
  })
  return _imageBuildPromise
}

async function _doBuild(): Promise<void> {
  // Check if image already exists
  try {
    const { stdout } = await execAsync(
      `docker image inspect ${SANDBOX_IMAGE} --format "{{.Id}}"`,
      { timeout: 10000 }
    )
    if (stdout.trim()) {
      console.log('[Sandbox] Image already present:', SANDBOX_IMAGE)
      return
    }
  } catch {
    // Image doesn't exist — build it
  }

  // Write Dockerfile to a temp dir and build
  const { mkdtempSync, writeFileSync, rmSync } = await import('fs')
  const os    = await import('os')
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'aiden-sandbox-'))
  try {
    writeFileSync(path.join(tmpDir, 'Dockerfile'), DOCKERFILE_CONTENT)
    console.log('[Sandbox] Building image', SANDBOX_IMAGE, '...')
    const { stdout, stderr } = await execAsync(
      `docker build -t ${SANDBOX_IMAGE} "${tmpDir}"`,
      { timeout: 120_000 }
    )
    console.log('[Sandbox] Build complete.', (stdout || stderr).slice(0, 200))
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}

// ── Core runner ───────────────────────────────────────────────

/**
 * Run a command or Python script inside a Docker container with:
 *   --rm              auto-remove on exit
 *   --network=none    no outbound traffic (unless args.network=true)
 *   --memory=512m     RAM cap
 *   --cpus=1          CPU cap
 *   --read-only       immutable container FS
 *   --tmpfs /tmp      writable temp space
 *   -v workspace:/workspace  (optional) host workspace mount
 */
export async function runInDockerSandbox(args: SandboxArgs): Promise<SandboxResult> {
  const available = await checkDockerAvailable()
  if (!available) throw new Error('Docker is not available on this system')

  await buildSandboxImage()

  const timeout  = args.timeout ?? 30_000
  const network  = args.network ? 'bridge' : 'none'
  const workspace = args.workspace ?? path.join(process.cwd(), 'workspace')

  // Resolve the actual command to pass to docker
  let dockerCmd: string
  if (args.type === 'python') {
    // Inline the script via stdin-style echo pipe to python3
    const escaped = args.command
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
    dockerCmd = `python3 -c "${escaped}"`
  } else {
    dockerCmd = args.command
  }

  // Escape for outer shell
  const innerEscaped = dockerCmd.replace(/"/g, '\\"')

  const volumeFlag = `-v "${workspace}:/workspace"`

  const runCmd = [
    'docker run',
    '--rm',
    `--network=${network}`,
    '--memory=512m',
    '--cpus=1',
    '--read-only',
    '--tmpfs /tmp',
    volumeFlag,
    SANDBOX_IMAGE,
    `bash -c "${innerEscaped}"`,
  ].join(' ')

  try {
    const { stdout, stderr } = await execAsync(runCmd, {
      timeout,
      cwd: process.cwd(),
    })
    return { stdout: stdout || '', stderr: stderr || '', exitCode: 0 }
  } catch (e: any) {
    const exitCode = e.code ?? 1
    return {
      stdout:   e.stdout  ?? '',
      stderr:   e.stderr  ?? e.message ?? '',
      exitCode: typeof exitCode === 'number' ? exitCode : 1,
    }
  }
}

// ── Status report ─────────────────────────────────────────────

export interface SandboxStatus {
  mode:            string
  dockerAvailable: boolean
  imageCached:     boolean
  imageTag:        string
}

export async function getSandboxStatus(): Promise<SandboxStatus> {
  const mode            = process.env.AIDEN_SANDBOX_MODE || 'off'
  const dockerAvailable = await checkDockerAvailable()
  let imageCached       = false

  if (dockerAvailable) {
    try {
      const { stdout } = await execAsync(
        `docker image inspect ${SANDBOX_IMAGE} --format "{{.Id}}"`,
        { timeout: 5000 }
      )
      imageCached = Boolean(stdout.trim())
    } catch {}
  }

  return { mode, dockerAvailable, imageCached, imageTag: SANDBOX_IMAGE }
}
