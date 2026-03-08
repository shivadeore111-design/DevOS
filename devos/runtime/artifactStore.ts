// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// devos/runtime/artifactStore.ts — Durable output storage per goal

import fs   from "fs";
import path from "path";

const ARTIFACTS_ROOT = path.join(process.cwd(), "artifacts");

export class ArtifactStore {
  constructor() {
    fs.mkdirSync(ARTIFACTS_ROOT, { recursive: true });
  }

  /** Save content as a named artifact for a goal; returns absolute path */
  async save(goalId: string, name: string, content: string): Promise<string> {
    const dir  = this.goalDir(goalId);
    const dest = path.join(dir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dest, content, "utf-8");
    console.log(`[ArtifactStore] Saved: ${dest}`);
    return dest;
  }

  /** Copy an existing file into the artifact store; returns artifact path */
  async saveFile(goalId: string, sourcePath: string): Promise<string> {
    const dir  = this.goalDir(goalId);
    const name = path.basename(sourcePath);
    const dest = path.join(dir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(sourcePath, dest);
    console.log(`[ArtifactStore] Copied: ${sourcePath} → ${dest}`);
    return dest;
  }

  /** List all artifact filenames for a goal */
  list(goalId: string): string[] {
    const dir = this.goalDir(goalId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir);
  }

  /** Read artifact content, or null if it doesn't exist */
  get(goalId: string, name: string): string | null {
    const file = path.join(this.goalDir(goalId), name);
    if (!fs.existsSync(file)) return null;
    return fs.readFileSync(file, "utf-8");
  }

  // ── Internal ─────────────────────────────────────────────

  private goalDir(goalId: string): string {
    return path.join(ARTIFACTS_ROOT, `task_${goalId}`);
  }
}

export const artifactStore = new ArtifactStore();
