// ============================================================
// executor/actions/systemActions.ts — OS info, notifications, clipboard
// ============================================================

import { execSync } from 'child_process'
import * as os from 'os'

export function getSystemInfo(): Record<string, string> {
  return {
    platform:    process.platform,
    arch:        process.arch,
    nodeVersion: process.version,
    hostname:    os.hostname(),
    homedir:     os.homedir(),
    cpus:        os.cpus().length.toString(),
    totalMemGB:  (os.totalmem() / 1e9).toFixed(1),
    freeMemGB:   (os.freemem()  / 1e9).toFixed(1),
    uptime:      Math.floor(os.uptime() / 3600) + 'h',
  }
}

export async function sendNotification(title: string, message: string): Promise<string> {
  if (process.platform === 'win32') {
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $notify = New-Object System.Windows.Forms.NotifyIcon
      $notify.Icon = [System.Drawing.SystemIcons]::Information
      $notify.Visible = $true
      $notify.ShowBalloonTip(5000, '${title.replace(/'/g, "''")}', '${message.replace(/'/g, "''")}', [System.Windows.Forms.ToolTipIcon]::Info)
      Start-Sleep -Seconds 6
      $notify.Dispose()
    `.replace(/\n/g, ' ')
    execSync(`powershell -Command "${script}"`, { stdio: 'ignore' })
    return `Notification sent: ${title}`
  }
  if (process.platform === 'darwin') {
    execSync(`osascript -e 'display notification "${message}" with title "${title}"'`)
    return `Notification sent: ${title}`
  }
  return `Notifications not supported on ${process.platform}`
}

export async function clipboardWrite(text: string): Promise<string> {
  if (process.platform === 'win32') {
    execSync(`echo ${text} | clip`)
    return `Copied to clipboard`
  }
  if (process.platform === 'darwin') {
    execSync(`echo "${text}" | pbcopy`)
    return `Copied to clipboard`
  }
  return 'Clipboard not supported on this platform'
}
