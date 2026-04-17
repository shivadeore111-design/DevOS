// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
//
// core/visionAnalyze.ts — Image analysis via vision-capable providers.
//
// Provider chain (first available wins):
//   1. Anthropic claude-3-5-sonnet  (ANTHROPIC_API_KEY)
//   2. OpenAI gpt-4o                (OPENAI_API_KEY)
//   3. Ollama llava                 (local, no key needed)
//
// Accepts local file paths (→ base64) or HTTP/HTTPS URLs.

import * as fs   from 'fs'
import * as path from 'path'
import axios     from 'axios'

export interface VisionResult {
  description: string
  provider:    string
  modelUsed:   string
  durationMs:  number
}

// ── Media type resolver ───────────────────────────────────────────────────────

function extToMediaType(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif',  webp: 'image/webp', bmp: 'image/bmp',
  }
  return map[ext.toLowerCase().replace(/^\./, '')] ?? 'image/jpeg'
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Analyze an image using the first available vision-capable provider.
 *
 * @param imageSource  File path (absolute or relative) or HTTP(S) URL.
 * @param prompt       Instruction prompt (default: describe the image).
 * @returns            VisionResult with description, provider, model, timing.
 */
export async function analyzeImage(
  imageSource: string,
  prompt       = 'Describe this image in detail.',
): Promise<VisionResult> {
  const start = Date.now()

  // Resolve image data
  const isUrl = imageSource.startsWith('http://') || imageSource.startsWith('https://')

  let base64Data  = ''
  let mediaType   = 'image/jpeg'

  if (!isUrl) {
    const absPath = path.isAbsolute(imageSource)
      ? imageSource
      : path.resolve(process.cwd(), imageSource)
    const buf     = fs.readFileSync(absPath)
    base64Data    = buf.toString('base64')
    mediaType     = extToMediaType(path.extname(absPath))
  }

  // ── Provider 1: Anthropic ─────────────────────────────────────────────────

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    try {
      const imageBlock: any = isUrl
        ? { type: 'image', source: { type: 'url', url: imageSource } }
        : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } }

      const res = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model:      'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages:   [{ role: 'user', content: [imageBlock, { type: 'text', text: prompt }] }],
        },
        {
          headers: {
            'x-api-key':         anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
          },
          timeout: 30_000,
        },
      )
      const description = (res.data?.content?.[0]?.text ?? '').trim()
      if (description) {
        return { description, provider: 'anthropic', modelUsed: 'claude-3-5-sonnet-20241022', durationMs: Date.now() - start }
      }
    } catch { /* fall through */ }
  }

  // ── Provider 2: OpenAI ────────────────────────────────────────────────────

  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const imageUrl = isUrl
        ? imageSource
        : `data:${mediaType};base64,${base64Data}`

      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model:      'gpt-4o',
          max_tokens: 1024,
          messages:   [{
            role:    'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl } },
              { type: 'text',      text: prompt },
            ],
          }],
        },
        {
          headers: { Authorization: `Bearer ${openaiKey}`, 'content-type': 'application/json' },
          timeout: 30_000,
        },
      )
      const description = (res.data?.choices?.[0]?.message?.content ?? '').trim()
      if (description) {
        return { description, provider: 'openai', modelUsed: 'gpt-4o', durationMs: Date.now() - start }
      }
    } catch { /* fall through */ }
  }

  // ── Provider 3: Ollama llava ──────────────────────────────────────────────

  const ollamaBase = (process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434').replace(/\/$/, '')

  // For URLs we need to download first so Ollama can receive base64
  let ollamaBase64 = base64Data
  if (isUrl) {
    try {
      const imgRes = await axios.get(imageSource, { responseType: 'arraybuffer', timeout: 15_000 })
      ollamaBase64 = Buffer.from(imgRes.data).toString('base64')
    } catch (e: any) {
      throw new Error(`vision_analyze: all providers failed (could not download URL for Ollama). ${e.message}`)
    }
  }

  try {
    const res = await axios.post(
      `${ollamaBase}/api/generate`,
      { model: 'llava', prompt, images: [ollamaBase64], stream: false },
      { timeout: 60_000 },
    )
    const description = (res.data?.response ?? '').trim()
    return { description, provider: 'ollama', modelUsed: 'llava', durationMs: Date.now() - start }
  } catch (e: any) {
    throw new Error(`vision_analyze: all providers exhausted. ${e.message}`)
  }
}
