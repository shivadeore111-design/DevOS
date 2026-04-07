"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTTSAvailable = checkTTSAvailable;
exports.speak = speak;
// core/voiceOutput.ts — Voice output via edge-tts (Python) with SAPI fallback
//
// Prerequisites for best quality (user installs once):
//   pip install edge-tts
//
// Fallback: Windows SAPI (System.Speech) — always available on Windows,
// no install required but lower quality than edge-tts/Aria.
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const WORKSPACE = path_1.default.join(process.cwd(), 'workspace');
const DEFAULT_VOICE = 'en-US-AriaNeural';
function ensureWorkspace() {
    if (!fs_1.default.existsSync(WORKSPACE))
        fs_1.default.mkdirSync(WORKSPACE, { recursive: true });
}
// ── Availability check ────────────────────────────────────────
async function checkTTSAvailable() {
    // edge-tts Python check
    try {
        const { stdout } = await execAsync('python -c "import edge_tts; print(\'ok\')"', { timeout: 5000 });
        if (stdout.trim() === 'ok')
            return true;
    }
    catch { }
    // Windows SAPI fallback check — always true on Windows
    try {
        await execAsync('powershell -Command "Add-Type -AssemblyName System.Speech; Write-Output ok"', { timeout: 3000 });
        return true;
    }
    catch { }
    return false;
}
// ── Clean text for TTS ────────────────────────────────────────
// Strips markdown, code blocks, symbols — leaves clean spoken text
function cleanForTTS(text) {
    return text
        .replace(/```[\s\S]*?```/g, 'code block.')
        .replace(/`[^`]+`/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/#{1,6}\s+/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // links → text
        .replace(/\n+/g, '. ')
        .replace(/[❌✅⚡🔧📋🔍🎤🔊]/g, '') // strip emojis
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500); // max 500 chars for TTS
}
// ── Speak via edge-tts (Python) ───────────────────────────────
async function speakEdgeTTS(text, voice) {
    ensureWorkspace();
    const audioPath = path_1.default.join(WORKSPACE, `tts_${Date.now()}.mp3`);
    const audioFwd = audioPath.replace(/\\/g, '/');
    const escapedText = text.replace(/"/g, '\\"').replace(/'/g, "\\'");
    const scriptContent = `
import asyncio, sys
sys.stderr = open('nul', 'w')
import edge_tts
async def main():
    communicate = edge_tts.Communicate("${escapedText}", "${voice}")
    await communicate.save("${audioFwd}")
asyncio.run(main())
`.trim();
    const tmpScript = path_1.default.join(WORKSPACE, `tts_gen_${Date.now()}.py`);
    fs_1.default.writeFileSync(tmpScript, scriptContent);
    try {
        await execAsync(`python "${tmpScript}"`, { timeout: 15000 });
        if (!fs_1.default.existsSync(audioPath))
            return false;
        // Play the MP3 via Windows Media Player (async — don't block the response)
        execAsync(`powershell -Command "Add-Type -AssemblyName presentationCore; $mp = New-Object System.Windows.Media.MediaPlayer; $mp.Open([uri]'${audioPath.replace(/\\/g, '\\\\')}'); $mp.Play(); Start-Sleep -Seconds 6; $mp.Stop(); $mp.Close()"`, { timeout: 15000 }).catch(() => {
            // Fallback: just Start-Process (opens system default player)
            execAsync(`powershell -Command "Start-Process '${audioPath.replace(/\\/g, '\\\\')}'"`).catch(() => { });
        });
        // Clean up after 12s
        setTimeout(() => { try {
            fs_1.default.unlinkSync(audioPath);
        }
        catch { } }, 12000);
        return true;
    }
    catch {
        return false;
    }
    finally {
        try {
            fs_1.default.unlinkSync(tmpScript);
        }
        catch { }
    }
}
// ── Speak via Windows SAPI (always available) ─────────────────
async function speakSAPI(text) {
    // Escape single quotes for PowerShell string embedding
    const safe = text.replace(/'/g, "''").replace(/"/g, '');
    await execAsync(`powershell -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = 1; $s.Volume = 100; $s.Speak('${safe}')"`, { timeout: 30000 });
}
// ── Main exported function ────────────────────────────────────
async function speak(text, voice = DEFAULT_VOICE) {
    if (!text?.trim())
        return;
    const clean = cleanForTTS(text);
    if (!clean)
        return;
    // Try edge-tts first — best quality
    const edgeOk = await speakEdgeTTS(clean, voice);
    if (edgeOk)
        return;
    // Fallback to Windows SAPI
    try {
        await speakSAPI(clean);
    }
    catch (e) {
        console.error('[TTS] Both methods failed:', e.message);
    }
}
