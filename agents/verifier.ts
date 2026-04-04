// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// agents/verifier.ts — Adversarial Verification Agent.
// Read-only: inspects outputs from code/deploy tasks and tries to
// break them before the CEO reports success to the user.
//
// Output format: structured VERIFICATION REPORT (markdown)
//   Each check = Check / Command / Output / Result / VERDICT
//
// Usage:
//   const report = await verifierAgent.verify(task, context)

import { auditTrail }    from '../core/auditTrail'
import { costTracker }   from '../core/costTracker'

// ── Types ──────────────────────────────────────────────────────

export interface VerificationTask {
  goal:           string          // original task goal
  tag:            string          // 'code' | 'deploy' | etc.
  filesChanged?:  string[]        // list of files touched
  commandsRun?:   string[]        // commands that were executed
  output?:        string          // raw output from the task
  workspaceDir?:  string          // where the task ran
}

export interface VerificationCheck {
  name:    string     // short label for the check
  command: string     // what was run / examined
  output:  string     // what was observed
  result:  'PASS' | 'FAIL' | 'WARN' | 'SKIP'
  note?:   string     // extra context
}

export type VerificationVerdict = 'APPROVED' | 'NEEDS_FIXES' | 'REJECTED'

export interface VerificationReport {
  verdict:    VerificationVerdict
  checks:     VerificationCheck[]
  summary:    string
  blockers:   string[]           // critical issues that must be fixed
  warnings:   string[]           // non-blocking concerns
  durationMs: number
}

// ── Cheap LLM caller (reuse Cerebras/Ollama pattern) ──────────

async function callCheapLLM(prompt: string, maxTokens = 1500): Promise<string> {
  try {
    const { loadConfig } = await import('../providers/index')
    const config = loadConfig()
    const cerebras = config.providers.apis.find(
      (a: any) => a.provider === 'cerebras' && a.enabled && !a.rateLimited,
    )
    if (cerebras) {
      const key = cerebras.key.startsWith('env:')
        ? (process.env[cerebras.key.replace('env:', '')] || '')
        : cerebras.key
      if (key) {
        const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body:    JSON.stringify({
            model:      cerebras.model || 'llama3.1-8b',
            messages:   [{ role: 'user', content: prompt }],
            stream:     false,
            max_tokens: maxTokens,
          }),
          signal: AbortSignal.timeout(30000),
        })
        if (r.ok) {
          const d = await r.json() as any
          costTracker.record({ provider: 'cerebras', model: cerebras.model, rawResponse: d, taskType: 'system' })
          return d?.choices?.[0]?.message?.content || ''
        }
      }
    }
  } catch {}

  // Ollama fallback
  try {
    const { loadConfig } = await import('../providers/index')
    const config     = loadConfig()
    const ollamaModel = config.model?.activeModel || 'mistral:7b'
    const r = await fetch('http://localhost:11434/api/chat', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model:   ollamaModel,
        stream:  false,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (r.ok) {
      const d = await r.json() as any
      costTracker.record({ provider: 'ollama', model: ollamaModel, rawResponse: d, taskType: 'system' })
      return d?.message?.content || ''
    }
  } catch {}

  return ''
}

// ── Build verification prompt ──────────────────────────────────

function buildVerificationPrompt(task: VerificationTask): string {
  const filesSection = task.filesChanged?.length
    ? `Files changed:\n${task.filesChanged.map(f => `  - ${f}`).join('\n')}`
    : 'No file list provided'

  const cmdsSection = task.commandsRun?.length
    ? `Commands run:\n${task.commandsRun.map(c => `  $ ${c}`).join('\n')}`
    : 'No commands listed'

  const outputSection = task.output
    ? `Task output (truncated to 1500 chars):\n${task.output.slice(0, 1500)}`
    : 'No output captured'

  return `You are a senior adversarial QA engineer reviewing a completed ${task.tag} task.
Your job is to find problems BEFORE the user is told the task succeeded.
Be skeptical. Look for: crashes, wrong paths, missing error handling, silent failures, hardcoded values, unhandled edge cases, security issues, incomplete implementations.

TASK GOAL: ${task.goal}

${filesSection}

${cmdsSection}

${outputSection}

Output exactly 3-6 verification checks in this JSONL format (one JSON object per line):
{"name": "Short check name", "command": "What you examined or would run", "output": "What you observed", "result": "PASS|FAIL|WARN|SKIP", "note": "Optional context"}

Then output a final verdict line:
{"verdict": "APPROVED|NEEDS_FIXES|REJECTED", "summary": "1-2 sentence summary", "blockers": ["blocker1", ...], "warnings": ["warn1", ...]}

Rules:
- APPROVED: all checks PASS or WARN only, no blockers
- NEEDS_FIXES: at least one FAIL but task is salvageable
- REJECTED: fundamental issues — task goal not met, data loss risk, security breach
- Be specific in "command" — name actual files, functions, or lines to inspect
- Output ONLY the JSONL lines, no prose`
}

// ── Parse LLM output into structured report ────────────────────

function parseVerificationOutput(
  raw:       string,
  startTime: number,
): VerificationReport {
  const lines   = raw.trim().split('\n').filter(l => l.trim().startsWith('{'))
  const checks:   VerificationCheck[]  = []
  let verdict:    VerificationVerdict  = 'APPROVED'
  let summary     = 'Verification completed'
  let blockers:   string[] = []
  let warnings:   string[] = []

  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as any
      if (obj.verdict) {
        // Verdict line
        verdict  = obj.verdict  || 'APPROVED'
        summary  = obj.summary  || summary
        blockers = obj.blockers || []
        warnings = obj.warnings || []
      } else if (obj.name && obj.result) {
        // Check line
        checks.push({
          name:    obj.name    || 'Unknown check',
          command: obj.command || '',
          output:  obj.output  || '',
          result:  obj.result  || 'SKIP',
          note:    obj.note,
        })
      }
    } catch {}
  }

  // Fallback: if no checks parsed, return a neutral report
  if (checks.length === 0) {
    checks.push({
      name:    'LLM analysis',
      command: 'Review task output and changed files',
      output:  raw.slice(0, 200) || 'No output',
      result:  'WARN',
      note:    'Structured parse failed — manual review recommended',
    })
  }

  return {
    verdict,
    checks,
    summary,
    blockers,
    warnings,
    durationMs: Date.now() - startTime,
  }
}

// ── Format report as markdown ──────────────────────────────────

export function formatVerificationReport(report: VerificationReport): string {
  const verdictEmoji = report.verdict === 'APPROVED'
    ? '✅ APPROVED'
    : report.verdict === 'NEEDS_FIXES'
    ? '⚠️ NEEDS FIXES'
    : '❌ REJECTED'

  const checksSection = report.checks.map(c => {
    const icon = c.result === 'PASS' ? '✅' : c.result === 'FAIL' ? '❌' : c.result === 'WARN' ? '⚠️' : '⏭️'
    return [
      `### ${icon} ${c.name}`,
      `**Command:** \`${c.command}\``,
      `**Output:** ${c.output}`,
      `**Result:** ${c.result}${c.note ? ` — ${c.note}` : ''}`,
    ].join('\n')
  }).join('\n\n')

  const blockersSection = report.blockers.length
    ? `\n\n**Blockers (must fix):**\n${report.blockers.map(b => `- ${b}`).join('\n')}`
    : ''

  const warningsSection = report.warnings.length
    ? `\n\n**Warnings:**\n${report.warnings.map(w => `- ${w}`).join('\n')}`
    : ''

  return `## Verification Report — ${verdictEmoji}

**Summary:** ${report.summary}
**Duration:** ${report.durationMs}ms
${blockersSection}${warningsSection}

---

${checksSection}`
}

// ── VerifierAgent class ────────────────────────────────────────

export class VerifierAgent {

  // ── Run verification on a completed task ──────────────
  async verify(task: VerificationTask): Promise<VerificationReport> {
    const start = Date.now()

    try {
      const prompt = buildVerificationPrompt(task)
      const raw    = await callCheapLLM(prompt, 1500)

      const report = raw
        ? parseVerificationOutput(raw, start)
        : {
            verdict:    'NEEDS_FIXES' as VerificationVerdict,
            checks:     [{ name: 'LLM unavailable', command: 'N/A', output: 'Could not reach any LLM for verification', result: 'WARN' as const }],
            summary:    'Verification skipped — no LLM available',
            blockers:   [],
            warnings:   ['Manual verification recommended'],
            durationMs: Date.now() - start,
          }

      // Log to audit trail
      auditTrail.record({
        action:     'system',
        tool:       'verifier',
        input:      `goal: ${task.goal}`,
        output:     `verdict: ${report.verdict} | checks: ${report.checks.length}`,
        durationMs: report.durationMs,
        success:    report.verdict !== 'REJECTED',
        goal:       task.goal,
      })

      return report

    } catch (e: any) {
      const durationMs = Date.now() - start
      auditTrail.record({
        action:     'system',
        tool:       'verifier',
        input:      `goal: ${task.goal}`,
        output:     `error: ${e.message}`,
        durationMs,
        success:    false,
        error:      e.message,
        goal:       task.goal,
      })
      return {
        verdict:    'NEEDS_FIXES',
        checks:     [{ name: 'Verifier error', command: 'internal', output: e.message, result: 'WARN' }],
        summary:    `Verification failed: ${e.message}`,
        blockers:   [],
        warnings:   ['Verifier threw an exception — manual review needed'],
        durationMs,
      }
    }
  }

  // ── Quick check: should this task be verified? ─────────
  shouldVerify(tag: string, filesChanged: string[] = []): boolean {
    if (tag === 'code' || tag === 'deploy') return true
    if (filesChanged.length >= 3) return true
    return false
  }
}

// ── Singleton ──────────────────────────────────────────────────
export const verifierAgent = new VerifierAgent()
