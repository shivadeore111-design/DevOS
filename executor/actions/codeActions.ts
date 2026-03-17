// ============================================================
// executor/actions/codeActions.ts — Python / Node / PowerShell runners
// ============================================================

import { execSync } from 'child_process'
import * as fs   from 'fs'
import * as path from 'path'
import * as os   from 'os'

export async function runPython(code: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `devos_${Date.now()}.py`)
  fs.writeFileSync(tmpFile, code)
  try {
    const out = execSync(`python "${tmpFile}"`, { timeout: 30000 }).toString()
    return out || '(no output)'
  } catch (err: any) {
    return `Error: ${err?.stderr?.toString() || err?.message}`
  } finally {
    try { fs.unlinkSync(tmpFile) } catch {}
  }
}

export async function runNode(code: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `devos_${Date.now()}.js`)
  fs.writeFileSync(tmpFile, code)
  try {
    const out = execSync(`node "${tmpFile}"`, { timeout: 30000 }).toString()
    return out || '(no output)'
  } catch (err: any) {
    return `Error: ${err?.stderr?.toString() || err?.message}`
  } finally {
    try { fs.unlinkSync(tmpFile) } catch {}
  }
}

export async function runPowerShell(code: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `devos_${Date.now()}.ps1`)
  fs.writeFileSync(tmpFile, code)
  try {
    const out = execSync(
      `powershell -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { timeout: 30000 }
    ).toString()
    return out || '(no output)'
  } catch (err: any) {
    return `Error: ${err?.stderr?.toString() || err?.message}`
  } finally {
    try { fs.unlinkSync(tmpFile) } catch {}
  }
}
