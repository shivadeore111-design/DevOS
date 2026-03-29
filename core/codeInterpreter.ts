// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/codeInterpreter.ts — Isolated code execution sandbox.
// Runs Python or Node.js scripts in per-session subdirectories under
// workspace/sandbox/interpreter/. Each session gets a clean directory;
// generated files are reported back and the directory is cleaned up
// automatically after 5 minutes.

import { execSync, exec } from 'child_process'
import fs   from 'fs'
import path from 'path'

const SANDBOX_DIR = path.join(process.cwd(), 'workspace', 'sandbox', 'interpreter')

export interface InterpreterResult {
  success:   boolean
  output:    string
  error?:    string
  files?:    string[]
  duration:  number
}

export async function runInSandbox(
  code:      string,
  language:  'python' | 'node',
  packages?: string[],
): Promise<InterpreterResult> {
  const start = Date.now()
  fs.mkdirSync(SANDBOX_DIR, { recursive: true })

  const sessionId  = `session_${Date.now()}`
  const sessionDir = path.join(SANDBOX_DIR, sessionId)
  fs.mkdirSync(sessionDir, { recursive: true })

  // Schedule cleanup after 5 minutes regardless of outcome
  const scheduleCleanup = () => {
    setTimeout(() => {
      try { fs.rmSync(sessionDir, { recursive: true, force: true }) } catch {}
    }, 5 * 60 * 1000)
  }

  try {
    if (language === 'python') {
      // Install packages if requested
      if (packages && packages.length > 0) {
        try {
          execSync(
            `pip install ${packages.join(' ')} --quiet --break-system-packages 2>&1`,
            { timeout: 30000 },
          )
        } catch {}
      }

      const scriptPath = path.join(sessionDir, 'script.py')
      fs.writeFileSync(scriptPath, code)

      return new Promise((resolve) => {
        exec(
          `python "${scriptPath}"`,
          { timeout: 30000, cwd: sessionDir },
          (error, stdout, stderr) => {
            scheduleCleanup()
            const files    = fs.readdirSync(sessionDir).filter(f => f !== 'script.py')
            const duration = Date.now() - start
            if (error && !stdout) {
              resolve({ success: false, output: stderr || error.message, error: stderr || error.message, files, duration })
            } else {
              resolve({ success: true, output: stdout || '(no output)', files, duration })
            }
          },
        )
      })
    } else {
      const scriptPath = path.join(sessionDir, 'script.js')
      fs.writeFileSync(scriptPath, code)

      return new Promise((resolve) => {
        exec(
          `node "${scriptPath}"`,
          { timeout: 30000, cwd: sessionDir },
          (error, stdout, stderr) => {
            scheduleCleanup()
            const files    = fs.readdirSync(sessionDir).filter(f => f !== 'script.js')
            const duration = Date.now() - start
            if (error && !stdout) {
              resolve({ success: false, output: stderr || error.message, error: stderr || error.message, files, duration })
            } else {
              resolve({ success: true, output: stdout || '(no output)', files, duration })
            }
          },
        )
      })
    }
  } catch (e: any) {
    scheduleCleanup()
    return { success: false, output: e.message, error: e.message, duration: Date.now() - start }
  }
}
