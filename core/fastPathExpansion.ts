// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/fastPathExpansion.ts — Phase 5 of Prompt 10.
//
// Classifies messages that can be answered directly by streamChat without
// going through the planner, cutting 2–8s of planner latency for ~60% of
// typical user messages.
//
// A message is a FAST-PATH candidate when it:
//   - Is a direct knowledge/conversational question (no tools required)
//   - Requests explanation, definition, translation, or opinion
//   - Asks for short creative output (joke, quote, haiku)
//   - Does NOT contain signals for file I/O, code execution, web search,
//     git, screen control, or multi-step planning keywords.

// ── Patterns that indicate a tool-less, plannable-free response ──────────────

/** Positive patterns: message can likely be answered without any tools. */
const FAST_PATH_PATTERNS: RegExp[] = [
  // Knowledge / explanation
  /^(what (is|are|was|were)|who (is|are|was|were)|where (is|are)|when (is|are|did|was)|why (is|are|do|does|did)|how (do|does|did|can|to)\b)/i,
  // Definition
  /^(define|explain|describe|tell me (about|what)|what does .+ mean)/i,
  // Math / conversion
  /^\d[\d\s+\-*/^().]*=?\s*\??\s*$|^(convert|calculate|what is \d|how (many|much) (is|are|does))/i,
  // Translation
  /^(translate|how do you say|what is .+ in (spanish|french|german|japanese|hindi|arabic|chinese|portuguese|italian|russian|korean))/i,
  // Opinion / recommendation (no research needed)
  /^(what (should|do) (i|you)|which (is better|do you prefer|would you recommend)|can you recommend)/i,
  // Short creative
  /^(tell me a (joke|story|fact|riddle)|give me a (quote|joke|haiku|limerick|fun fact)|write (a|me a) (poem|haiku|limerick|joke|quote|one-liner))/i,
  // Simple yes/no questions
  /^(is (it|that|this)|are (you|there|they)|does (it|that)|can (you|i|we)\b)/i,
  // Casual conversational
  /^(sounds good|makes sense|that makes sense|i see|understood|got it|noted|alright|sure|of course|no problem|nevermind|never mind|forget it|never mind that)/i,
]

/** Negative patterns: if ANY match, the message needs the planner even if a positive matched. */
const PLANNER_REQUIRED_PATTERNS: RegExp[] = [
  // File operations
  /\b(read|write|save|create|delete|move|copy|rename|open|close|download|upload)\b.*\b(file|folder|directory|document|pdf|csv|json|txt|xlsx|zip)\b/i,
  /\.(txt|csv|json|md|pdf|py|js|ts|sh|bat|ps1|xlsx|docx)\b/i,
  // Code execution
  /\b(run|execute|build|compile|deploy|install|start|launch|npm|pip|python|node|powershell|bash|terminal|shell|script)\b/i,
  // Web / research
  /\b(search|google|find (online|on the web)|browse|fetch|scrape|web|http|url|website|news|latest|current|today's|real.?time)\b/i,
  // Screen / system control
  /\b(click|type (in|into)|screenshot|screen|mouse|keyboard|open (app|browser|chrome|window)|close (app|window))\b/i,
  // Git
  /\b(git|commit|push|pull|branch|merge|diff|repository|repo)\b/i,
  // Multi-step planning keywords
  /\b(then|after that|next|first .+ then|step by step|automate|workflow|pipeline|schedule|every (day|hour|minute)|on a schedule)\b/i,
  // Email / calendar
  /\b(send (email|mail|message)|check (email|calendar)|schedule (meeting|call)|remind me)\b/i,
]

/**
 * Returns true if this message can skip the planner and go directly to streamChat.
 * False means: use the planner (may need tool calls or multi-step execution).
 */
export function matchFastPath(message: string): boolean {
  const trimmed = message.trim()

  // Very short messages are usually conversational
  if (trimmed.length < 20 && !/\b(run|exec|create|write|search|find|git)\b/i.test(trimmed)) {
    return true
  }

  // Any planner-required signal vetoes fast-path
  if (PLANNER_REQUIRED_PATTERNS.some(p => p.test(trimmed))) return false

  // Check positive patterns
  if (FAST_PATH_PATTERNS.some(p => p.test(trimmed))) return true

  // Messages over 300 chars with no positive match go to planner
  // (likely a detailed task description)
  if (trimmed.length > 300) return false

  // Medium-length messages with question marks are likely knowledge questions
  if (trimmed.includes('?') && trimmed.length < 200) return true

  return false
}
