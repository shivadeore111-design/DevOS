// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

export type Capability =
  | "git"
  | "network"
  | "filesystem-outside-sandbox"
  | "process-control";

export class CapabilityManager {
  private enabled: Set<Capability>;

  constructor() {
    this.enabled = new Set();
  }

  enable(cap: Capability) {
    this.enabled.add(cap);
    console.log(`🦾 Capability enabled: ${cap}`);
  }

  disable(cap: Capability) {
    this.enabled.delete(cap);
  }

  has(cap: Capability): boolean {
    return this.enabled.has(cap);
  }

  list(): Capability[] {
    return Array.from(this.enabled);
  }
}