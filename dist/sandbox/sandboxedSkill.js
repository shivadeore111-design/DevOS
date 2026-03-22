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
exports.sandboxedSkill = void 0;
// sandbox/sandboxedSkill.ts — Run a DevOS skill inside a Docker sandbox
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const sandboxManager_1 = require("./sandboxManager");
const sandboxFileSync_1 = require("./sandboxFileSync");
const OUTPUTS_DIR = '/app/outputs';
const INPUTS_FILE = 'inputs.json';
class SandboxedSkill {
    async run(opts) {
        const { skillName, taskId, inputs, sandboxOpts } = opts;
        console.log(`[SandboxedSkill] Running skill '${skillName}' for task ${taskId} in Docker`);
        // 1. Create a temp local output dir to sync results into
        const localOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), `devos-${taskId}-`));
        // 2. Create the sandbox container
        const sandbox = await sandboxManager_1.sandboxManager.createSandbox(taskId, {
            image: 'node:20-alpine',
            memoryMb: 256,
            timeoutMs: 60000,
            env: {
                DEVOS_SKILL: skillName,
                DEVOS_TASK_ID: taskId,
            },
            ...sandboxOpts,
        });
        try {
            // 3. Copy the entire DevOS project into the container (minus node_modules)
            const projectRoot = process.cwd();
            const relevantDirs = ['executor', 'skills', 'llm', 'core'];
            for (const dir of relevantDirs) {
                const localDir = path.join(projectRoot, dir);
                if (fs.existsSync(localDir)) {
                    await (0, sandboxFileSync_1.copyToSandbox)(sandbox.containerId, localDir, '/app');
                }
            }
            // 4. Copy package.json so we can install deps if needed
            const pkgPath = path.join(projectRoot, 'package.json');
            if (fs.existsSync(pkgPath)) {
                await (0, sandboxFileSync_1.copyToSandbox)(sandbox.containerId, pkgPath, '/app');
            }
            // 5. Write inputs.json into the container
            await (0, sandboxFileSync_1.writeJsonToSandbox)(sandbox.containerId, '/app', INPUTS_FILE, inputs);
            // 6. Create outputs directory inside the container
            await sandboxManager_1.sandboxManager.runInSandbox(taskId, ['mkdir', '-p', OUTPUTS_DIR]);
            // 7. Run the skill — expects a skill runner script at /app/executor/skillEntry.js
            //    Falls back to a minimal inline node command if not present
            const skillEntry = path.join(projectRoot, 'executor', 'skillEntry.js');
            const cmd = fs.existsSync(skillEntry)
                ? ['node', '/app/executor/skillEntry.js', skillName, '/app/inputs.json', OUTPUTS_DIR]
                : ['node', '-e',
                    `const s=require('/app/skills/${skillName}');` +
                        `const i=require('/app/inputs.json');` +
                        `Promise.resolve(s.run?s.run(i):s(i)).then(r=>{` +
                        `require('fs').writeFileSync('${OUTPUTS_DIR}/result.json',JSON.stringify(r))` +
                        `}).catch(e=>{process.stderr.write(String(e));process.exit(1)})`
                ];
            const result = await sandboxManager_1.sandboxManager.runInSandbox(taskId, cmd, sandboxOpts?.timeoutMs ?? 60000);
            // 8. Sync outputs back to local temp dir
            if (result.success) {
                try {
                    await (0, sandboxFileSync_1.syncOutputs)(sandbox.containerId, OUTPUTS_DIR, localOutputDir);
                    // Try to parse result.json if present
                    const resultFile = path.join(localOutputDir, 'outputs', 'result.json');
                    if (fs.existsSync(resultFile)) {
                        try {
                            result.outputs = JSON.parse(fs.readFileSync(resultFile, 'utf-8'));
                        }
                        catch { /* not JSON — leave as undefined */ }
                    }
                }
                catch (syncErr) {
                    console.warn(`[SandboxedSkill] Could not sync outputs: ${syncErr?.message}`);
                }
            }
            return result;
        }
        finally {
            // 9. Always destroy sandbox and clean temp dir
            await sandboxManager_1.sandboxManager.destroySandbox(taskId);
            try {
                fs.rmSync(localOutputDir, { recursive: true, force: true });
            }
            catch { /* ignore */ }
        }
    }
}
exports.sandboxedSkill = new SandboxedSkill();
