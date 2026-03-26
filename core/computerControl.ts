// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/computerControl.ts — Mouse, keyboard, screenshot, and
// vision-loop computer control.
// Primary: @nut-tree/nut-js (dynamically imported, try-catch).
// Fallback: PowerShell via execAsync — always works on Windows.

import { exec } from 'child_process'
import fs       from 'fs'
import path     from 'path'
import util     from 'util'

const execAsync = util.promisify(exec)

const SCREENSHOTS_DIR = path.join(process.cwd(), 'workspace', 'screenshots')
try { fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true }) } catch {}

// ── MOUSE ──────────────────────────────────────────────────────

export async function mouse_move(input: { x: number; y: number }) {
  try {
    const { mouse, Point } = await import('@nut-tree/nut-js')
    await mouse.setPosition(new Point(input.x, input.y))
    return { success: true, output: `Moved mouse to (${input.x}, ${input.y})` }
  } catch {
    // Fallback — PowerShell
    try {
      await execAsync(
        `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${input.x}, ${input.y})"`,
      )
      return { success: true, output: `Moved mouse to (${input.x}, ${input.y}) via PowerShell` }
    } catch (e2: any) {
      return { success: false, output: '', error: e2.message }
    }
  }
}

export async function mouse_click(input: {
  x?:      number
  y?:      number
  button?: 'left' | 'right'
  double?: boolean
}) {
  const { x, y, button = 'left', double = false } = input
  try {
    const { mouse, Button, Point } = await import('@nut-tree/nut-js')
    if (x !== undefined && y !== undefined) {
      await mouse.setPosition(new Point(x, y))
    }
    const btn = button === 'right' ? Button.RIGHT : Button.LEFT
    if (double) {
      await mouse.doubleClick(btn)
    } else {
      await mouse.click(btn)
    }
    return { success: true, output: `Clicked ${button} at (${x}, ${y})` }
  } catch {
    // Fallback — PowerShell P/Invoke click
    try {
      const xVal = x || 0
      const yVal = y || 0
      const psClick = [
        'Add-Type @"',
        'using System;',
        'using System.Runtime.InteropServices;',
        'public class Mouse {',
        '  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);',
        '  [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);',
        '  public const int MOUSEEVENTF_LEFTDOWN = 0x02;',
        '  public const int MOUSEEVENTF_LEFTUP   = 0x04;',
        '}',
        '"@',
        `[Mouse]::SetCursorPos(${xVal}, ${yVal})`,
        '[Mouse]::mouse_event([Mouse]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)',
        '[Mouse]::mouse_event([Mouse]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)',
      ].join('\n')

      await execAsync(`powershell -NoProfile -NonInteractive -Command "${psClick.replace(/"/g, '\\"').replace(/\n/g, '; ')}"`)
      return { success: true, output: `Clicked at (${xVal}, ${yVal}) via PowerShell` }
    } catch (e2: any) {
      return { success: false, output: '', error: e2.message }
    }
  }
}

// ── KEYBOARD ───────────────────────────────────────────────────

export async function keyboard_type(input: { text: string }) {
  try {
    const { keyboard } = await import('@nut-tree/nut-js')
    await keyboard.type(input.text)
    return { success: true, output: `Typed: ${input.text.slice(0, 50)}` }
  } catch {
    // Fallback — PowerShell SendKeys
    try {
      const escaped = input.text
        .replace(/\\/g, '\\\\')
        .replace(/"/g,  '\\"')
        .replace(/\+/g, '{+}')
        .replace(/\^/g, '{^}')
        .replace(/~/g,  '{~}')
        .replace(/%/g,  '{%}')
      await execAsync(
        `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')"`,
      )
      return { success: true, output: `Typed via PowerShell: ${input.text.slice(0, 50)}` }
    } catch (e2: any) {
      return { success: false, output: '', error: e2.message }
    }
  }
}

export async function keyboard_press(input: { key: string }) {
  const psKeyMap: Record<string, string> = {
    enter:     'ENTER',     tab:       'TAB',      escape:    'ESCAPE',
    esc:       'ESCAPE',    space:     'SPACE',     backspace: 'BACKSPACE',
    delete:    'DELETE',    up:        'UP',        down:      'DOWN',
    left:      'LEFT',      right:     'RIGHT',     f5:        'F5',
    f11:       'F11',       ctrl_c:    'c',         ctrl_v:    'v',
    ctrl_a:    'a',         ctrl_z:    'z',
  }

  const lower = input.key.toLowerCase()

  try {
    const { keyboard, Key } = await import('@nut-tree/nut-js')
    const keyNameMap: Record<string, number> = {
      enter:     Key.Enter,     tab:       Key.Tab,
      escape:    Key.Escape,    esc:       Key.Escape,
      space:     Key.Space,     backspace: Key.Backspace,
      delete:    Key.Delete,    up:        Key.Up,
      down:      Key.Down,      left:      Key.Left,
      right:     Key.Right,
    }
    const k = keyNameMap[lower]
    if (k !== undefined) {
      await keyboard.pressKey(k)
      await keyboard.releaseKey(k)
      return { success: true, output: `Pressed key: ${input.key}` }
    }
  } catch {}

  // Fallback — PowerShell SendKeys
  try {
    const psKey = psKeyMap[lower] || input.key.toUpperCase()
    const isCtrl = lower.startsWith('ctrl_')
    const psCmd  = isCtrl
      ? `[System.Windows.Forms.SendKeys]::SendWait('^{${psKey}}')`
      : `[System.Windows.Forms.SendKeys]::SendWait('{${psKey}}')`
    await execAsync(
      `powershell -command "Add-Type -AssemblyName System.Windows.Forms; ${psCmd}"`,
    )
    return { success: true, output: `Pressed key: ${input.key} via PowerShell` }
  } catch (e: any) {
    return { success: false, output: '', error: e.message }
  }
}

// ── SCREENSHOT ─────────────────────────────────────────────────

export async function screenshot(_input?: {
  region?: { x: number; y: number; width: number; height: number }
}) {
  const fileName   = `screen_${Date.now()}.png`
  const filePath   = path.join(SCREENSHOTS_DIR, fileName)
  const escaped    = filePath.replace(/\\/g, '\\\\')

  const lines = [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$screen   = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
    '$bitmap   = New-Object System.Drawing.Bitmap([int]$screen.Width, [int]$screen.Height)',
    '$graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
    '$graphics.CopyFromScreen($screen.Left, $screen.Top, 0, 0, $bitmap.Size)',
    `$bitmap.Save("${escaped}")`,
    '$graphics.Dispose()',
    '$bitmap.Dispose()',
    `Write-Output "saved:${escaped}"`,
  ]

  try {
    await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${lines.join('; ').replace(/"/g, '\\"')}"`,
    )

    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath)
      return {
        success: true,
        output:  `Screenshot saved: ${filePath} (${Math.round(stats.size / 1024)}kb)`,
        path:    filePath,
      }
    }
    return { success: false, output: '', error: 'Screenshot file not created' }
  } catch (e: any) {
    return { success: false, output: '', error: `Screenshot failed: ${e.message}` }
  }
}

// ── SCREEN READ ────────────────────────────────────────────────

export async function screen_read(_input?: { describe?: boolean }) {
  const shot = await screenshot()
  if (!shot.success || !shot.path) {
    return { success: false, output: '', error: shot.error }
  }

  try {
    const imageData = fs.readFileSync(shot.path)
    const base64    = imageData.toString('base64')

    // Describe via Ollama llava (vision model)
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model:  'llava:7b',
          prompt: 'Describe what is visible on this screen. List all visible text, buttons, inputs, and UI elements.',
          images: [base64],
          stream: false,
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (response.ok) {
        const data        = await response.json() as any
        const description = (data.response as string) || 'No description available'
        return {
          success:     true,
          output:      `Screenshot: ${shot.path}\nScreen contents:\n${description}`,
          path:        shot.path,
          description,
        }
      }
    } catch {}

    // Fallback — return path only (no vision model)
    return {
      success:     true,
      output:      `Screenshot captured: ${shot.path}\nVision model not available — use screenshot path for manual review.`,
      path:        shot.path,
      description: 'Vision model not available',
    }
  } catch (e: any) {
    return { success: false, output: '', error: e.message }
  }
}

// ── VISION LOOP ────────────────────────────────────────────────
// Iterative see → decide → act loop driven by the active LLM.

export async function vision_loop(input: {
  goal:      string
  maxSteps?: number
  apiKey?:   string
  model?:    string
  provider?: string
}) {
  const { goal, maxSteps = 10 } = input
  const history: any[] = []
  let   attempts       = 0

  console.log(`[VisionLoop] Starting: "${goal}"`)

  while (attempts < maxSteps) {
    attempts++

    // See current screen
    const screen = await screen_read()
    if (!screen.success) break

    try {
      const { getNextAvailableAPI } = await import('../providers/router')
      const next = getNextAvailableAPI()
      if (!next) break

      const key = next.entry.key.startsWith('env:')
        ? (process.env[next.entry.key.replace('env:', '')] || '')
        : next.entry.key

      const { callLLM } = await import('./agentLoop')

      const decisionPrompt = `You are controlling a computer to complete this goal: "${goal}"

Current screen: ${screen.description || 'unknown'}

Previous actions: ${JSON.stringify(history.slice(-3))}

Decide the next action. Return ONLY valid JSON:
{
  "action": "click|type|press|wait|done",
  "reason": "why this action",
  "x": 0,
  "y": 0,
  "text": "",
  "key": ""
}

If goal is complete return: {"action": "done", "reason": "goal completed"}`

      const raw       = await callLLM(decisionPrompt, key, next.entry.model, next.entry.provider)
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) continue

      const step = JSON.parse(jsonMatch[0]) as any

      if (step.action === 'done') {
        console.log(`[VisionLoop] Goal completed in ${attempts} steps`)
        return {
          success: true,
          output:  `Goal completed: "${goal}" in ${attempts} steps`,
          history,
        }
      }

      // Execute chosen action
      let result: { success: boolean; output: string; error?: string } | null = null
      if (step.action === 'click')  result = await mouse_click({ x: step.x, y: step.y })
      if (step.action === 'type')   result = await keyboard_type({ text: step.text || '' })
      if (step.action === 'press')  result = await keyboard_press({ key: step.key || 'enter' })
      if (step.action === 'wait') {
        await new Promise(r => setTimeout(r, 1500))
        result = { success: true, output: 'waited 1.5s' }
      }

      history.push({ step, success: result?.success, attempt: attempts })
      console.log(`[VisionLoop] Step ${attempts}: ${step.action} — ${step.reason}`)

      // Brief pause between actions
      await new Promise(r => setTimeout(r, 800))

    } catch (e: any) {
      console.warn(`[VisionLoop] Step ${attempts} error: ${e.message}`)
      history.push({ error: e.message, attempt: attempts })
    }
  }

  return {
    success: false,
    output:  `Vision loop ended after ${attempts} steps without completing goal`,
    history,
  }
}
