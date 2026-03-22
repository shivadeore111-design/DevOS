"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.skillRunner = void 0;
// executor/skillRunner.ts — Dispatch skill execution: sandboxed (Docker) or in-process
const path = __importStar(require("path"));
class SkillRunner {
    /**
     * Run a skill by name with the given inputs.
     * - If DEVOS_SANDBOX=true, executes inside a Docker container via sandboxedSkill.
     * - Otherwise, requires the skill module in-process (fast, default).
     */
    async run(opts) {
        const { skillName, taskId, inputs } = opts;
        const sandboxed = process.env.DEVOS_SANDBOX === 'true';
        if (sandboxed) {
            return this.runSandboxed(skillName, taskId, inputs);
        }
        return this.runInProcess(skillName, taskId, inputs);
    }
    // ── Sandboxed path ────────────────────────────────────────────────────────
    async runSandboxed(skillName, taskId, inputs) {
        const { sandboxedSkill } = await Promise.resolve().then(() => __importStar(require('../sandbox/sandboxedSkill')));
        const result = await sandboxedSkill.run({ skillName, taskId, inputs });
        return {
            success: result.success,
            output: result.outputs ?? result.stdout,
            stdout: result.stdout,
            stderr: result.stderr,
            durationMs: result.durationMs,
            sandboxed: true,
        };
    }
    // ── In-process path ───────────────────────────────────────────────────────
    async runInProcess(skillName, taskId, inputs) {
        const startMs = Date.now();
        const skillDir = path.join(process.cwd(), 'skills');
        try {
            // Try .ts (ts-node / tsx context) then compiled .js
            let skillMod;
            const candidates = [
                path.join(skillDir, skillName, 'index.ts'),
                path.join(skillDir, skillName, 'index.js'),
                path.join(skillDir, `${skillName}.ts`),
                path.join(skillDir, `${skillName}.js`),
            ];
            for (const candidate of candidates) {
                try {
                    skillMod = require(candidate);
                    break;
                }
                catch { /* try next */ }
            }
            if (!skillMod) {
                throw new Error(`Skill '${skillName}' not found in ${skillDir}`);
            }
            // Convention: skill exports a default function or { run }
            const fn = skillMod.run ?? skillMod.default ?? skillMod;
            if (typeof fn !== 'function') {
                throw new Error(`Skill '${skillName}' does not export a callable function`);
            }
            const output = await Promise.resolve(fn(inputs, { taskId }));
            return {
                success: true,
                output,
                durationMs: Date.now() - startMs,
                sandboxed: false,
            };
        }
        catch (err) {
            return {
                success: false,
                output: null,
                stderr: err?.message ?? String(err),
                durationMs: Date.now() - startMs,
                sandboxed: false,
            };
        }
    }
}
exports.skillRunner = new SkillRunner();
