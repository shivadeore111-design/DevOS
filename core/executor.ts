// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/executor.ts — Unified action executor with smart routing,
// retry + fallback, FaultEngine classification, TruthCheck verification,
// and session-level audit trail.
//
// Routing priority:
//   api_call  → APIRegistry (API-first, BrowserVault UI fallback)
//   all others → ScreenAgent (mouse/keyboard/screenshot)

import { exec }   from 'child_process'
import { promisify } from 'util'
import * as fs   from 'fs'
import * as path from 'path'

import { ComputerUseAction, ApiCallAction } from '../types/computerUse'
import {
  ExecutorResult,
  ExecutorError,
  ExecutorErrorType,
  ExecutorSession,
} from '../types/executor'
import { screenAgent } from '../integrations/computerUse/screenAgent'
import { apiRegistry } from '../integrations/computerUse/apiRegistry'
import { faultEngine } from './faultEngine'
import { truthCheck }  from './truthCheck'
import { memoryLayers } from '../memory/memoryLayers'

const execAsync = promisify(exec)

// ── Real tool execution ───────────────────────────────────────

async function runTool(
  type: string,
  payload: any,
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    switch (type) {

      case 'shell_exec': {
        const cmd = payload.command || payload.cmd || ''
        if (!cmd) return { success: false, output: '', error: 'No command provided' }
        const { stdout, stderr } = await execAsync(cmd, {
          shell:   'powershell.exe',
          timeout: 30000,
          cwd:     process.cwd(),
        })
        return { success: true, output: stdout || stderr }
      }

      case 'file_write': {
        const filePath = payload.path || payload.file || ''
        const content  = payload.content || payload.command || ''
        if (!filePath) return { success: false, output: '', error: 'No path provided' }
        const resolved = filePath.startsWith('C:') ? filePath : path.join(process.cwd(), filePath)
        fs.mkdirSync(path.dirname(resolved), { recursive: true })
        fs.writeFileSync(resolved, content, 'utf-8')
        return { success: true, output: `File written: ${resolved}` }
      }

      case 'file_read': {
        const filePath = payload.path || payload.file || ''
        if (!filePath) return { success: false, output: '', error: 'No path provided' }
        const resolved = filePath.startsWith('C:') ? filePath : path.join(process.cwd(), filePath)
        const content  = fs.readFileSync(resolved, 'utf-8')
        return { success: true, output: content.slice(0, 2000) }
      }

      case 'run_python': {
        const script  = payload.script || payload.command || ''
        const tmpFile = path.join(process.cwd(), 'workspace', `tmp_${Date.now()}.py`)
        fs.mkdirSync(path.dirname(tmpFile), { recursive: true })
        fs.writeFileSync(tmpFile, script)
        const { stdout, stderr } = await execAsync(`python "${tmpFile}"`, { timeout: 30000 })
        fs.unlinkSync(tmpFile)
        return { success: true, output: stdout || stderr }
      }

      case 'run_node': {
        const script  = payload.script || payload.command || ''
        const tmpFile = path.join(process.cwd(), 'workspace', `tmp_${Date.now()}.js`)
        fs.mkdirSync(path.dirname(tmpFile), { recursive: true })
        fs.writeFileSync(tmpFile, script)
        const { stdout, stderr } = await execAsync(`node "${tmpFile}"`, { timeout: 30000 })
        fs.unlinkSync(tmpFile)
        return { success: true, output: stdout || stderr }
      }

      case 'open_browser': {
        const url = payload.url || payload.command || 'https://google.com'
        await execAsync(`Start-Process "${url}"`, { shell: 'powershell.exe' })
        return { success: true, output: `Opened: ${url}` }
      }

      case 'notify': {
        const msg = (payload.message || payload.command || '').replace(/'/g, '')
        await execAsync(
          `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${msg}', 'DevOS')`,
          { shell: 'powershell.exe' }
        )
        return { success: true, output: `Notification sent: ${msg}` }
      }

      case 'system_info': {
        const { stdout } = await execAsync(
          'Get-ComputerInfo | Select-Object CsName, OsName, TotalPhysicalMemory | ConvertTo-Json',
          { shell: 'powershell.exe', timeout: 10000 }
        )
        return { success: true, output: stdout }
      }

      case 'web_search': {
        const query = payload.query || payload.command || ''
        await execAsync(
          `Start-Process "https://google.com/search?q=${encodeURIComponent(query)}"`,
          { shell: 'powershell.exe' }
        )
        return { success: true, output: `Searched: ${query}` }
      }

      default: {
        // Fallback — try running as shell command
        const cmd = payload.command || ''
        if (cmd) {
          const { stdout, stderr } = await execAsync(cmd, { shell: 'powershell.exe', timeout: 30000 })
          return { success: true, output: stdout || stderr }
        }
        return { success: false, output: '', error: `Unknown tool: ${type}` }
      }
    }
  } catch (err: any) {
    return { success: false, output: '', error: err.message }
  }
}

// ── Executor ──────────────────────────────────────────────────

class Executor {
  /** Exposed as a getter so the API route can read live progress. */
  currentSession: ExecutorSession | null = null

  // ── Session management ────────────────────────────────────────

  startSession(goal: string): string {
    const sessionId = `exec_${Date.now()}`
    this.currentSession = {
      sessionId,
      goal,
      startedAt:       new Date().toISOString(),
      results:         [],
      totalDurationMs: 0,
      successRate:     0,
    }
    return sessionId
  }

  endSession(): ExecutorSession | null {
    if (!this.currentSession) return null
    const s             = this.currentSession
    s.totalDurationMs   = s.results.reduce((acc, r) => acc + r.durationMs, 0)
    const successes     = s.results.filter(
      r => r.status === 'success' || r.status === 'fallback' || r.status === 'retried',
    ).length
    s.successRate       = s.results.length ? successes / s.results.length : 0
    this.currentSession = null
    return s
  }

  // ── Main execute ──────────────────────────────────────────────

  /**
   * Execute a single ComputerUseAction with:
   *   - configurable retry loop with exponential backoff
   *   - timeout wrapper per attempt
   *   - TruthCheck verification on success
   *   - FaultEngine error classification on failure
   *   - fallback action when all retries exhausted
   */
  async execute(action: ComputerUseAction): Promise<ExecutorResult> {
    const start       = Date.now()
    let retriesUsed   = 0
    let usedFallback  = false
    let verifiedByTruthCheck = false

    const maxRetries = action.retries  ?? 2
    const timeoutMs  = action.timeoutMs ?? 15_000

    // ── Retry loop ────────────────────────────────────────────
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Per-attempt timeout
        const data = await Promise.race([
          this.route(action),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeoutMs),
          ),
        ])

        // TruthCheck verification
        verifiedByTruthCheck = await truthCheck.verifyAction(
          action.type,
          { actionId: action.id },
        )

        const result: ExecutorResult = {
          actionId:             action.id,
          status:               retriesUsed > 0 ? 'retried' : 'success',
          data,
          durationMs:           Date.now() - start,
          retriesUsed,
          usedFallback,
          verifiedByTruthCheck,
        }

        await this.audit(action, result)
        this.currentSession?.results.push(result)
        return result

      } catch (err: any) {
        const classified = this.classifyError(err)

        // Retry if retryable and attempts remain
        if (classified.retryable && attempt < maxRetries) {
          retriesUsed++
          console.warn(
            `[Executor] Retry ${retriesUsed}/${maxRetries} for action ${action.id} — ${classified.message}`,
          )
          await new Promise(r => setTimeout(r, 800 * retriesUsed)) // linear backoff
          continue
        }

        // Attempt fallback action
        if (action.fallback && !usedFallback) {
          usedFallback = true
          console.warn(`[Executor] Running fallback for action ${action.id}`)
          try {
            const fallbackData = await this.route(action.fallback)
            const result: ExecutorResult = {
              actionId:             action.id,
              status:               'fallback',
              data:                 fallbackData,
              durationMs:           Date.now() - start,
              retriesUsed,
              usedFallback:         true,
              verifiedByTruthCheck: false,
            }
            await this.audit(action, result)
            this.currentSession?.results.push(result)
            return result
          } catch {
            // Fallback also failed — fall through to fail result
          }
        }

        // All attempts and fallback exhausted
        const result: ExecutorResult = {
          actionId:             action.id,
          status:               'failed',
          error:                classified,
          durationMs:           Date.now() - start,
          retriesUsed,
          usedFallback,
          verifiedByTruthCheck,
        }
        await this.audit(action, result)
        this.currentSession?.results.push(result)
        return result
      }
    }

    // Should never be reached
    return {
      actionId:             action.id,
      status:               'skipped',
      durationMs:           Date.now() - start,
      retriesUsed:          0,
      usedFallback:         false,
      verifiedByTruthCheck: false,
    }
  }

  // ── Smart routing ─────────────────────────────────────────────

  private async route(action: ComputerUseAction): Promise<any> {
    switch (action.type) {
      case 'api_call': {
        const a = action as ApiCallAction
        const { result } = await apiRegistry.execute(a.service, {
          endpoint: a.endpoint,
          method:   a.method,
          payload:  a.payload,
          headers:  a.headers,
        })
        return result
      }

      case 'click':
      case 'type':
      case 'scroll':
      case 'keypress':
      case 'screenshot':
        return screenAgent.execute(action)

      default: {
        // Real tool execution for DevOS skills
        const a       = action as any
        const payload = a.payload || { command: a.command || a.description }
        const result  = await runTool(a.type, payload)
        if (!result.success) throw new Error(result.error || 'Tool execution failed')
        return result.output
      }
    }
  }

  // ── Error classification ──────────────────────────────────────

  /**
   * Map a raw error to a typed ExecutorError.
   * Uses FaultEngine for the repair suggestion, then performs pattern
   * matching on the message to determine ExecutorErrorType.
   */
  private classifyError(err: any): ExecutorError {
    const msg = err?.message ?? String(err)

    // FaultEngine for repair suggestion (sync call)
    let repairSuggestion: string | undefined
    try {
      const fault     = faultEngine.classify(msg)
      repairSuggestion = fault.repairCommand ?? fault.manualFix
    } catch { /* non-fatal */ }

    let type: ExecutorErrorType = 'UNKNOWN'
    let retryable               = true

    if      (msg.includes('timeout'))                              { type = 'TIMEOUT';            retryable = true  }
    else if (/API|fetch|ECONNREFUSED|ENOTFOUND/i.test(msg))        { type = 'API_ERROR';           retryable = true  }
    else if (/selector|element|visible/i.test(msg))                { type = 'UI_ERROR';            retryable = true  }
    else if (/screen|mouse|keyboard/i.test(msg))                   { type = 'SCREEN_ERROR';        retryable = true  }
    else if (/Rejected by|CommandGate/i.test(msg))                 { type = 'REJECTED_BY_USER';    retryable = false }
    else if (/confidence/i.test(msg))                              { type = 'CONFIDENCE_TOO_LOW';  retryable = false }
    else if (/Unknown action/i.test(msg))                          { type = 'VALIDATION_ERROR';    retryable = false }

    return { type, message: msg, retryable, repairSuggestion }
  }

  // ── Audit ─────────────────────────────────────────────────────

  private async audit(action: ComputerUseAction, result: ExecutorResult): Promise<void> {
    const entry =
      `[${new Date().toISOString()}] ${action.type} → ${result.status}` +
      ` (${result.durationMs}ms, retries:${result.retriesUsed})` +
      (result.error ? ` | ERROR: ${result.error.message}` : '')

    memoryLayers.write(entry, ['computer_use', 'audit', result.status])
  }
}

export const executor = new Executor()
