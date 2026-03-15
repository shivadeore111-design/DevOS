"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.artifactStore = exports.ArtifactStore = void 0;
// devos/runtime/artifactStore.ts — Durable output storage per goal
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ARTIFACTS_ROOT = path_1.default.join(process.cwd(), "artifacts");
class ArtifactStore {
    constructor() {
        fs_1.default.mkdirSync(ARTIFACTS_ROOT, { recursive: true });
    }
    /** Save content as a named artifact for a goal; returns absolute path */
    async save(goalId, name, content) {
        const dir = this.goalDir(goalId);
        const dest = path_1.default.join(dir, name);
        fs_1.default.mkdirSync(dir, { recursive: true });
        fs_1.default.writeFileSync(dest, content, "utf-8");
        console.log(`[ArtifactStore] Saved: ${dest}`);
        return dest;
    }
    /** Copy an existing file into the artifact store; returns artifact path */
    async saveFile(goalId, sourcePath) {
        const dir = this.goalDir(goalId);
        const name = path_1.default.basename(sourcePath);
        const dest = path_1.default.join(dir, name);
        fs_1.default.mkdirSync(dir, { recursive: true });
        fs_1.default.copyFileSync(sourcePath, dest);
        console.log(`[ArtifactStore] Copied: ${sourcePath} → ${dest}`);
        return dest;
    }
    /** List all artifact filenames for a goal */
    list(goalId) {
        const dir = this.goalDir(goalId);
        if (!fs_1.default.existsSync(dir))
            return [];
        return fs_1.default.readdirSync(dir);
    }
    /** Read artifact content, or null if it doesn't exist */
    get(goalId, name) {
        const file = path_1.default.join(this.goalDir(goalId), name);
        if (!fs_1.default.existsSync(file))
            return null;
        return fs_1.default.readFileSync(file, "utf-8");
    }
    // ── Internal ─────────────────────────────────────────────
    goalDir(goalId) {
        return path_1.default.join(ARTIFACTS_ROOT, `task_${goalId}`);
    }
}
exports.ArtifactStore = ArtifactStore;
exports.artifactStore = new ArtifactStore();
