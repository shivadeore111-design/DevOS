// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/voice/audio.ts — Platform audio I/O: recording + playback.
//
// Recording:   Windows MCI (P/Invoke via PowerShell, no third-party dep)
// Playback:    Windows Media Player (presentationCore) → Start-Process fallback
//
// Cross-platform note: recording falls back to arecord/sox on Linux/macOS.
// Playback falls back to afplay (macOS) / paplay (Linux).

import fs   from 'fs'
import path from 'path'
import { exec }     from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const WORKSPACE = path.join(process.cwd(), 'workspace')

function ensureWorkspace(): void {
  if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true })
}

// ── Record audio from microphone ──────────────────────────────────────────────

/**
 * Record audio from the default microphone.
 *
 * @param durationSeconds  Recording length in seconds (default 5).
 * @param outputPath       Where to save the .wav file. Defaults to a temp file in workspace/.
 * @returns                Resolved path to the recorded file.
 */
export async function recordAudio(
  durationSeconds: number = 5,
  outputPath?: string,
): Promise<string> {
  ensureWorkspace()

  const outPath = outputPath ?? path.join(WORKSPACE, `recording_${Date.now()}.wav`)
  const durationMs = Math.round(durationSeconds * 1000)

  if (process.platform === 'win32') {
    return _recordWindows(outPath, durationMs)
  } else {
    return _recordUnix(outPath, durationMs)
  }
}

async function _recordWindows(outputPath: string, durationMs: number): Promise<string> {
  const escapedPath = outputPath.replace(/\\/g, '\\\\')

  const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Threading;
using System.Runtime.InteropServices;

public class AudioRecorder {
  [DllImport("winmm.dll")]
  private static extern int mciSendString(
    string command,
    System.Text.StringBuilder returnValue,
    int returnLength,
    IntPtr winHandle
  );

  public static void Record(string outputPath, int durationMs) {
    mciSendString("open new Type waveaudio Alias recsound", null, 0, IntPtr.Zero);
    mciSendString("set recsound channels 1 bitspersample 16 samplespersec 16000", null, 0, IntPtr.Zero);
    mciSendString("record recsound", null, 0, IntPtr.Zero);
    Thread.Sleep(durationMs);
    mciSendString("stop recsound", null, 0, IntPtr.Zero);
    mciSendString("save recsound " + outputPath, null, 0, IntPtr.Zero);
    mciSendString("close recsound", null, 0, IntPtr.Zero);
  }
}
"@
[AudioRecorder]::Record("${escapedPath}", ${durationMs})
Write-Output "${outputPath}"
`.trim()

  const psFile = path.join(WORKSPACE, `record_${Date.now()}.ps1`)
  fs.writeFileSync(psFile, psScript)

  try {
    await execAsync(
      `powershell.exe -ExecutionPolicy Bypass -File "${psFile}"`,
      { timeout: durationMs + 8_000 },
    )
    return outputPath
  } catch (e: any) {
    throw new Error(`[Audio] Recording failed: ${e.message}`)
  } finally {
    try { fs.unlinkSync(psFile) } catch { /* ignore */ }
  }
}

async function _recordUnix(outputPath: string, durationMs: number): Promise<string> {
  const seconds = Math.ceil(durationMs / 1000)
  // Try sox first, then arecord
  try {
    await execAsync(`sox -d -t wav "${outputPath}" trim 0 ${seconds}`, { timeout: durationMs + 5_000 })
  } catch {
    await execAsync(
      `arecord -d ${seconds} -f S16_LE -r 16000 -c 1 "${outputPath}"`,
      { timeout: durationMs + 5_000 },
    )
  }
  return outputPath
}

// ── Play audio ────────────────────────────────────────────────────────────────

/**
 * Play an audio file (wav / mp3 / ogg).
 * Non-blocking on Windows (fires MediaPlayer async); blocking on Unix.
 *
 * @param audioSource  Path to audio file, or raw audio Buffer.
 */
export async function playAudio(audioSource: string | Buffer): Promise<void> {
  ensureWorkspace()

  let filePath: string
  let isTmp = false

  if (Buffer.isBuffer(audioSource)) {
    filePath = path.join(WORKSPACE, `playback_${Date.now()}.wav`)
    fs.writeFileSync(filePath, audioSource)
    isTmp = true
  } else {
    filePath = audioSource
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`[Audio] File not found: ${filePath}`)
  }

  try {
    if (process.platform === 'win32') {
      await _playWindows(filePath)
    } else {
      await _playUnix(filePath)
    }
  } finally {
    if (isTmp) {
      setTimeout(() => { try { fs.unlinkSync(filePath) } catch { /* ignore */ } }, 10_000)
    }
  }
}

async function _playWindows(filePath: string): Promise<void> {
  const escaped = filePath.replace(/\\/g, '\\\\')
  await execAsync(
    `powershell -Command "Add-Type -AssemblyName presentationCore; $mp = New-Object System.Windows.Media.MediaPlayer; $mp.Open([uri]'${escaped}'); $mp.Play(); Start-Sleep -Seconds 10; $mp.Stop(); $mp.Close()"`,
    { timeout: 30_000 },
  ).catch(async () => {
    // Fallback: system default media player
    await execAsync(`powershell -Command "Start-Process '${escaped}'"`, { timeout: 5_000 })
      .catch(() => { /* ignore */ })
  })
}

async function _playUnix(filePath: string): Promise<void> {
  if (process.platform === 'darwin') {
    await execAsync(`afplay "${filePath}"`, { timeout: 30_000 })
  } else {
    try {
      await execAsync(`paplay "${filePath}"`, { timeout: 30_000 })
    } catch {
      await execAsync(`aplay "${filePath}"`, { timeout: 30_000 })
    }
  }
}

// ── Availability check ────────────────────────────────────────────────────────

/** Returns true if audio recording is likely possible on this system. */
export async function checkAudioAvailable(): Promise<boolean> {
  if (process.platform === 'win32') {
    try {
      await execAsync(
        'powershell -Command "Add-Type -AssemblyName System.Speech; Write-Output ok"',
        { timeout: 3_000 },
      )
      return true
    } catch {
      return false
    }
  }
  // Unix: check for arecord or sox
  try {
    await execAsync('which arecord || which sox', { timeout: 2_000 })
    return true
  } catch {
    return false
  }
}
