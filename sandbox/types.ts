// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// sandbox/types.ts — Core types for Docker sandbox execution

export interface SandboxOptions {
  /** Docker image to use (default: node:20-alpine) */
  image?: string
  /** Memory limit in bytes (default: 256MB) */
  memoryMb?: number
  /** CPU quota (default: 0.5 cores) */
  cpuShares?: number
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number
  /** Environment variables to inject */
  env?: Record<string, string>
  /** Working directory inside the container */
  workDir?: string
}

export interface Sandbox {
  id: string
  taskId: string
  containerId: string
  status: 'creating' | 'running' | 'completed' | 'failed' | 'destroyed'
  createdAt: number
  options: SandboxOptions
}

export interface SandboxResult {
  taskId: string
  exitCode: number
  stdout: string
  stderr: string
  success: boolean
  durationMs: number
  outputs?: Record<string, any>
}
