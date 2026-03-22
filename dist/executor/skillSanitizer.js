"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillSanitizer = exports.SkillSanitizer = void 0;
// executor/skillSanitizer.ts — Strips LLM-generated artefacts from skill files
//                               (markdown fences, BOM, trailing whitespace, etc.)
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// All markdown fence patterns we want to strip
const FENCE_PATTERNS = [
    /^```typescript\s*/gim,
    /^```javascript\s*/gim,
    /^```ts\s*/gim,
    /^```js\s*/gim,
    /^```\s*$/gim,
];
// BOM (byte order mark) — U+FEFF
const BOM_RE = /^\uFEFF/;
class SkillSanitizer {
    /**
     * Sanitize a code string:
     *  1. Remove BOM
     *  2. Strip all markdown code fences (``` typescript, ``` javascript, ``` etc.)
     *  3. Ensure file ends with exactly one newline
     *
     * Returns the cleaned string.
     */
    sanitize(code) {
        let out = code;
        // 1. Strip BOM
        out = out.replace(BOM_RE, "");
        // 2. Strip markdown fences
        for (const re of FENCE_PATTERNS) {
            out = out.replace(re, "");
        }
        // 3. Normalise trailing whitespace — ensure exactly one trailing newline
        out = out.trimEnd() + "\n";
        return out;
    }
    /**
     * Read a file, sanitize its content, write back only if something changed.
     * Returns true if the file was modified.
     */
    async sanitizeFile(filePath) {
        let original;
        try {
            original = fs_1.default.readFileSync(filePath, "utf-8");
        }
        catch (err) {
            console.error(`[SkillSanitizer] Could not read ${filePath}: ${err.message}`);
            return false;
        }
        const cleaned = this.sanitize(original);
        if (cleaned === original)
            return false;
        try {
            fs_1.default.writeFileSync(filePath, cleaned, "utf-8");
            console.log(`[SkillSanitizer] Sanitized: ${filePath}`);
            return true;
        }
        catch (err) {
            console.error(`[SkillSanitizer] Could not write ${filePath}: ${err.message}`);
            return false;
        }
    }
    /**
     * Recursively scans a directory for all .ts files, sanitizes each.
     * Returns the count of files that were modified.
     */
    async sanitizeDirectory(dirPath) {
        const absDir = path_1.default.isAbsolute(dirPath) ? dirPath : path_1.default.join(process.cwd(), dirPath);
        if (!fs_1.default.existsSync(absDir)) {
            console.log(`[SkillSanitizer] Directory not found, skipping: ${absDir}`);
            return 0;
        }
        const files = this._collectTsFiles(absDir);
        let count = 0;
        for (const file of files) {
            const modified = await this.sanitizeFile(file);
            if (modified)
                count++;
        }
        if (count > 0) {
            console.log(`[SkillSanitizer] Sanitized ${count}/${files.length} files in ${dirPath}`);
        }
        return count;
    }
    // ── Private ───────────────────────────────────────────────
    _collectTsFiles(dir) {
        const results = [];
        let entries;
        try {
            entries = fs_1.default.readdirSync(dir);
        }
        catch {
            return results;
        }
        for (const entry of entries) {
            const full = path_1.default.join(dir, entry);
            try {
                const stat = fs_1.default.statSync(full);
                if (stat.isDirectory()) {
                    results.push(...this._collectTsFiles(full));
                }
                else if (entry.endsWith(".ts")) {
                    results.push(full);
                }
            }
            catch {
                // skip inaccessible entries
            }
        }
        return results;
    }
}
exports.SkillSanitizer = SkillSanitizer;
exports.skillSanitizer = new SkillSanitizer();
