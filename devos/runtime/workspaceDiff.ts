// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// devos/runtime/workspaceDiff.ts — Before/after snapshot diffing for workspaces

import fs   from "fs";
import path from "path";

export interface DiffResult {
  filesAdded:              string[];
  filesModified:           string[];
  filesDeleted:            string[];
  dependenciesInstalled:   string[];
}

interface Snapshot {
  files:       Record<string, number>;   // relative path → mtime (ms)
  nodeModules: string[];                  // top-level package names
}

export class WorkspaceDiff {
  private snapshots = new Map<string, Snapshot>();

  /** Record current state of a workspace directory */
  async snapshot(goalId: string, workspacePath: string): Promise<void> {
    const snap = this.buildSnapshot(workspacePath);
    this.snapshots.set(goalId, snap);
    console.log(`[WorkspaceDiff] Snapshot for ${goalId}: ${Object.keys(snap.files).length} file(s)`);
  }

  /** Compare current workspace state to its snapshot */
  async diff(goalId: string, workspacePath: string): Promise<DiffResult> {
    const before = this.snapshots.get(goalId) ?? { files: {}, nodeModules: [] };
    const after  = this.buildSnapshot(workspacePath);

    const beforeKeys = new Set(Object.keys(before.files));
    const afterKeys  = new Set(Object.keys(after.files));

    const filesAdded:    string[] = [];
    const filesModified: string[] = [];
    const filesDeleted:  string[] = [];

    for (const k of afterKeys) {
      if (!beforeKeys.has(k)) {
        filesAdded.push(k);
      } else if (after.files[k] !== before.files[k]) {
        filesModified.push(k);
      }
    }

    for (const k of beforeKeys) {
      if (!afterKeys.has(k)) filesDeleted.push(k);
    }

    // Dependencies: new packages that appeared in node_modules
    const beforePkgs = new Set(before.nodeModules);
    const dependenciesInstalled = after.nodeModules.filter(p => !beforePkgs.has(p));

    return { filesAdded, filesModified, filesDeleted, dependenciesInstalled };
  }

  /** Human-readable summary of a DiffResult */
  summary(diff: DiffResult): string {
    const parts: string[] = [];
    if (diff.filesAdded.length)            parts.push(`${diff.filesAdded.length} file(s) added`);
    if (diff.filesModified.length)         parts.push(`${diff.filesModified.length} file(s) modified`);
    if (diff.filesDeleted.length)          parts.push(`${diff.filesDeleted.length} file(s) deleted`);
    if (diff.dependenciesInstalled.length) parts.push(`${diff.dependenciesInstalled.length} package(s) installed`);
    return parts.length ? parts.join(", ") : "no changes detected";
  }

  // ── Internal ──────────────────────────────────────────────

  private buildSnapshot(dir: string): Snapshot {
    const files:  Record<string, number> = {};
    const nodeModules: string[] = [];

    if (!fs.existsSync(dir)) return { files, nodeModules };

    this.walkDir(dir, dir, files);

    // Detect top-level installed packages
    const nmDir = path.join(dir, "node_modules");
    if (fs.existsSync(nmDir)) {
      for (const entry of fs.readdirSync(nmDir)) {
        if (!entry.startsWith(".")) nodeModules.push(entry);
      }
    }

    return { files, nodeModules };
  }

  private walkDir(root: string, dir: string, out: Record<string, number>): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel  = path.relative(root, full);

      // Skip node_modules from file listing (handled separately)
      if (entry.name === "node_modules") continue;
      if (entry.name === ".git")         continue;

      if (entry.isDirectory()) {
        this.walkDir(root, full, out);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(full);
          out[rel]   = stat.mtimeMs;
        } catch { /* skip unreadable */ }
      }
    }
  }
}

export const workspaceDiff = new WorkspaceDiff();
