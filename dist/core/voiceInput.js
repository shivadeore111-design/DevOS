"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkVoiceAvailable = checkVoiceAvailable;
exports.transcribeAudio = transcribeAudio;
exports.recordAudio = recordAudio;
// core/voiceInput.ts — Voice input via faster-whisper (Python)
//
// Prerequisites (user installs once):
//   pip install faster-whisper
//
// Fallback: if faster-whisper is not available, returns error message
// so the UI can hide the voice button gracefully.
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const WORKSPACE = path_1.default.join(process.cwd(), 'workspace');
function ensureWorkspace() {
    if (!fs_1.default.existsSync(WORKSPACE))
        fs_1.default.mkdirSync(WORKSPACE, { recursive: true });
}
// ── Availability check ────────────────────────────────────────
async function checkVoiceAvailable() {
    try {
        const { stdout } = await execAsync('python -c "import faster_whisper; print(\'ok\')"', { timeout: 5000 });
        return stdout.trim() === 'ok';
    }
    catch {
        return false;
    }
}
// ── Transcribe audio file ─────────────────────────────────────
// Uses faster-whisper tiny model (CPU, int8) — fast enough for real-time
async function transcribeAudio(audioPath) {
    ensureWorkspace();
    const normalizedPath = audioPath.replace(/\\/g, '/');
    const pythonScript = `
from faster_whisper import WhisperModel
model = WhisperModel("tiny", device="cpu", compute_type="int8")
segments, info = model.transcribe("${normalizedPath}", beam_size=5)
text = " ".join([segment.text for segment in segments])
print(text.strip())
`.trim();
    const tmpScript = path_1.default.join(WORKSPACE, `whisper_${Date.now()}.py`);
    fs_1.default.writeFileSync(tmpScript, pythonScript);
    try {
        const { stdout } = await execAsync(`python "${tmpScript}"`, { timeout: 30000 });
        return stdout.trim();
    }
    catch (e) {
        throw new Error(`Transcription failed: ${e.message}`);
    }
    finally {
        try {
            fs_1.default.unlinkSync(tmpScript);
        }
        catch { }
    }
}
// ── Record audio from microphone ──────────────────────────────
// Uses Windows MCI (mciSendString) via P/Invoke — no third-party dep
async function recordAudio(durationMs = 5000) {
    ensureWorkspace();
    const outputPath = path_1.default.join(WORKSPACE, `recording_${Date.now()}.wav`);
    const outputPathFwd = outputPath.replace(/\\/g, '\\\\');
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
`.trim();
    const psFile = path_1.default.join(WORKSPACE, `record_${Date.now()}.ps1`);
    fs_1.default.writeFileSync(psFile, psScript);
    try {
        await execAsync(`powershell.exe -ExecutionPolicy Bypass -File "${psFile}"`, { timeout: durationMs + 8000 });
        return outputPath;
    }
    catch (e) {
        throw new Error(`Recording failed: ${e.message}`);
    }
    finally {
        try {
            fs_1.default.unlinkSync(psFile);
        }
        catch { }
    }
}
