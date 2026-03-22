// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// coordination/contextCompressor.ts — Prevents context window overflow in long missions

import { callOllama } from '../llm/ollama'

const COMPRESSION_MODEL = 'qwen2.5-coder:7b'

class ContextCompressor {

  async compress(results: string[], maxChars = 2000): Promise<string> {
    const joined = results.join('\n---\n')

    if (joined.length <= maxChars) return joined

    const before  = joined.length
    const prompt  =
      'Summarise these task results in under 500 words. ' +
      'Keep key facts, file names, URLs, and decisions. ' +
      'Discard verbose reasoning.\n\n' + joined

    const summary = await callOllama(prompt, undefined, COMPRESSION_MODEL)
    const after   = summary.length || joined.slice(0, maxChars).length

    const output = summary || joined.slice(0, maxChars)
    console.log(`[ContextCompressor] Compressed ${before} chars → ${after} chars`)
    return output
  }
}

export const contextCompressor = new ContextCompressor()
