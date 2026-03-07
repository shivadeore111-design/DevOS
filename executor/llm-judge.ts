// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { askOllama } from "../providers/ollama"

export class LLMJudge {

  async evaluateResult(summary: string, action: any, result: any) {
    const prompt = `
You are a strict execution judge.

Goal:
${summary}

Action:
${JSON.stringify(action, null, 2)}

Result:
${JSON.stringify(result, null, 2)}

Respond ONLY with JSON:
{
  "valid": boolean,
  "reason": string
}
`

    try {
      const response = await askOllama(prompt)
      const match = response.match(/\{[\s\S]*\}/)
      if (!match) return { valid: false, reason: "Invalid judge response" }
      return JSON.parse(match[0])
    } catch {
      return { valid: false, reason: "Judge failed" }
    }
  }

  async generateRepairAction(
    goalSummary: string,
    failedAction: any,
    errorOutput: string
  ): Promise<any> {

    const prompt = `
You are a DevOps repair agent.

Goal:
${goalSummary}

Failed Action:
${JSON.stringify(failedAction, null, 2)}

Error Output:
${errorOutput}

Generate ONE JSON action to fix this.
Only output JSON.
Valid types:
- terminal.run
- file_create
- file_append
- file_delete
- shell_plan
`

    try {
      const response = await askOllama(prompt)
      const match = response.match(/\{[\s\S]*\}/)
      if (!match) return null
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }

  // 🔥 NEW — Terminal self-repair analysis
  async analyzeTerminalFailure(
    command: string,
    stdout: string,
    stderr: string
  ): Promise<any> {

    const prompt = `
A terminal command failed.

Command:
${command}

Stdout:
${stdout}

Stderr:
${stderr}

Return ONE JSON repair action.
If no fix possible, return null.
Valid types:
- terminal.run
- file_create
- file_append
- file_delete
`

    try {
      const response = await askOllama(prompt)
      const match = response.match(/\{[\s\S]*\}/)
      if (!match) return null
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}