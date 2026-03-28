// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/computerControl.ts — Mouse, keyboard, screenshot, and
// vision-loop computer control.
// Pure PowerShell implementation — zero native dependencies.
// Works on any Windows machine without Visual Studio or nut-js.

import { exec } from 'child_process'
import { promisify } from 'util'
import fs   from 'fs'
import path from 'path'

const execAsync = promisify(exec)

const SCREENSHOTS_DIR = path.join(process.cwd(), 'workspace', 'screenshots')
try { fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true }) } catch {}

// ── PowerShell helpers ────────────────────────────────────────

// Run a simple one-liner PowerShell command
async function ps(script: string): Promise<string> {
  try {
    const escaped = script.replace(/"/g, '\\"')
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${escaped}"`,
      { timeout: 15000 },
    )
    return stdout.trim()
  } catch (e: any) {
    return e.message || ''
  }
}

// Write a .ps1 file and execute it — avoids all quoting issues for complex scripts
async function psFile(script: string): Promise<string> {
  const tmpFile = path.join(process.cwd(), 'workspace', `ps_${Date.now()}.ps1`)
  fs.writeFileSync(tmpFile, script, 'utf8')
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { timeout: 15000 },
    )
    try { fs.unlinkSync(tmpFile) } catch {}
    return stdout.trim()
  } catch (e: any) {
    try { fs.unlinkSync(tmpFile) } catch {}
    return e.message || ''
  }
}

// ── MOUSE ──────────────────────────────────────────────────────

export async function moveMouse(x: number, y: number): Promise<string> {
  await psFile(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
`)
  return `Mouse moved to (${x}, ${y})`
}

export async function clickMouse(
  x: number,
  y: number,
  button: string = 'left',
  double: boolean = false,
): Promise<string> {
  const clicks = double ? 2 : 1
  const isRight = button === 'right'

  await psFile(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseClick {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
  public const int MOUSEEVENTF_LEFTDOWN  = 0x02;
  public const int MOUSEEVENTF_LEFTUP   = 0x04;
  public const int MOUSEEVENTF_RIGHTDOWN = 0x08;
  public const int MOUSEEVENTF_RIGHTUP  = 0x10;
}
"@
[MouseClick]::SetCursorPos(${x}, ${y})
Start-Sleep -Milliseconds 100
for ($i = 0; $i -lt ${clicks}; $i++) {
  ${isRight
    ? `[MouseClick]::mouse_event([MouseClick]::MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 50
  [MouseClick]::mouse_event([MouseClick]::MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)`
    : `[MouseClick]::mouse_event([MouseClick]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 50
  [MouseClick]::mouse_event([MouseClick]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)`}
  Start-Sleep -Milliseconds 80
}
`)
  return `${double ? 'Double-clicked' : 'Clicked'} ${button} at (${x}, ${y})`
}

// ── KEYBOARD ───────────────────────────────────────────────────

export async function typeText(text: string): Promise<string> {
  // WScript.Shell SendKeys — most reliable for text input
  const safe = text.replace(/'/g, "''").replace(/[+^%~(){}]/g, '{$&}')
  await psFile(`
$wsh = New-Object -ComObject WScript.Shell
Start-Sleep -Milliseconds 200
$wsh.SendKeys('${safe}')
`)
  return `Typed: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`
}

export async function pressKey(key: string): Promise<string> {
  const keyMap: Record<string, string> = {
    enter:          '{ENTER}',
    tab:            '{TAB}',
    escape:         '{ESC}',
    esc:            '{ESC}',
    backspace:      '{BACKSPACE}',
    delete:         '{DELETE}',
    up:             '{UP}',
    down:           '{DOWN}',
    left:           '{LEFT}',
    right:          '{RIGHT}',
    home:           '{HOME}',
    end:            '{END}',
    pageup:         '{PGUP}',
    pagedown:       '{PGDN}',
    f1:             '{F1}',  f2: '{F2}',  f3: '{F3}',  f4: '{F4}',
    f5:             '{F5}',  f6: '{F6}',  f7: '{F7}',  f8: '{F8}',
    f11:            '{F11}', f12: '{F12}',
    'ctrl+c':       '^c',
    'ctrl+v':       '^v',
    'ctrl+a':       '^a',
    'ctrl+z':       '^z',
    'ctrl+s':       '^s',
    'ctrl+t':       '^t',
    'ctrl+w':       '^w',
    'ctrl+l':       '^l',
    'ctrl+r':       '^r',
    'ctrl_c':       '^c',
    'ctrl_v':       '^v',
    'ctrl_a':       '^a',
    'ctrl_z':       '^z',
    'ctrl_l':       '^l',
    'alt+f4':       '%{F4}',
    win:            '{LWIN}',
  }
  const mapped = keyMap[key.toLowerCase()] || `{${key.toUpperCase()}}`
  await psFile(`
$wsh = New-Object -ComObject WScript.Shell
Start-Sleep -Milliseconds 100
$wsh.SendKeys('${mapped}')
`)
  return `Pressed: ${key}`
}

// ── SCREENSHOT ─────────────────────────────────────────────────

export async function takeScreenshot(): Promise<string> {
  const filename = `screenshot_${Date.now()}.png`
  const filepath = path.join(SCREENSHOTS_DIR, filename)
  const escaped  = filepath.replace(/\\/g, '\\\\')

  await psFile(`
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen   = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap   = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bitmap.Save('${escaped}')
$graphics.Dispose()
$bitmap.Dispose()
`)

  // Trim old screenshots — keep only last 10
  try {
    const files = fs.readdirSync(SCREENSHOTS_DIR)
      .filter(f => f.endsWith('.png'))
      .sort()
    if (files.length > 10) {
      files.slice(0, files.length - 10).forEach(f => {
        try { fs.unlinkSync(path.join(SCREENSHOTS_DIR, f)) } catch {}
      })
    }
  } catch {}

  if (fs.existsSync(filepath)) return filepath
  throw new Error('Screenshot failed — file not created')
}

export async function readScreen(): Promise<string> {
  const filepath = await takeScreenshot()
  return `Screenshot saved: ${filepath}`
}

// ── BROWSER ────────────────────────────────────────────────────

export async function openBrowser(url: string): Promise<string> {
  const safeUrl = url.replace(/'/g, '%27')
  await psFile(`Start-Process '${safeUrl}'`)
  // Wait for browser to load
  await new Promise(r => setTimeout(r, 3000))
  return `Opened browser: ${url}`
}

export async function focusWindow(title: string): Promise<string> {
  await psFile(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
}
"@
$hwnd = [Win32]::FindWindow([NullString]::Value, "${title}")
if ($hwnd -ne [IntPtr]::Zero) { [Win32]::SetForegroundWindow($hwnd) }
`)
  await new Promise(r => setTimeout(r, 500))
  return `Focused window: ${title}`
}

// ── SCREEN SIZE ────────────────────────────────────────────────

export async function getScreenSize(): Promise<{ width: number; height: number }> {
  const result = await psFile(`
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Output "$($screen.Width)x$($screen.Height)"
`)
  const [w, h] = result.split('x').map(Number)
  return { width: w || 1920, height: h || 1080 }
}

// ── VISION LOOP ────────────────────────────────────────────────
// Iterative see → decide → act loop driven by the active LLM.

export async function visionLoop(
  goal: string,
  maxSteps: number = 10,
  callLLM: (prompt: string) => Promise<string>,
): Promise<string> {
  const results: string[] = []

  for (let step = 1; step <= maxSteps; step++) {
    // Take screenshot
    let screenshotPath: string
    try {
      screenshotPath = await takeScreenshot()
    } catch (e: any) {
      return `Vision loop failed at step ${step}: screenshot error — ${e.message}`
    }

    const prompt = `
You are controlling a Windows computer to achieve this goal: "${goal}"

Steps completed so far:
${results.length > 0 ? results.map((r, i) => `${i + 1}. ${r}`).join('\n') : 'None yet'}

Screenshot taken at: ${screenshotPath}

Decide the next action. Respond with ONLY a JSON object:
{
  "action": "click|type|key|scroll|done|failed",
  "x": 500,
  "y": 300,
  "text": "text to type if action is type",
  "key": "key name if action is key",
  "reason": "why this action",
  "confidence": 0.85,
  "goal_complete": false
}

Rules:
- Use "done" when the goal is fully complete
- Use "failed" if you cannot proceed
- confidence below 0.5 → use "done" and explain in reason
- For browser: click address bar (ctrl+l) → type URL → press enter
`

    let actionJson: any
    try {
      const response  = await callLLM(prompt)
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')
      actionJson = JSON.parse(jsonMatch[0])
    } catch {
      results.push(`Step ${step}: LLM parse error — skipping`)
      continue
    }

    if (actionJson.goal_complete || actionJson.action === 'done') {
      results.push(`Goal complete: ${actionJson.reason}`)
      break
    }
    if (actionJson.action === 'failed') {
      return `Vision loop failed: ${actionJson.reason}`
    }
    if ((actionJson.confidence ?? 1) < 0.5) {
      return `Vision loop stopped: low confidence (${actionJson.confidence}) — ${actionJson.reason}`
    }

    // Execute action
    let result = ''
    switch (actionJson.action) {
      case 'click':
        result = await clickMouse(actionJson.x ?? 0, actionJson.y ?? 0)
        await new Promise(r => setTimeout(r, 800))
        break
      case 'type':
        result = await typeText(actionJson.text || '')
        await new Promise(r => setTimeout(r, 500))
        break
      case 'key':
        result = await pressKey(actionJson.key || 'enter')
        await new Promise(r => setTimeout(r, 500))
        break
      case 'scroll':
        await psFile(`
$wsh = New-Object -ComObject WScript.Shell
$wsh.SendKeys('{PGDN}')
`)
        result = 'Scrolled down'
        await new Promise(r => setTimeout(r, 500))
        break
      default:
        result = `Unknown action: ${actionJson.action}`
    }

    results.push(`Step ${step}: ${actionJson.action} — ${result} (${actionJson.reason})`)
    console.log(`[VisionLoop] Step ${step}: ${actionJson.action} — ${actionJson.reason}`)
  }

  return results.join('\n')
}

/*
MANUAL TEST — run in PowerShell from DevOS root:
  node -e "const cc = require('./core/computerControl'); cc.takeScreenshot().then(p => console.log('Screenshot:', p)).catch(console.error);"

Expected: Screenshot saved to workspace/screenshots/screenshot_[timestamp].png

Full flow test — ask Aiden:
  "open chrome, go to google.com, search for batman, tell me what you see"

Expected plan:
  Step 1: open_browser({ url: 'https://www.google.com' })
  Step 2: wait({ ms: 2000 })
  Step 3: keyboard_press({ key: 'ctrl+l' })
  Step 4: keyboard_type({ text: 'batman' })
  Step 5: keyboard_press({ key: 'enter' })
  Step 6: wait({ ms: 1500 })
  Step 7: screenshot()
  Step 8: screen_read()  -- describe what's visible
*/
