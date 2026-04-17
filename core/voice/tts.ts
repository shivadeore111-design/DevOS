// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/voice/tts.ts — Text-to-Speech with four-provider fallback chain.
//
// Priority order (auto-selected at runtime):
//   0. VoxCPM2       (USE_VOXCPM=1, Python subprocess, Apache-2.0) — voice clone/design
//   1. Edge TTS      (edge-tts Python pkg, free)  — best quality, offline after install
//   2. ElevenLabs    (ELEVENLABS_API_KEY)          — premium voices, REST API
//   3. Windows SAPI  (System.Speech assembly)     — always available on Windows
//
// VoxCPM2 is opt-in via USE_VOXCPM=1 env var and is always tried first when enabled.
// Never throws — returns TtsResult; callers check result.error.

import fs   from 'fs'
import path from 'path'
import { exec, spawn }  from 'child_process'
import { promisify }     from 'util'
import axios             from 'axios'

const execAsync = promisify(exec)

// ── Public types ──────────────────────────────────────────────────────────────

export interface TtsOptions {
  /** Text to synthesize */
  text:       string
  /** Voice name for Edge TTS (e.g. 'en-US-AriaNeural') or ElevenLabs voice ID */
  voice?:     string
  /** Speed multiplier for SAPI (0.5–2.0). Default 1.0 */
  rate?:      number
  /** Volume 0–100. Default 100 */
  volume?:    number
  /** Override provider (skip fallback logic) */
  provider?:  'voxcpm' | 'edge' | 'elevenlabs' | 'sapi'
  /** Timeout per provider attempt in ms. Default 20 000 */
  timeoutMs?: number
  /** Voice cloning: path to reference audio file (WAV, 5–10 s). VoxCPM only. */
  referenceAudioPath?: string
  /** Voice design: text description of desired voice. VoxCPM only.
   *  Alternatively, prefix text with "design:<description>\n<text-to-speak>" */
  voiceDesignPrompt?: string
}

export interface TtsResult {
  provider:   string
  durationMs: number
  error?:     string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_VOICE       = 'en-US-AriaNeural'
const WORKSPACE           = path.join(process.cwd(), 'workspace')
const ELEVENLABS_API_URL  = 'https://api.elevenlabs.io/v1/text-to-speech'
const VOXCPM_RUNNER_PATH  = path.join(__dirname, 'voxcpm_runner.py')
const VOXCPM_TIMEOUT_MS   = 120_000

function ensureWorkspace(): void {
  if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true })
}

// ── Text cleaner ──────────────────────────────────────────────────────────────

export function cleanForTTS(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'code block.')
    .replace(/`[^`]+`/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\n+/g, '. ')
    .replace(/[❌✅⚡🔧📋🔍🎤🔊]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

// ── Provider 0 — VoxCPM2 (opt-in via USE_VOXCPM=1) ───────────────────────────

async function synthesizeVoxCPM(text: string, opts: TtsOptions): Promise<TtsResult> {
  const t0        = Date.now()
  const timeout   = opts.timeoutMs ?? VOXCPM_TIMEOUT_MS

  ensureWorkspace()
  const outputPath = path.join(WORKSPACE, `tts_voxcpm_${Date.now()}.wav`)
  const outputFwd  = outputPath.replace(/\\/g, '/')

  // Detect mode: clone / design / standard
  let mode: 'tts' | 'clone' | 'design' = 'tts'
  let voiceDescription: string | undefined
  let speechText = text

  if (opts.referenceAudioPath) {
    mode = 'clone'
  } else if (opts.voiceDesignPrompt) {
    mode = 'design'
    voiceDescription = opts.voiceDesignPrompt
  } else if (text.startsWith('design:')) {
    // Inline design prefix: "design:<description>\n<text-to-speak>"
    const newline = text.indexOf('\n')
    if (newline !== -1) {
      mode             = 'design'
      voiceDescription = text.slice('design:'.length, newline).trim()
      speechText       = text.slice(newline + 1).trim()
    }
  }

  const payload = {
    text:               speechText,
    output_path:        outputFwd,
    mode,
    reference_audio:    opts.referenceAudioPath?.replace(/\\/g, '/') ?? null,
    voice_description:  voiceDescription ?? null,
    language:           'en',
  }

  return new Promise<TtsResult>((resolve) => {
    const child = spawn('python', [VOXCPM_RUNNER_PATH], { stdio: ['pipe', 'pipe', 'pipe'] })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    const timer = setTimeout(() => {
      child.kill()
      resolve({ provider: 'voxcpm', durationMs: Date.now() - t0, error: `VoxCPM timed out after ${timeout}ms` })
    }, timeout)

    child.stdin.write(JSON.stringify(payload))
    child.stdin.end()

    child.on('close', () => {
      clearTimeout(timer)
      try {
        const result = JSON.parse(stdout.trim())
        if (!result.ok) {
          // Surface well-known errors for upstream handling
          resolve({ provider: 'voxcpm', durationMs: Date.now() - t0, error: result.error ?? 'VoxCPM failed' })
          return
        }
        // Play the generated WAV
        const escaped = outputPath.replace(/\\/g, '\\\\')
        exec(
          `powershell -Command "Add-Type -AssemblyName presentationCore; $mp = New-Object System.Windows.Media.MediaPlayer; $mp.Open([uri]'${escaped}'); $mp.Play(); Start-Sleep -Seconds 10; $mp.Stop(); $mp.Close()"`,
          { timeout: 15_000 },
          (err) => {
            if (err) exec(`powershell -Command "Start-Process '${escaped}'"`)
          },
        )
        setTimeout(() => { try { fs.unlinkSync(outputPath) } catch { /* ignore */ } }, 15_000)
        resolve({ provider: 'voxcpm', durationMs: Date.now() - t0 })
      } catch {
        resolve({ provider: 'voxcpm', durationMs: Date.now() - t0, error: `VoxCPM invalid output: ${stdout} | stderr: ${stderr}` })
      }
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ provider: 'voxcpm', durationMs: Date.now() - t0, error: `VoxCPM spawn error: ${err.message}` })
    })
  })
}

// ── Provider 1 — Edge TTS ─────────────────────────────────────────────────────

async function synthesizeEdge(text: string, opts: TtsOptions): Promise<TtsResult> {
  ensureWorkspace()
  const t0        = Date.now()
  const voice     = opts.voice ?? DEFAULT_VOICE
  const audioPath = path.join(WORKSPACE, `tts_edge_${Date.now()}.mp3`)
  const audioFwd  = audioPath.replace(/\\/g, '/')
  const escaped   = text.replace(/"/g, '\\"').replace(/'/g, "\\'")
  const timeout   = opts.timeoutMs ?? 20_000

  const script = `
import asyncio, sys
sys.stderr = open('nul', 'w')
import edge_tts
async def main():
    communicate = edge_tts.Communicate("${escaped}", "${voice}")
    await communicate.save("${audioFwd}")
asyncio.run(main())
`.trim()

  const tmpPy = path.join(WORKSPACE, `tts_edge_gen_${Date.now()}.py`)
  fs.writeFileSync(tmpPy, script)

  try {
    await execAsync(`python "${tmpPy}"`, { timeout })
    if (!fs.existsSync(audioPath)) throw new Error('edge-tts produced no audio file')

    // Play via Windows Media Player (fire-and-forget)
    const escaped_path = audioPath.replace(/\\/g, '\\\\')
    execAsync(
      `powershell -Command "Add-Type -AssemblyName presentationCore; $mp = New-Object System.Windows.Media.MediaPlayer; $mp.Open([uri]'${escaped_path}'); $mp.Play(); Start-Sleep -Seconds 8; $mp.Stop(); $mp.Close()"`,
      { timeout: 15_000 },
    ).catch(() => {
      execAsync(`powershell -Command "Start-Process '${escaped_path}'"`)
        .catch(() => { /* ignore */ })
    })

    setTimeout(() => { try { fs.unlinkSync(audioPath) } catch { /* ignore */ } }, 15_000)
    return { provider: 'edge', durationMs: Date.now() - t0 }
  } finally {
    try { fs.unlinkSync(tmpPy) } catch { /* ignore */ }
  }
}

// ── Provider 2 — ElevenLabs ───────────────────────────────────────────────────

async function synthesizeElevenLabs(text: string, opts: TtsOptions): Promise<TtsResult> {
  const apiKey  = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set')

  ensureWorkspace()
  const t0      = Date.now()
  const voiceId = opts.voice ?? 'EXAVITQu4vr4xnSDxMaL' // Sarah (default public voice)
  const timeout = opts.timeoutMs ?? 20_000

  const res = await axios.post(
    `${ELEVENLABS_API_URL}/${voiceId}`,
    {
      text,
      model_id:       'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    },
    {
      headers: {
        'xi-api-key':   apiKey,
        'Content-Type': 'application/json',
        Accept:         'audio/mpeg',
      },
      responseType: 'arraybuffer',
      timeout,
    },
  )

  const audioPath    = path.join(WORKSPACE, `tts_eleven_${Date.now()}.mp3`)
  const escaped_path = audioPath.replace(/\\/g, '\\\\')
  fs.writeFileSync(audioPath, Buffer.from(res.data))

  execAsync(
    `powershell -Command "Add-Type -AssemblyName presentationCore; $mp = New-Object System.Windows.Media.MediaPlayer; $mp.Open([uri]'${escaped_path}'); $mp.Play(); Start-Sleep -Seconds 8; $mp.Stop(); $mp.Close()"`,
    { timeout: 15_000 },
  ).catch(() => {
    execAsync(`powershell -Command "Start-Process '${escaped_path}'"`)
      .catch(() => { /* ignore */ })
  })

  setTimeout(() => { try { fs.unlinkSync(audioPath) } catch { /* ignore */ } }, 15_000)
  return { provider: 'elevenlabs', durationMs: Date.now() - t0 }
}

// ── Provider 3 — Windows SAPI ─────────────────────────────────────────────────

async function synthesizeSAPI(text: string, opts: TtsOptions): Promise<TtsResult> {
  const t0      = Date.now()
  const rate    = Math.round(((opts.rate ?? 1.0) - 1.0) * 5)  // map 0.5–2.0 → -3..5
  const volume  = opts.volume ?? 100
  const safe    = text.replace(/'/g, "''").replace(/"/g, '')
  const timeout = opts.timeoutMs ?? 30_000

  await execAsync(
    `powershell -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = ${rate}; $s.Volume = ${volume}; $s.Speak('${safe}')"`,
    { timeout },
  )

  return { provider: 'sapi', durationMs: Date.now() - t0 }
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Synthesize text using the first available provider.
 * Never throws — always returns a TtsResult; check result.error on failure.
 */
export async function synthesize(options: TtsOptions): Promise<TtsResult> {
  const t0     = Date.now()
  const text   = cleanForTTS(options.text)
  if (!text) return { provider: 'none', durationMs: 0 }

  const errors: string[] = []

  // Explicit provider override
  if (options.provider) {
    try {
      if (options.provider === 'voxcpm')      return await synthesizeVoxCPM(text, options)
      if (options.provider === 'edge')        return await synthesizeEdge(text, options)
      if (options.provider === 'elevenlabs')  return await synthesizeElevenLabs(text, options)
      if (options.provider === 'sapi')        return await synthesizeSAPI(text, options)
    } catch (e: any) {
      return { provider: options.provider, durationMs: Date.now() - t0, error: e.message }
    }
  }

  // Provider 0 — VoxCPM2 (opt-in via USE_VOXCPM=1)
  const voxCpmEnabled = process.env.USE_VOXCPM === '1'
  if (voxCpmEnabled || options.referenceAudioPath || options.voiceDesignPrompt) {
    const r = await synthesizeVoxCPM(text, options)
    if (!r.error) {
      console.log(`[TTS] VoxCPM2: ${r.durationMs}ms`)
      return r
    }
    const isNotInstalled = r.error?.includes('No module named voxcpm')
    const isOOM          = r.error?.includes('CUDA out of memory')
    if (isOOM) {
      console.warn(`[TTS] VoxCPM OOM — falling through to next provider`)
    } else if (isNotInstalled && !voxCpmEnabled) {
      // clone/design requested but VoxCPM not installed — surface error immediately
      return r
    }
    errors.push(`voxcpm: ${r.error}`)
  }

  // Provider 1 — Edge TTS
  try {
    const r = await synthesizeEdge(text, options)
    console.log(`[TTS] Edge TTS: ${r.durationMs}ms`)
    return r
  } catch (e: any) {
    errors.push(`edge: ${e.message}`)
  }

  // Provider 2 — ElevenLabs
  try {
    const r = await synthesizeElevenLabs(text, options)
    console.log(`[TTS] ElevenLabs: ${r.durationMs}ms`)
    return r
  } catch (e: any) {
    errors.push(`elevenlabs: ${e.message}`)
  }

  // Provider 3 — Windows SAPI
  try {
    const r = await synthesizeSAPI(text, options)
    console.log(`[TTS] SAPI: ${r.durationMs}ms`)
    return r
  } catch (e: any) {
    errors.push(`sapi: ${e.message}`)
  }

  // All failed
  const errorMsg = errors.join(' | ')
  console.warn(`[TTS] All providers failed: ${errorMsg}`)
  return { provider: 'none', durationMs: Date.now() - t0, error: errorMsg }
}

/** Returns which TTS providers are likely available (env / platform check). */
export function getTtsProviders(): Array<{ name: string; available: boolean; note?: string }> {
  return [
    {
      name: 'voxcpm',
      available: process.env.USE_VOXCPM === '1',
      note: process.env.USE_VOXCPM === '1' ? 'enabled (USE_VOXCPM=1)' : 'set USE_VOXCPM=1 to enable',
    },
    { name: 'edge',        available: true },   // checked at runtime via Python import
    { name: 'elevenlabs',  available: !!process.env.ELEVENLABS_API_KEY },
    { name: 'sapi',        available: process.platform === 'win32' },
  ]
}
