// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// sandbox/sandboxFileSync.ts — Copy files into/out of Docker containers via tar-stream

import * as fs   from 'fs'
import * as path from 'path'

/**
 * Copy a local file or directory into a running container.
 * Uses tar-stream to create an in-memory tar archive and streams it
 * to the container via the Docker putArchive API.
 */
export async function copyToSandbox(
  containerId: string,
  localPath:   string,
  remotePath:  string,
): Promise<void> {
  const Dockerode  = require('dockerode')
  const tarStream  = require('tar-stream')
  const docker     = new Dockerode()
  const container  = docker.getContainer(containerId)

  const pack = tarStream.pack()

  function addEntry(filePath: string, archiveName: string): void {
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(filePath)) {
        addEntry(
          path.join(filePath, child),
          path.posix.join(archiveName, child),
        )
      }
    } else {
      pack.entry({ name: archiveName, size: stat.size }, fs.readFileSync(filePath))
    }
  }

  const entryName = path.basename(localPath)
  addEntry(localPath, entryName)
  pack.finalize()

  await container.putArchive(pack, { path: remotePath })
  console.log(`[SandboxFileSync] Copied ${localPath} → container:${remotePath}/${entryName}`)
}

/**
 * Copy a file or directory from a container back to the local filesystem.
 * Uses getArchive (tar) and extracts with tar-stream.
 */
export async function syncOutputs(
  containerId: string,
  remotePath:  string,
  localDir:    string,
): Promise<void> {
  const Dockerode  = require('dockerode')
  const tarStream  = require('tar-stream')
  const docker     = new Dockerode()
  const container  = docker.getContainer(containerId)

  fs.mkdirSync(localDir, { recursive: true })

  const archiveStream = await container.getArchive({ path: remotePath })
  const extract       = tarStream.extract()

  await new Promise<void>((resolve, reject) => {
    extract.on('entry', (header: any, stream: any, next: () => void) => {
      const outPath = path.join(localDir, header.name)
      if (header.type === 'directory') {
        fs.mkdirSync(outPath, { recursive: true })
        stream.resume()
        next()
      } else {
        const dir = path.dirname(outPath)
        fs.mkdirSync(dir, { recursive: true })
        const out = fs.createWriteStream(outPath)
        stream.pipe(out)
        out.on('finish', next)
        out.on('error', reject)
      }
    })
    extract.on('finish', resolve)
    extract.on('error',  reject)
    archiveStream.pipe(extract)
  })

  console.log(`[SandboxFileSync] Synced container:${remotePath} → ${localDir}`)
}

/**
 * Write a JSON payload as a file inside the container.
 */
export async function writeJsonToSandbox(
  containerId: string,
  remotePath:  string,
  filename:    string,
  payload:     unknown,
): Promise<void> {
  const Dockerode  = require('dockerode')
  const tarStream  = require('tar-stream')
  const docker     = new Dockerode()
  const container  = docker.getContainer(containerId)

  const json    = JSON.stringify(payload, null, 2)
  const buf     = Buffer.from(json, 'utf-8')
  const pack    = tarStream.pack()
  pack.entry({ name: filename, size: buf.length }, buf)
  pack.finalize()

  await container.putArchive(pack, { path: remotePath })
  console.log(`[SandboxFileSync] Wrote ${filename} to container:${remotePath}`)
}
