"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.planTool = void 0;
// core/planTool.ts — Manus-style phased task planner.
// Tracks multi-phase task execution with workspace persistence.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ── PlanTool singleton ────────────────────────────────────────
class PlanTool {
    constructor() {
        this.activePlans = new Map();
    }
    create(goal, phases) {
        const id = `task_${Date.now()}`;
        const workspaceDir = path_1.default.join(process.cwd(), 'workspace', 'tasks', id);
        fs_1.default.mkdirSync(workspaceDir, { recursive: true });
        const plan = {
            id,
            goal,
            phases: phases.map((p, i) => ({
                ...p,
                status: i === 0 ? 'running' : 'pending',
                startedAt: i === 0 ? Date.now() : undefined,
            })),
            currentPhaseIndex: 0,
            status: 'running',
            createdAt: Date.now(),
            workspaceDir,
        };
        this.activePlans.set(id, plan);
        this.savePlan(plan);
        return plan;
    }
    advancePhase(planId, result) {
        const plan = this.activePlans.get(planId);
        if (!plan)
            return null;
        const current = plan.phases[plan.currentPhaseIndex];
        if (current) {
            current.status = 'done';
            current.result = result;
            current.completedAt = Date.now();
        }
        plan.currentPhaseIndex++;
        if (plan.currentPhaseIndex >= plan.phases.length) {
            plan.status = 'done';
            plan.completedAt = Date.now();
            this.savePlan(plan);
            return null;
        }
        const next = plan.phases[plan.currentPhaseIndex];
        next.status = 'running';
        next.startedAt = Date.now();
        this.savePlan(plan);
        return next;
    }
    failPhase(planId, error) {
        const plan = this.activePlans.get(planId);
        if (!plan)
            return;
        const current = plan.phases[plan.currentPhaseIndex];
        if (current) {
            current.status = 'failed';
            current.result = error;
        }
        plan.status = 'failed';
        this.savePlan(plan);
    }
    getCurrentPhase(planId) {
        const plan = this.activePlans.get(planId);
        if (!plan)
            return null;
        return plan.phases[plan.currentPhaseIndex] || null;
    }
    getPlan(planId) {
        return this.activePlans.get(planId) || this.loadPlan(planId);
    }
    formatSummary(plan) {
        return plan.phases.map((p, i) => {
            const icon = p.status === 'done' ? '✓' : p.status === 'running' ? '▶' : p.status === 'failed' ? '✗' : '○';
            return `${icon} Phase ${i + 1}: ${p.title}`;
        }).join(' → ');
    }
    savePlan(plan) {
        try {
            fs_1.default.writeFileSync(path_1.default.join(plan.workspaceDir, 'plan.json'), JSON.stringify(plan, null, 2));
        }
        catch { }
    }
    loadPlan(planId) {
        try {
            const planPath = path_1.default.join(process.cwd(), 'workspace', 'tasks', planId, 'plan.json');
            if (!fs_1.default.existsSync(planPath))
                return null;
            const loaded = JSON.parse(fs_1.default.readFileSync(planPath, 'utf-8'));
            this.activePlans.set(planId, loaded);
            return loaded;
        }
        catch {
            return null;
        }
    }
}
exports.planTool = new PlanTool();
