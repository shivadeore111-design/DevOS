// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

export interface LLMProvider {
  name: string;
  isHealthy(): boolean;
  markFailure(): void;
  markSuccess(): void;
  generate(prompt: string): Promise<string>;
}