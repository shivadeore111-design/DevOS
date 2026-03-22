// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// security/vaultSync.ts — File synchronisation between host and vault containers.
//
// copyToVault   — Push a host file/directory into a running container.
// copyFromVault — Pull a file/directory out of a container to the host.
// syncOutputs   — Copy everything in the container's /workspace/outputs/
//                 directory to workspace/tasks/<taskId>/outputs/ on the host.
//
// All transfers use the Docker tar-stream API (container.putArchive /
// container.getArchive) so they work without needing `docker cp` in PATH.

import Docker from 'dockerode'
import path   from 'fs'
import fs     from 'fs'
import fspath from 'path'
import tar    from 'tar-stream'
import { createReadStream, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { skillVault } from './skillVault'

const docker    = new Docker()
const WORKSPACE = fspath.join(process.cwd(), 'workspace')

// ── Internal helpers ──────────────────────────────────────────

/**
 * Pack a single file (or a flat directory of files) into a tar stream
 * in memory, ready to hand to container.putArchive().
 */
async function packFile(hostPath: string, entryName: string): Promise<Buffer> {
  const pack = tar.pack()

  const stat = fs.statSync(hostPath)

  if (stat.isDirectory()) {
    const files = fs.readdirSync(hostPath)
    for (const file of files) {
      const fullPath = fspath.join(hostPath, file)
      const fileStat = fs.statSync(fullPath)
      if (!fileStat.isFile()) continue  // skip subdirs for now
      const content = fs.readFileSync(fullPath)
      pack.entry({ name: fspath.join(entryName, file), size: content.length }, content)
    }
  } else {
    const content = fs.readFileSync(hostPath)
    pack.entry({ name: entryName, size: content.length }, content)
  }

  pack.finalize()

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    pack.on('data',  (c: Buffer) => chunks.push(c))
    pack.on('end',   ()          => resolve(Buffer.concat(chunks)))
    pack.on('error', reject)
  })
}

/**
 * Extract a tar stream (from container.getArchive) to a host directory.
 */
async function extractStream(stream: NodeJS.ReadableStream, destDir: string): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true })

  return new Promise<void>((resolve, reject) => {
    const extract = tar.extract()

    extract.on('entry', (header, entryStream, next) => {
      // Skip directory entries
      if (header.type === 'directory') {
        entryStream.resume()
        entryStream.on('end', next)
        return
      }

      const outPath = fspath.join(destDir, fspath.basename(header.name))
      const chunks: Buffer[] = []
      entryStream.on('data',  (c: Buffer) => chunks.push(c))
      entryStream.on('end',   () => {
        fs.writeFileSync(outPath, Buffer.concat(chunks))
        next()
      })
      entryStream.on('error', next)
    })

    extract.on('finish', resolve)
    extract.on('error',  reject)

    ;(stream as any).pipe(extract)
  })
}

// ── Public API ────────────────────────────────────────────────

/**
 * Copy a host file or directory into a running vault container.
 *
 * @param taskId       The task whose vault to target.
 * @param hostPath     Absolute path on the host.
 * @param containerPath  Absolute destination path inside the container.
 *                       The basename of hostPath is used as the entry name.
 */
export async function copyToVault(
  taskId:        string,
  hostPath:      string,
  containerPath: string,
): Promise<void> {
  const vaults = skillVault.listVaults()
  const vault  = vaults.find(v => v.taskId === taskId)
  if (!vault) throw new Error(`[VaultSync] No vault for task ${taskId}`)

  const container = docker.getContainer(vault.containerId)
  const entryName = fspath.basename(hostPath)
  const tarBuf    = await packFile(hostPath, entryName)

  await container.putArchive(tarBuf, { path: containerPath })
  console.log(`[VaultSync] → Copied ${entryName} into ${vault.containerName}:${containerPath}`)
}

/**
 * Copy a file or directory out of a vault container to a host path.
 *
 * @param taskId       The task whose vault to target.
 * @param containerPath  Absolute path inside the container.
 * @param hostDestDir  Host directory to extract into.
 */
export async function copyFromVault(
  taskId:        string,
  containerPath: string,
  hostDestDir:   string,
): Promise<void> {
  const vaults = skillVault.listVaults()
  const vault  = vaults.find(v => v.taskId === taskId)
  if (!vault) throw new Error(`[VaultSync] No vault for task ${taskId}`)

  const container = docker.getContainer(vault.containerId)
  const stream    = await container.getArchive({ path: containerPath })

  await extractStream(stream as unknown as NodeJS.ReadableStream, hostDestDir)
  console.log(`[VaultSync] ← Extracted ${containerPath} from ${vault.containerName} → ${hostDestDir}`)
}

/**
 * Copy everything from /workspace/outputs/ inside the vault container
 * to workspace/tasks/<taskId>/outputs/ on the host.
 *
 * Called after a skill run completes so the host can access results.
 */
export async function syncOutputs(taskId: string): Promise<string> {
  const hostOutputDir = fspath.join(WORKSPACE, 'tasks', taskId, 'outputs')
  await copyFromVault(taskId, '/workspace/outputs', hostOutputDir)
  console.log(`[VaultSync] Outputs synced → ${hostOutputDir}`)
  return hostOutputDir
}
