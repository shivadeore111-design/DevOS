// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// sandbox/sandboxedSkill.ts — Run a DevOS skill inside a Docker sandbox

import * as path from 'path'
import * as fs   from 'fs'
import * as os   from 'os'
import { sandboxManager }              from './sandboxManager'
import { copyToSandbox, writeJsonToSandbox, syncOutputs } from './sandboxFileSync'
import { SandboxOptions, SandboxResult }                   from './types'

const OUTPUTS_DIR = '/app/outputs'
const INPUTS_FILE = 'inputs.json'

export interface SandboxedSkillOptions {
  skillName:   string
  taskId:      string
  inputs:      Record<string, any>
  sandboxOpts?: SandboxOptions
}

class SandboxedSkill {
  async run(opts: SandboxedSkillOptions): Promise<SandboxResult> {
    const { skillName, taskId, inputs, sandboxOpts } = opts

    console.log(`[SandboxedSkill] Running skill '${skillName}' for task ${taskId} in Docker`)

    // 1. Create a temp local output dir to sync results into
    const localOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), `devos-${taskId}-`))

    // 2. Create the sandbox container
    const sandbox = await sandboxManager.createSandbox(taskId, {
      image:     'node:20-alpine',
      memoryMb:  256,
      timeoutMs: 60000,
      env: {
        DEVOS_SKILL:   skillName,
        DEVOS_TASK_ID: taskId,
      },
      ...sandboxOpts,
    })

    try {
      // 3. Copy the entire DevOS project into the container (minus node_modules)
      const projectRoot = process.cwd()
      const relevantDirs = ['executor', 'skills', 'llm', 'core']
      for (const dir of relevantDirs) {
        const localDir = path.join(projectRoot, dir)
        if (fs.existsSync(localDir)) {
          await copyToSandbox(sandbox.containerId, localDir, '/app')
        }
      }

      // 4. Copy package.json so we can install deps if needed
      const pkgPath = path.join(projectRoot, 'package.json')
      if (fs.existsSync(pkgPath)) {
        await copyToSandbox(sandbox.containerId, pkgPath, '/app')
      }

      // 5. Write inputs.json into the container
      await writeJsonToSandbox(sandbox.containerId, '/app', INPUTS_FILE, inputs)

      // 6. Create outputs directory inside the container
      await sandboxManager.runInSandbox(taskId, ['mkdir', '-p', OUTPUTS_DIR])

      // 7. Run the skill — expects a skill runner script at /app/executor/skillEntry.js
      //    Falls back to a minimal inline node command if not present
      const skillEntry = path.join(projectRoot, 'executor', 'skillEntry.js')
      const cmd = fs.existsSync(skillEntry)
        ? ['node', '/app/executor/skillEntry.js', skillName, '/app/inputs.json', OUTPUTS_DIR]
        : ['node', '-e',
            `const s=require('/app/skills/${skillName}');` +
            `const i=require('/app/inputs.json');` +
            `Promise.resolve(s.run?s.run(i):s(i)).then(r=>{` +
            `require('fs').writeFileSync('${OUTPUTS_DIR}/result.json',JSON.stringify(r))` +
            `}).catch(e=>{process.stderr.write(String(e));process.exit(1)})`
          ]

      const result = await sandboxManager.runInSandbox(
        taskId,
        cmd,
        sandboxOpts?.timeoutMs ?? 60000,
      )

      // 8. Sync outputs back to local temp dir
      if (result.success) {
        try {
          await syncOutputs(sandbox.containerId, OUTPUTS_DIR, localOutputDir)

          // Try to parse result.json if present
          const resultFile = path.join(localOutputDir, 'outputs', 'result.json')
          if (fs.existsSync(resultFile)) {
            try {
              result.outputs = JSON.parse(fs.readFileSync(resultFile, 'utf-8'))
            } catch { /* not JSON — leave as undefined */ }
          }
        } catch (syncErr: any) {
          console.warn(`[SandboxedSkill] Could not sync outputs: ${syncErr?.message}`)
        }
      }

      return result
    } finally {
      // 9. Always destroy sandbox and clean temp dir
      await sandboxManager.destroySandbox(taskId)
      try { fs.rmSync(localOutputDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
}

export const sandboxedSkill = new SandboxedSkill()
