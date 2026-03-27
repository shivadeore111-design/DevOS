// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/voiceInput.ts — Voice input via faster-whisper (Python)
//
// Prerequisites (user installs once):
//   pip install faster-whisper
//
// Fallback: if faster-whisper is not available, returns error message
// so the UI can hide the voice button gracefully.

import { exec }    from 'child_process'
import { promisify } from 'util'
import fs            from 'fs'
import path          from 'path'

const execAsync = promisify(exec)

const WORKSPACE = path.join(process.cwd(), 'workspace')

function ensureWorkspace(): void {
  if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true })
}

// ── Availability check ────────────────────────────────────────

export async function checkVoiceAvailable(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      'python -c "import faster_whisper; print(\'ok\')"',
      { timeout: 5000 }
    )
    return stdout.trim() === 'ok'
  } catch {
    return false
  }
}

// ── Transcribe audio file ─────────────────────────────────────
// Uses faster-whisper tiny model (CPU, int8) — fast enough for real-time

export async function transcribeAudio(audioPath: string): Promise<string> {
  ensureWorkspace()

  const normalizedPath = audioPath.replace(/\\/g, '/')
  const pythonScript   = `
from faster_whisper import WhisperModel
model = WhisperModel("tiny", device="cpu", compute_type="int8")
segments, info = model.transcribe("${normalizedPath}", beam_size=5)
text = " ".join([segment.text for segment in segments])
print(text.strip())
`.trim()

  const tmpScript = path.join(WORKSPACE, `whisper_${Date.now()}.py`)
  fs.writeFileSync(tmpScript, pythonScript)

  try {
    const { stdout } = await execAsync(`python "${tmpScript}"`, { timeout: 30000 })
    return stdout.trim()
  } catch (e: any) {
    throw new Error(`Transcription failed: ${e.message}`)
  } finally {
    try { fs.unlinkSync(tmpScript) } catch {}
  }
}

// ── Record audio from microphone ──────────────────────────────
// Uses Windows MCI (mciSendString) via P/Invoke — no third-party dep

export async function recordAudio(durationMs: number = 5000): Promise<string> {
  ensureWorkspace()

  const outputPath = path.join(WORKSPACE, `recording_${Date.now()}.wav`)
  const outputPathFwd = outputPath.replace(/\\/g, '\\\\')

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
[AudioRecorder]::Record("${outputPathFwd}", ${durationMs})
Write-Output "${outputPath}"
`.trim()

  const psFile = path.join(WORKSPACE, `record_${Date.now()}.ps1`)
  fs.writeFileSync(psFile, psScript)

  try {
    await execAsync(
      `powershell.exe -ExecutionPolicy Bypass -File "${psFile}"`,
      { timeout: durationMs + 8000 }
    )
    return outputPath
  } catch (e: any) {
    throw new Error(`Recording failed: ${e.message}`)
  } finally {
    try { fs.unlinkSync(psFile) } catch {}
  }
}
