// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// providers/types.ts — Shared Provider interface

export interface Provider {
  name: string
  generate(messages: { role: string; content: string }[], model: string): Promise<string>
  generateStream(messages: { role: string; content: string }[], model: string, onToken: (t: string) => void): Promise<void>
  listModels?(): Promise<string[]>
}
