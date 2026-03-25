// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// providers/types.ts — Shared Provider interface + tool-calling types

// ── Tool-calling types ────────────────────────────────────────

export interface ToolDefinition {
  name:        string
  description: string
  parameters: {
    type:       'object'
    properties: Record<string, { type: string; description: string }>
    required?:  string[]
  }
}

export interface ToolCall {
  name:      string
  arguments: Record<string, any>
}

// ── Provider interface ────────────────────────────────────────

export interface Provider {
  name: string
  generate(
    messages: { role: string; content: string }[],
    model: string,
  ): Promise<string>

  generateStream(
    messages: { role: string; content: string }[],
    model:    string,
    onToken:  (t: string) => void,
  ): Promise<void>

  /**
   * Optional: send messages with tool definitions and get back
   * both a text response and zero-or-more tool calls to execute.
   * Present on providers that support OpenAI-compatible function calling
   * (Groq, Gemini). Absent on Ollama / fallback providers.
   */
  generateWithTools?(
    messages: { role: string; content: string }[],
    model:    string,
    tools:    ToolDefinition[],
  ): Promise<{ content: string; toolCalls: ToolCall[] }>

  listModels?(): Promise<string[]>
}
