// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/promptCaching.ts — Phase 6 of Prompt 10.
//
// Builds a system prompt with Anthropic cache_control breakpoints so that
// the static prefix (SOUL + standing orders + tool definitions) is cached
// at the API layer after the first call.
//
// NOTE: This module produces the correct request shape for the Anthropic
// Messages API directly (not OpenAI-compatible).  It cannot be wired until
// an Anthropic adapter is added to providers/.  Until then it is used as a
// reference implementation and tested via unit tests.
//
// Anthropic caching docs:
//   https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
//
// Three cache breakpoints are inserted (from largest stable → smallest):
//   1. After the SOUL prompt            (changes ~never)
//   2. After standing orders            (changes weekly)
//   3. After tool definitions           (changes per-session)
//
// Everything after breakpoint 3 (memory context, user history) is dynamic
// and is NOT cached.

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single content block in an Anthropic system prompt. */
export interface CacheableBlock {
  type:         'text'
  text:         string
  cache_control?: { type: 'ephemeral' }
}

/** Full cached system prompt ready for the Anthropic Messages API. */
export interface CachedSystemPrompt {
  /** Array of content blocks — pass as the `system` field of the API request. */
  system:   CacheableBlock[]
  /** Total character count of all blocks (for logging / cost estimation). */
  totalChars: number
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Assemble a system prompt with three Anthropic cache_control breakpoints.
 *
 * @param soul           Full SOUL.md text (or empty string if not loaded)
 * @param standingOrders Full STANDING_ORDERS.md text (or empty string)
 * @param toolDefs       Serialised tool definitions (JSON string or prose)
 * @param dynamicSuffix  Memory context, user history, etc. — NOT cached
 */
export function buildCachedSystemPrompt(
  soul:          string,
  standingOrders: string,
  toolDefs:      string,
  dynamicSuffix?: string,
): CachedSystemPrompt {
  const blocks: CacheableBlock[] = []

  // Block 1 — SOUL (most stable; cache_control breakpoint after it)
  if (soul.trim()) {
    blocks.push({
      type:          'text',
      text:          soul.trim(),
      cache_control: { type: 'ephemeral' },
    })
  }

  // Block 2 — Standing orders (weekly churn; breakpoint after it)
  if (standingOrders.trim()) {
    blocks.push({
      type:          'text',
      text:          standingOrders.trim(),
      cache_control: { type: 'ephemeral' },
    })
  }

  // Block 3 — Tool definitions (per-session; breakpoint after it)
  if (toolDefs.trim()) {
    blocks.push({
      type:          'text',
      text:          toolDefs.trim(),
      cache_control: { type: 'ephemeral' },
    })
  }

  // Block 4 — Dynamic suffix (memory, history) — no cache_control
  if (dynamicSuffix?.trim()) {
    blocks.push({
      type: 'text',
      text: dynamicSuffix.trim(),
    })
  }

  const totalChars = blocks.reduce((sum, b) => sum + b.text.length, 0)

  return { system: blocks, totalChars }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Flatten a CachedSystemPrompt back to a plain string.
 * Used when falling back to an OpenAI-compatible provider that doesn't
 * support cache_control.
 */
export function flattenSystemPrompt(cached: CachedSystemPrompt): string {
  return cached.system.map(b => b.text).join('\n\n')
}
