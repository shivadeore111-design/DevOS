// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// tests/prompt_17.ts — 10 zero-cost audits for Prompt 17
// (Voice layer: STT + TTS + audio I/O + CLI + SDK).
// Run via:  npm run test:audit
// No LLM. No network. No actual audio calls.

import path from 'path'
import fs   from 'fs'
import { test, assert, assertIncludes, runAll, appendAuditLog } from './harness'

const ROOT    = process.cwd()
const STT     = path.join(ROOT, 'core', 'voice', 'stt.ts')
const TTS     = path.join(ROOT, 'core', 'voice', 'tts.ts')
const AUDIO   = path.join(ROOT, 'core', 'voice', 'audio.ts')
const SDK     = path.join(ROOT, 'core', 'aidenSdk.ts')
const TYPES   = path.join(ROOT, 'types', 'aiden-sdk.d.ts')
const CLI     = path.join(ROOT, 'cli', 'aiden.ts')

// ── Test 1 — STT exports and interface ───────────────────────────────────────
test('p17: stt.ts exports transcribe(), SttResult, SttOptions, getSttProviders()', () => {
  const content = fs.readFileSync(STT, 'utf-8')
  assert(
    content.includes('export async function transcribe('),
    'stt.ts must export async function transcribe()',
  )
  assert(
    content.includes('export interface SttResult'),
    'stt.ts must export SttResult interface',
  )
  assert(
    content.includes('export interface SttOptions'),
    'stt.ts must export SttOptions interface',
  )
  assert(
    content.includes('export function getSttProviders('),
    'stt.ts must export getSttProviders()',
  )
})

// ── Test 2 — STT three-provider fallback chain ───────────────────────────────
test('p17: stt.ts has Groq, OpenAI, and local whisper-cli fallback chain', () => {
  const content = fs.readFileSync(STT, 'utf-8')
  assert(
    content.includes('GROQ_API_KEY'),
    'stt.ts must read GROQ_API_KEY for Groq Whisper provider',
  )
  assert(
    content.includes('OPENAI_API_KEY'),
    'stt.ts must read OPENAI_API_KEY for OpenAI Whisper provider',
  )
  assert(
    content.includes('WHISPER_MODEL_PATH') || content.includes('whisper-cli'),
    'stt.ts must support local whisper-cli fallback (WHISPER_MODEL_PATH)',
  )
  // Graceful failure: returns { text: '', provider: 'none' } — no crash
  assert(
    content.includes("provider: 'none'"),
    "stt.ts must return { provider: 'none' } when all providers fail",
  )
})

// ── Test 3 — TTS exports and interface ───────────────────────────────────────
test('p17: tts.ts exports synthesize(), TtsResult, TtsOptions, getTtsProviders()', () => {
  const content = fs.readFileSync(TTS, 'utf-8')
  assert(
    content.includes('export async function synthesize('),
    'tts.ts must export async function synthesize()',
  )
  assert(
    content.includes('export interface TtsResult'),
    'tts.ts must export TtsResult interface',
  )
  assert(
    content.includes('export interface TtsOptions'),
    'tts.ts must export TtsOptions interface',
  )
  assert(
    content.includes('export function getTtsProviders('),
    'tts.ts must export getTtsProviders()',
  )
})

// ── Test 4 — TTS three-provider fallback chain ───────────────────────────────
test('p17: tts.ts has Edge TTS, ElevenLabs, and SAPI fallback chain', () => {
  const content = fs.readFileSync(TTS, 'utf-8')
  assert(
    content.includes('edge_tts') || content.includes('edge-tts'),
    'tts.ts must use edge-tts as primary TTS provider',
  )
  assert(
    content.includes('ELEVENLABS_API_KEY'),
    'tts.ts must read ELEVENLABS_API_KEY for ElevenLabs provider',
  )
  assert(
    content.includes('System.Speech') || content.includes('SpeechSynthesizer'),
    'tts.ts must include Windows SAPI fallback (System.Speech)',
  )
  // Graceful failure
  assert(
    content.includes("provider: 'none'"),
    "tts.ts must return { provider: 'none' } when all providers fail",
  )
})

// ── Test 5 — TTS cleanForTTS utility ─────────────────────────────────────────
test('p17: tts.ts exports cleanForTTS() that strips markdown', () => {
  const content = fs.readFileSync(TTS, 'utf-8')
  assert(
    content.includes('export function cleanForTTS('),
    'tts.ts must export cleanForTTS() utility',
  )
  assert(
    content.includes('code block'),
    'cleanForTTS must replace code blocks with "code block."',
  )
  assert(
    content.includes('.slice(0, 500)') || content.includes('slice(0,500)'),
    'cleanForTTS must limit output to 500 characters',
  )
})

// ── Test 6 — audio.ts exports ────────────────────────────────────────────────
test('p17: audio.ts exports recordAudio(), playAudio(), checkAudioAvailable()', () => {
  const content = fs.readFileSync(AUDIO, 'utf-8')
  assert(
    content.includes('export async function recordAudio('),
    'audio.ts must export async function recordAudio()',
  )
  assert(
    content.includes('export async function playAudio('),
    'audio.ts must export async function playAudio()',
  )
  assert(
    content.includes('export async function checkAudioAvailable('),
    'audio.ts must export async function checkAudioAvailable()',
  )
})

// ── Test 7 — audio.ts durationSeconds parameter ──────────────────────────────
test('p17: audio.ts recordAudio() takes durationSeconds and outputPath parameters', () => {
  const content = fs.readFileSync(AUDIO, 'utf-8')
  assert(
    content.includes('durationSeconds'),
    'audio.ts recordAudio() must accept durationSeconds parameter',
  )
  assert(
    content.includes('outputPath'),
    'audio.ts recordAudio() must accept outputPath parameter',
  )
  // Windows MCI recording
  assert(
    content.includes('mciSendString') || content.includes('winmm'),
    'audio.ts must use Windows MCI (winmm.dll) for recording on Windows',
  )
})

// ── Test 8 — CLI voice commands ───────────────────────────────────────────────
test('p17: /voice /speak /listen commands registered in CLI COMMANDS array and handleCommand', () => {
  const content = fs.readFileSync(CLI, 'utf-8')
  assert(content.includes("'/voice'"),  "COMMANDS must contain '/voice'")
  assert(content.includes("'/speak'"),  "COMMANDS must contain '/speak'")
  assert(content.includes("'/listen'"), "COMMANDS must contain '/listen'")
  assert(
    content.includes("command === '/voice'"),
    'handleCommand must have /voice branch',
  )
  assert(
    content.includes("command === '/speak'"),
    'handleCommand must have /speak branch',
  )
  assert(
    content.includes("command === '/listen'"),
    'handleCommand must have /listen branch',
  )
})

// ── Test 9 — Voice mode state in CLI ─────────────────────────────────────────
test('p17: CLI state has voiceMode flag; TTS called after AI reply when voiceMode is on', () => {
  const content = fs.readFileSync(CLI, 'utf-8')
  assert(
    content.includes('voiceMode'),
    'state must have voiceMode property',
  )
  assert(
    content.includes('state.voiceMode') && content.includes('synthesize'),
    'CLI must call synthesize() after AI reply when state.voiceMode is true',
  )
  // /listen submits transcribed text to streamChat
  assert(
    content.includes('transcribe') && content.includes('streamChat'),
    '/listen handler must transcribe audio then call streamChat()',
  )
})

// ── Test 10 — SDK voice namespace ────────────────────────────────────────────
test('p17: aidenSdk.ts has voice namespace; aiden-sdk.d.ts has AidenVoice interface', () => {
  const sdkContent   = fs.readFileSync(SDK,   'utf-8')
  const typesContent = fs.readFileSync(TYPES, 'utf-8')

  assert(
    sdkContent.includes("namespace: 'voice'"),
    "aidenSdk.ts TOOL_SDK_MAP must contain entries with namespace: 'voice'",
  )
  assert(
    sdkContent.includes('voice_transcribe') || sdkContent.includes('voice.transcribe'),
    'aidenSdk.ts must wire voice.transcribe()',
  )
  assert(
    sdkContent.includes('voice_speak') || sdkContent.includes('voice.speak'),
    'aidenSdk.ts must wire voice.speak()',
  )
  assert(
    typesContent.includes('export interface AidenVoice'),
    'aiden-sdk.d.ts must export AidenVoice interface',
  )
  assert(
    typesContent.includes('voice:   AidenVoice') || typesContent.includes('voice: AidenVoice'),
    'AidenSDK interface must include voice: AidenVoice',
  )
})

// ── Run ───────────────────────────────────────────────────────────────────────

;(async () => {
  const results = await runAll()
  const logPath = path.join(ROOT, 'tests', 'AUDIT_LOG.md')
  appendAuditLog(results, logPath)
  const failed = results.filter(r => !r.pass).length
  process.exit(failed > 0 ? 1 : 0)
})()
