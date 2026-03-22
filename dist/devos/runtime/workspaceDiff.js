"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceDiff = exports.WorkspaceDiff = void 0;
// devos/runtime/workspaceDiff.ts — Before/after snapshot diffing for workspaces
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class WorkspaceDiff {
    constructor() {
        this.snapshots = new Map();
    }
    /** Record current state of a workspace directory */
    async snapshot(goalId, workspacePath) {
        const snap = this.buildSnapshot(workspacePath);
        this.snapshots.set(goalId, snap);
        console.log(`[WorkspaceDiff] Snapshot for ${goalId}: ${Object.keys(snap.files).length} file(s)`);
    }
    /** Compare current workspace state to its snapshot */
    async diff(goalId, workspacePath) {
        const before = this.snapshots.get(goalId) ?? { files: {}, nodeModules: [] };
        const after = this.buildSnapshot(workspacePath);
        const beforeKeys = new Set(Object.keys(before.files));
        const afterKeys = new Set(Object.keys(after.files));
        const filesAdded = [];
        const filesModified = [];
        const filesDeleted = [];
        for (const k of afterKeys) {
            if (!beforeKeys.has(k)) {
                filesAdded.push(k);
            }
            else if (after.files[k] !== before.files[k]) {
                filesModified.push(k);
            }
        }
        for (const k of beforeKeys) {
            if (!afterKeys.has(k))
                filesDeleted.push(k);
        }
        // Dependencies: new packages that appeared in node_modules
        const beforePkgs = new Set(before.nodeModules);
        const dependenciesInstalled = after.nodeModules.filter(p => !beforePkgs.has(p));
        return { filesAdded, filesModified, filesDeleted, dependenciesInstalled };
    }
    /** Human-readable summary of a DiffResult */
    summary(diff) {
        const parts = [];
        if (diff.filesAdded.length)
            parts.push(`${diff.filesAdded.length} file(s) added`);
        if (diff.filesModified.length)
            parts.push(`${diff.filesModified.length} file(s) modified`);
        if (diff.filesDeleted.length)
            parts.push(`${diff.filesDeleted.length} file(s) deleted`);
        if (diff.dependenciesInstalled.length)
            parts.push(`${diff.dependenciesInstalled.length} package(s) installed`);
        return parts.length ? parts.join(", ") : "no changes detected";
    }
    // ── Internal ──────────────────────────────────────────────
    buildSnapshot(dir) {
        const files = {};
        const nodeModules = [];
        if (!fs_1.default.existsSync(dir))
            return { files, nodeModules };
        this.walkDir(dir, dir, files);
        // Detect top-level installed packages
        const nmDir = path_1.default.join(dir, "node_modules");
        if (fs_1.default.existsSync(nmDir)) {
            for (const entry of fs_1.default.readdirSync(nmDir)) {
                if (!entry.startsWith("."))
                    nodeModules.push(entry);
            }
        }
        return { files, nodeModules };
    }
    walkDir(root, dir, out) {
        let entries;
        try {
            entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const full = path_1.default.join(dir, entry.name);
            const rel = path_1.default.relative(root, full);
            // Skip node_modules from file listing (handled separately)
            if (entry.name === "node_modules")
                continue;
            if (entry.name === ".git")
                continue;
            if (entry.isDirectory()) {
                this.walkDir(root, full, out);
            }
            else if (entry.isFile()) {
                try {
                    const stat = fs_1.default.statSync(full);
                    out[rel] = stat.mtimeMs;
                }
                catch { /* skip unreadable */ }
            }
        }
    }
}
exports.WorkspaceDiff = WorkspaceDiff;
exports.workspaceDiff = new WorkspaceDiff();
