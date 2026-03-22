// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// executor/skillRunner.ts — Dispatch skill execution:
//   1. Community (vaulted) skills  → Docker container via skillVault
//   2. Browser skills              → Playwright container via browserVault
//   3. Sandboxed built-in skills   → sandboxedSkill (legacy sandbox)
//   4. In-process built-in skills  → require() in current process

import * as path from 'path'
import { SandboxResult } from '../sandbox/types'

export interface SkillRunOptions {
  skillName:   string
  taskId:      string
  inputs:      Record<string, any>
  /** 'community' → run in skillVault; 'browser' → run in browserVault; defaults to built-in routing */
  skillType?:  'builtin' | 'community' | 'browser'
}

export interface SkillRunResult {
  success:    boolean
  output:     any
  stdout?:    string
  stderr?:    string
  durationMs: number
  sandboxed:  boolean
}

class SkillRunner {
  /**
   * Run a skill by name with the given inputs.
   *
   * Routing:
   *   skillType === 'community' → vaulted Docker execution via skillVault
   *   skillType === 'browser'   → Playwright Docker via browserVault
   *   DEVOS_SANDBOX=true        → legacy sandboxedSkill
   *   default                   → in-process require()
   */
  async run(opts: SkillRunOptions): Promise<SkillRunResult> {
    const { skillName, taskId, inputs, skillType } = opts

    if (skillType === 'community') {
      return this.runCommunitySkill(skillName, taskId, inputs)
    }

    if (skillType === 'browser') {
      return this.runBrowserSkill(skillName, taskId, inputs)
    }

    const sandboxed = process.env.DEVOS_SANDBOX === 'true'
    if (sandboxed) {
      return this.runSandboxed(skillName, taskId, inputs)
    }

    return this.runInProcess(skillName, taskId, inputs)
  }

  // ── Community skill path (skillVault) ────────────────────────────────────

  private async runCommunitySkill(
    skillName: string,
    taskId:    string,
    inputs:    Record<string, any>,
  ): Promise<SkillRunResult> {
    const { skillVault }  = await import('../security/skillVault')
    const { syncOutputs } = await import('../security/vaultSync')

    const startMs = Date.now()

    try {
      // 1. Ensure a vault is provisioned for this task
      await skillVault.createVault(taskId)

      // 2. Write inputs.json into the vault workspace
      const inputsJson   = JSON.stringify(inputs, null, 2)
      const inputCmd     = `mkdir -p /workspace && echo '${inputsJson.replace(/'/g, "'\\''")}' > /workspace/inputs.json`
      await skillVault.runInVault(taskId, inputCmd)

      // 3. Execute the skill entry-point (skills/<skillName>/index.js)
      const runCmd = `node /workspace/skills/${skillName}/index.js`
      const result = await skillVault.runInVault(taskId, runCmd)

      // 4. Sync outputs back to host
      try { await syncOutputs(taskId) } catch { /* outputs dir may not exist */ }

      // 5. Parse output — skill should write JSON to stdout or /workspace/outputs/result.json
      let output: any = result.stdout
      try { output = JSON.parse(result.stdout) } catch { /* keep raw string */ }

      return {
        success:    result.exitCode === 0,
        output,
        stdout:     result.stdout,
        stderr:     result.stderr,
        durationMs: Date.now() - startMs,
        sandboxed:  true,
      }
    } catch (err: any) {
      return {
        success:    false,
        output:     null,
        stderr:     err?.message ?? String(err),
        durationMs: Date.now() - startMs,
        sandboxed:  true,
      }
    }
  }

  // ── Browser skill path (browserVault) ────────────────────────────────────

  private async runBrowserSkill(
    skillName: string,
    taskId:    string,
    inputs:    Record<string, any>,
  ): Promise<SkillRunResult> {
    const { browserVault } = await import('../security/browserVault')
    const { skillVault }   = await import('../security/skillVault')

    const startMs = Date.now()

    try {
      // 1. Spin up the Playwright container (includes x11vnc + websockify)
      const bv  = await browserVault.createBrowserVault(taskId)
      const url = browserVault.getLiveViewUrl(taskId)

      console.log(`[SkillRunner] Browser vault ready on ws://localhost:${bv.hostPort}/websockify`)

      // 2. Also provision a regular vault for file I/O if needed
      await skillVault.createVault(taskId)

      // 3. Write inputs into the browser vault's filesystem via exec
      const inputsJson = JSON.stringify(inputs, null, 2)
      const inputCmd   = `mkdir -p /workspace && echo '${inputsJson.replace(/'/g, "'\\''")}' > /workspace/inputs.json`
      await skillVault.runInVault(taskId, inputCmd)

      // 4. Run the browser skill — it should use Playwright already installed in image
      const runCmd = `DISPLAY=:99 node /workspace/skills/${skillName}/index.js`
      const result = await skillVault.runInVault(taskId, runCmd)

      let output: any = result.stdout
      try { output = JSON.parse(result.stdout) } catch { /* raw */ }

      return {
        success:    result.exitCode === 0,
        output:     { ...output, liveViewUrl: url },
        stdout:     result.stdout,
        stderr:     result.stderr,
        durationMs: Date.now() - startMs,
        sandboxed:  true,
      }
    } catch (err: any) {
      return {
        success:    false,
        output:     null,
        stderr:     err?.message ?? String(err),
        durationMs: Date.now() - startMs,
        sandboxed:  true,
      }
    }
  }

  // ── Sandboxed path (legacy sandboxedSkill) ───────────────────────────────

  private async runSandboxed(
    skillName: string,
    taskId:    string,
    inputs:    Record<string, any>,
  ): Promise<SkillRunResult> {
    const { sandboxedSkill } = await import('../sandbox/sandboxedSkill')
    const result: SandboxResult = await sandboxedSkill.run({ skillName, taskId, inputs })

    return {
      success:    result.success,
      output:     result.outputs ?? result.stdout,
      stdout:     result.stdout,
      stderr:     result.stderr,
      durationMs: result.durationMs,
      sandboxed:  true,
    }
  }

  // ── In-process path ───────────────────────────────────────────────────────

  private async runInProcess(
    skillName: string,
    taskId:    string,
    inputs:    Record<string, any>,
  ): Promise<SkillRunResult> {
    const startMs  = Date.now()
    const skillDir = path.join(process.cwd(), 'skills')

    try {
      // Try .ts (ts-node / tsx context) then compiled .js
      let skillMod: any
      const candidates = [
        path.join(skillDir, skillName, 'index.ts'),
        path.join(skillDir, skillName, 'index.js'),
        path.join(skillDir, `${skillName}.ts`),
        path.join(skillDir, `${skillName}.js`),
      ]

      for (const candidate of candidates) {
        try {
          skillMod = require(candidate)
          break
        } catch { /* try next */ }
      }

      if (!skillMod) {
        throw new Error(`Skill '${skillName}' not found in ${skillDir}`)
      }

      // Convention: skill exports a default function or { run }
      const fn = skillMod.run ?? skillMod.default ?? skillMod
      if (typeof fn !== 'function') {
        throw new Error(`Skill '${skillName}' does not export a callable function`)
      }

      const output = await Promise.resolve(fn(inputs, { taskId }))

      return {
        success:    true,
        output,
        durationMs: Date.now() - startMs,
        sandboxed:  false,
      }
    } catch (err: any) {
      return {
        success:    false,
        output:     null,
        stderr:     err?.message ?? String(err),
        durationMs: Date.now() - startMs,
        sandboxed:  false,
      }
    }
  }
}

export const skillRunner = new SkillRunner()
