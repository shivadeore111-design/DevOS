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
exports.teachMode = exports.TeachMode = void 0;
// personal/teachMode.ts — Record user workflows and replay them
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const toolRuntime_1 = require("../executor/toolRuntime");
const FILE = path.join(process.cwd(), 'workspace/taught-workflows.json');
class TeachMode {
    constructor() {
        this.recording = false;
        this.currentWorkflow = null;
    }
    startRecording(workflowName) {
        this.recording = true;
        this.currentWorkflow = { name: workflowName, steps: [] };
        console.log(`[TeachMode] 🔴 Recording: ${workflowName}. Run your steps then type: devos stop`);
    }
    recordAction(action, tool, inputs, result) {
        if (!this.recording || !this.currentWorkflow)
            return;
        this.currentWorkflow.steps = this.currentWorkflow.steps || [];
        this.currentWorkflow.steps.push({ action, tool, inputs, result });
    }
    stopRecording() {
        this.recording = false;
        const workflow = {
            id: crypto.randomUUID(),
            name: this.currentWorkflow?.name || 'unnamed',
            steps: this.currentWorkflow?.steps || [],
            recordedAt: new Date().toISOString(),
            runCount: 0,
        };
        const workflows = this.listWorkflows();
        workflows.push(workflow);
        const dir = path.dirname(FILE);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(workflows, null, 2));
        this.currentWorkflow = null;
        console.log(`[TeachMode] ✅ Saved: ${workflow.name} (${workflow.steps.length} steps)`);
        return workflow;
    }
    listWorkflows() {
        if (!fs.existsSync(FILE))
            return [];
        try {
            return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
        }
        catch {
            return [];
        }
    }
    async runWorkflow(name) {
        const workflows = this.listWorkflows();
        const workflow = workflows.find(w => w.name.toLowerCase() === name.toLowerCase());
        if (!workflow)
            return 'Workflow not found: ' + name;
        const results = [];
        for (const step of workflow.steps) {
            try {
                const result = await toolRuntime_1.toolRuntime.execute(step.tool, step.inputs);
                results.push(`✅ ${step.action}: ${JSON.stringify(result).slice(0, 100)}`);
            }
            catch (e) {
                results.push(`❌ ${step.action}: ${e.message}`);
            }
        }
        workflow.runCount++;
        fs.writeFileSync(FILE, JSON.stringify(workflows, null, 2));
        return results.join('\n');
    }
    isRecording() {
        return this.recording;
    }
}
exports.TeachMode = TeachMode;
exports.teachMode = new TeachMode();
