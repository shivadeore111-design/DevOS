// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// agents/verifier.ts — Adversarial implementation verifier.
// Job: TRY TO BREAK things, not confirm they work.
// Read-only tool access. Every check MUST run a real command.

import { callBgLLM }  from '../core/bgLLM'
import { auditTrail } from '../core/auditTrail'

// ── Types ─────────────────────────────────────────────────────

export type Verdict = 'PASS' | 'FAIL' | 'PARTIAL'

export interface VerificationCheck {
  what:    string   // what was verified
  command: string   // exact command run
  output:  string   // actual output
  passed:  boolean
  note?:   string
}

export interface VerificationResult {
  traceId:  string
  verdict:  Verdict
  checks:   VerificationCheck[]
  summary:  string
  retryN:   number
}

// ── Verifier system prompt ────────────────────────────────────

const VERIFIER_SYSTEM = `You are DevOS's adversarial verifier. Your ONE job is to TRY TO BREAK implementations.

TWO FAILURE MODES TO ACTIVELY FIGHT:
1. Reading code and writing PASS without running anything
2. Being seduced by the first 80% and missing that half the things don't work

HARD RULES:
- CANNOT modify any files — strictly read-only (ls, find, grep, cat, stat only for bash)
- EVERY check MUST run a command and show actual output
- MUST include at least one adversarial test: boundary values, concurrency, idempotency, missing resources
- "The code looks correct" is NOT verification — run it

REQUIRED OUTPUT FORMAT for every check:
### Check: [what you're verifying]
**Command run:** [exact command]
**Output:** [actual output, verbatim — NOT paraphrased]
**Result: PASS** or **FAIL** (expected: X, actual: Y)

End your response with exactly one of:
VERDICT: PASS
VERDICT: FAIL
VERDICT: PARTIAL`

// ── Run allowed read-only commands ────────────────────────────
// The verifier is restricted to read-only operations.

async function runReadOnlyCheck(command: string): Promise<string> {
  // Validate command is read-only
  const ALLOWED_PREFIXES = ['ls ', 'find ', 'grep ', 'cat ', 'stat ', 'ls\n', 'find\n', 'wc ', 'head ', 'tail ', 'echo ', 'type ']
  const trimmed = command.trim().toLowerCase()
  const isAllowed = ALLOWED_PREFIXES.some(p => trimmed.startsWith(p)) ||
    trimmed === 'ls' || trimmed === 'pwd'

  if (!isAllowed) {
    return `[BLOCKED] Read-only restriction: command "${command}" is not allowed in verification mode`
  }

  // Execute the command
  try {
    const { exec } = await import('child_process')
    const { promisify } = await import('util')
    const execAsync = promisify(exec)
    const { stdout, stderr } = await execAsync(command, {
      timeout: 10_000,
      cwd:     process.cwd(),
    })
    return stdout || stderr || '(no output)'
  } catch (e: any) {
    return `Error: ${e.message || e.stderr || 'unknown'}`
  }
}

// ── Extract checks from verifier output ───────────────────────

function extractVerdict(output: string): Verdict {
  const m = output.match(/VERDICT:\s*(PASS|FAIL|PARTIAL)/i)
  if (!m) return 'PARTIAL'
  return m[1].toUpperCase() as Verdict
}

function extractChecks(output: string): VerificationCheck[] {
  const checks: VerificationCheck[] = []
  const sections = output.split(/### Check:/g).slice(1)

  for (const section of sections) {
    const whatM   = section.match(/^(.+)\n/)
    const cmdM    = section.match(/\*\*Command run:\*\*\s*([^\n]+)/)
    const outM    = section.match(/\*\*Output:\*\*\s*([\s\S]+?)(?=\*\*Result:|\n###|VERDICT:|$)/)
    const passM   = section.match(/\*\*Result:\s*(PASS|FAIL)/)

    if (whatM) {
      checks.push({
        what:    whatM[1].trim(),
        command: cmdM  ? cmdM[1].trim()  : '(none)',
        output:  outM  ? outM[1].trim()  : '(no output recorded)',
        passed:  passM ? passM[1] === 'PASS' : false,
      })
    }
  }

  return checks
}

// ── Verifier class ────────────────────────────────────────────

export class VerifierAgent {

  async verify(
    task:        string,
    taskOutput:  string,
    filesChanged: string[],
    traceId:     string,
    retryN = 0,
  ): Promise<VerificationResult> {

    const prompt = `${VERIFIER_SYSTEM}

TASK THAT WAS IMPLEMENTED:
${task}

AGENT OUTPUT / RESULT:
${taskOutput.slice(0, 2000)}

FILES CHANGED:
${filesChanged.join('\n') || '(none listed)'}

Now verify this implementation. Run real commands. Find what's broken.
Remember: check boundary conditions, missing resources, error states.
Include at least one adversarial test.`

    const raw = await callBgLLM(prompt, `verify_${traceId}_${retryN}`)

    const verdict = extractVerdict(raw)
    const checks  = extractChecks(raw)

    const result: VerificationResult = {
      traceId,
      verdict,
      checks,
      summary: raw.slice(0, 500),
      retryN,
    }

    // Log to AuditTrail with same traceId as original task
    try {
      auditTrail.record({
        action:     'system',
        tool:       'verification',
        input:      JSON.stringify({ task: task.slice(0, 200), retryN }),
        output:     JSON.stringify({ verdict, checksTotal: checks.length, passed: checks.filter(c => c.passed).length }),
        durationMs: 0,
        success:    verdict !== 'FAIL',
        traceId,
      })
    } catch {}

    console.log(`[Verifier] VERDICT: ${verdict} (${checks.length} checks, retry ${retryN})`)
    return result
  }

  formatReport(result: VerificationResult): string {
    const lines: string[] = []

    for (const check of result.checks) {
      lines.push(`### Check: ${check.what}`)
      lines.push(`**Command run:** ${check.command}`)
      lines.push(`**Output:** ${check.output}`)
      lines.push(`**Result: ${check.passed ? 'PASS' : 'FAIL'}**`)
      lines.push('')
    }

    lines.push(`VERDICT: ${result.verdict}`)
    return lines.join('\n')
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const verifierAgent = new VerifierAgent()
