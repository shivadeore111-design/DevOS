// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// executor/skillRunner.ts — Dispatch skill execution: sandboxed (Docker) or in-process

import * as path from 'path'
import { SandboxResult } from '../sandbox/types'

export interface SkillRunOptions {
  skillName: string
  taskId:    string
  inputs:    Record<string, any>
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
   * - If DEVOS_SANDBOX=true, executes inside a Docker container via sandboxedSkill.
   * - Otherwise, requires the skill module in-process (fast, default).
   */
  async run(opts: SkillRunOptions): Promise<SkillRunResult> {
    const { skillName, taskId, inputs } = opts
    const sandboxed = process.env.DEVOS_SANDBOX === 'true'

    if (sandboxed) {
      return this.runSandboxed(skillName, taskId, inputs)
    }
    return this.runInProcess(skillName, taskId, inputs)
  }

  // ── Sandboxed path ────────────────────────────────────────────────────────

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
