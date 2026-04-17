// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/voice/stt.ts — Speech-to-Text with three-provider fallback chain.
//
// Priority order (auto-selected at runtime):
//   1. Groq Whisper API   (GROQ_API_KEY)         — fastest, cloud
//   2. OpenAI Whisper API (OPENAI_API_KEY)        — reliable, cloud
//   3. Local Whisper.cpp  (WHISPER_MODEL_PATH)    — offline, no API key
//
// If all providers fail: returns { text: '', provider: 'none', error }
// — never throws; callers check result.text.

import fs   from 'fs'
import path from 'path'
import { exec }     from 'child_process'
import { promisify } from 'util'
import axios         from 'axios'

const execAsync = promisify(exec)

// ── Public types ──────────────────────────────────────────────────────────────

export interface SttOptions {
  /** Path to an audio file (.wav / .mp3 / .webm etc.) */
  audioFilePath?: string
  /** Raw audio bytes (written to a temp file before sending) */
  audioBuffer?:   Buffer
  /** BCP-47 language hint, e.g. 'en', 'fr'. Optional. */
  language?:      string
  /** Per-call timeout in ms (default 30 000). */
  timeoutMs?:     number
}

export interface SttResult {
  text:        string
  provider:    string
  durationMs:  number
  confidence?: number
  error?:      string
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const WORKSPACE = path.join(process.cwd(), 'workspace')

function ensureWorkspace(): void {
  if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true })
}

/** Resolves the audio file path, writing buffer to a temp file if needed. */
function resolveAudioPath(opts: SttOptions): string {
  if (opts.audioFilePath) return opts.audioFilePath
  if (opts.audioBuffer) {
    ensureWorkspace()
    const tmp = path.join(WORKSPACE, `stt_input_${Date.now()}.wav`)
    fs.writeFileSync(tmp, opts.audioBuffer)
    return tmp
  }
  throw new Error('SttOptions: provide audioFilePath or audioBuffer')
}

// ── Provider 1 — Groq Whisper ─────────────────────────────────────────────────

async function transcribeGroq(audioPath: string, opts: SttOptions): Promise<SttResult> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not set')

  const timeout = opts.timeoutMs ?? 30_000
  const t0      = Date.now()

  const FormData = (await import('form-data')).default
  const form     = new FormData()
  form.append('file',  fs.createReadStream(audioPath), path.basename(audioPath))
  form.append('model', 'whisper-large-v3')
  if (opts.language) form.append('language', opts.language)
  form.append('response_format', 'json')

  const res = await axios.post(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    form,
    {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
      timeout,
    },
  )

  return {
    text:       (res.data.text ?? '').trim(),
    provider:   'groq',
    durationMs: Date.now() - t0,
  }
}

// ── Provider 2 — OpenAI Whisper ───────────────────────────────────────────────

async function transcribeOpenAI(audioPath: string, opts: SttOptions): Promise<SttResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const timeout = opts.timeoutMs ?? 30_000
  const t0      = Date.now()

  const FormData = (await import('form-data')).default
  const form     = new FormData()
  form.append('file',  fs.createReadStream(audioPath), path.basename(audioPath))
  form.append('model', 'whisper-1')
  if (opts.language) form.append('language', opts.language)
  form.append('response_format', 'json')

  const res = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    form,
    {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
      timeout,
    },
  )

  return {
    text:       (res.data.text ?? '').trim(),
    provider:   'openai',
    durationMs: Date.now() - t0,
  }
}

// ── Provider 3 — Local Whisper.cpp ────────────────────────────────────────────

async function transcribeLocal(audioPath: string, opts: SttOptions): Promise<SttResult> {
  const modelPath  = process.env.WHISPER_MODEL_PATH
  const t0         = Date.now()
  const timeout    = opts.timeoutMs ?? 60_000

  // whisper-cli binary: try PATH first, then common install locations
  const binaryName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
  const binaryCandidates = [
    binaryName,
    path.join(process.cwd(), 'bin', binaryName),
    path.join(process.cwd(), binaryName),
  ]

  let binary = binaryName
  for (const candidate of binaryCandidates) {
    try {
      await execAsync(`"${candidate}" --version`, { timeout: 3000 })
      binary = candidate
      break
    } catch { /* try next */ }
  }

  const modelArg = modelPath ? `-m "${modelPath}"` : ''
  const langArg  = opts.language ? `-l ${opts.language}` : ''
  const cmd      = `"${binary}" ${modelArg} ${langArg} -f "${audioPath}" --output-txt`.trim()

  await execAsync(cmd, { timeout })

  // whisper-cli writes <audioPath>.txt
  const txtPath = audioPath + '.txt'
  if (!fs.existsSync(txtPath)) throw new Error('whisper-cli produced no output file')

  const text = fs.readFileSync(txtPath, 'utf-8').trim()
  try { fs.unlinkSync(txtPath) } catch { /* ignore */ }

  return { text, provider: 'local', durationMs: Date.now() - t0 }
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Transcribe audio using the first available provider.
 * Never throws — always returns an SttResult; check result.error on failure.
 */
export async function transcribe(options: SttOptions): Promise<SttResult> {
  const t0      = Date.now()
  let   tmpFile = ''
  const errors: string[] = []

  try {
    const audioPath = resolveAudioPath(options)
    if (!options.audioFilePath && options.audioBuffer) tmpFile = audioPath

    // Provider 1 — Groq
    try {
      const r = await transcribeGroq(audioPath, options)
      console.log(`[STT] Groq Whisper: "${r.text.slice(0, 60)}" (${r.durationMs}ms)`)
      return r
    } catch (e: any) {
      errors.push(`groq: ${e.message}`)
    }

    // Provider 2 — OpenAI
    try {
      const r = await transcribeOpenAI(audioPath, options)
      console.log(`[STT] OpenAI Whisper: "${r.text.slice(0, 60)}" (${r.durationMs}ms)`)
      return r
    } catch (e: any) {
      errors.push(`openai: ${e.message}`)
    }

    // Provider 3 — Local Whisper.cpp
    try {
      const r = await transcribeLocal(audioPath, options)
      console.log(`[STT] Local Whisper.cpp: "${r.text.slice(0, 60)}" (${r.durationMs}ms)`)
      return r
    } catch (e: any) {
      errors.push(`local: ${e.message}`)
    }

    // All failed
    const errorMsg = errors.join(' | ')
    console.warn(`[STT] All providers failed: ${errorMsg}`)
    return { text: '', provider: 'none', durationMs: Date.now() - t0, error: errorMsg }

  } catch (outer: any) {
    return { text: '', provider: 'none', durationMs: Date.now() - t0, error: outer.message }
  } finally {
    if (tmpFile) { try { fs.unlinkSync(tmpFile) } catch { /* ignore */ } }
  }
}

/** Returns which STT providers are likely available (env-key check only). */
export function getSttProviders(): Array<{ name: string; available: boolean }> {
  return [
    { name: 'groq',   available: !!process.env.GROQ_API_KEY   },
    { name: 'openai', available: !!process.env.OPENAI_API_KEY },
    { name: 'local',  available: !!process.env.WHISPER_MODEL_PATH },
  ]
}
