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
exports.autonomousMission = void 0;
// coordination/autonomousMission.ts — Main mission orchestrator
const crypto = __importStar(require("crypto"));
const agentExecutor_1 = require("../agents/agentExecutor");
const eventBus_1 = require("../core/eventBus");
const taskBus_1 = require("./taskBus");
const missionState_1 = require("./missionState");
const missionTodo_1 = require("./missionTodo");
const contextCompressor_1 = require("./contextCompressor");
const guardrails_1 = require("./guardrails");
const humanInTheLoop_1 = require("./humanInTheLoop");
const liveThinking_1 = require("./liveThinking");
const VALID_ROLES = ['ceo', 'engineer', 'researcher', 'operator'];
function toRole(raw) {
    const lower = raw.toLowerCase();
    return VALID_ROLES.includes(lower) ? lower : 'engineer';
}
function detectMissionType(goal) {
    const g = goal.toLowerCase();
    if (g.includes('build') || g.includes('create') || g.includes('implement'))
        return 'build';
    if (g.includes('research') || g.includes('find') || g.includes('analyse') || g.includes('analyze'))
        return 'research';
    if (g.includes('automate') || g.includes('script') || g.includes('workflow'))
        return 'automate';
    if (g.includes('monitor') || g.includes('watch') || g.includes('alert'))
        return 'monitor';
    return 'personal';
}
class AutonomousMission {
    constructor() {
        this.paused = new Set();
        this.cancelled = new Set();
    }
    async startMission(goal, description, options = {}) {
        const missionId = crypto.randomUUID();
        const missionType = options.missionType ?? detectMissionType(goal);
        const startedAt = new Date().toISOString();
        console.log(`[Mission] 🚀 Starting mission: "${goal}"`);
        console.log(`[Mission]    ID: ${missionId}`);
        // ── Step 1: CEO decomposes goal ─────────────────────────
        liveThinking_1.liveThinking.think('ceo', `Decomposing: ${goal.slice(0, 60)}`, missionId);
        const ceoDecomposeTask = {
            id: `ceo-decompose-${missionId}`,
            title: 'Decompose goal into tasks',
            description: `Break this into 3-6 tasks. Respond with ONLY valid JSON (no markdown, no code fences):
{ "tasks": [ { "title": "...", "agent": "engineer|researcher|operator|ceo", "priority": 1|2|3, "isDangerous": false } ] }

Goal: ${goal}
Description: ${description}`,
        };
        let parsedTasks = [];
        try {
            const ceoResponse = await agentExecutor_1.agentExecutor.assign('ceo', ceoDecomposeTask, goal, missionId);
            // Extract JSON from response
            const jsonMatch = ceoResponse.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed?.tasks)) {
                    parsedTasks = parsed.tasks.filter((t) => t?.title);
                }
            }
        }
        catch (err) {
            console.warn(`[Mission] CEO decompose failed: ${err?.message} — using fallback single task`);
        }
        // Fallback if CEO didn't produce valid JSON
        if (parsedTasks.length === 0) {
            parsedTasks = [{ title: goal, agent: 'engineer', priority: 1, isDangerous: false }];
        }
        // ── Step 2: Enqueue tasks ────────────────────────────────
        const todoItems = parsedTasks.map(t => ({
            title: t.title,
            agent: t.agent,
            done: false,
        }));
        taskBus_1.taskBus.enqueue(missionId, parsedTasks.map(t => ({
            missionId,
            title: t.title,
            description: t.title,
            assignedTo: toRole(t.agent),
            priority: t.priority ?? 2,
            isDangerous: t.isDangerous ?? false,
        })));
        // ── Step 3: Create TODO file ─────────────────────────────
        missionTodo_1.missionTodo.createTodo(missionId, goal, todoItems);
        // ── Step 4: Persist initial mission state ────────────────
        const mission = {
            id: missionId,
            goal,
            description,
            type: missionType,
            status: 'active',
            tasksTotal: parsedTasks.length,
            tasksDone: 0,
            tasksFailed: 0,
            tokensUsed: 0,
            loopCount: 0,
            startedAt,
            options,
        };
        missionState_1.missionState.saveMission(mission);
        // ── Step 5: Execution loop ───────────────────────────────
        let loopCount = 0;
        let tasksDone = 0;
        let tasksFailed = 0;
        while (true) {
            // Check if cancelled
            if (this.cancelled.has(missionId)) {
                console.log(`[Mission] 🚫 Mission cancelled: ${missionId}`);
                missionState_1.missionState.updateMission(missionId, { status: 'cancelled' });
                break;
            }
            // Check if paused
            if (this.paused.has(missionId)) {
                console.log(`[Mission] ⏸  Mission paused: ${missionId}`);
                missionState_1.missionState.updateMission(missionId, { status: 'paused' });
                break;
            }
            // Guardrail: loop limit
            const loopCheck = guardrails_1.guardrails.checkLoopLimit(missionId, loopCount);
            if (!loopCheck.ok) {
                console.warn(`[Mission] ⚠️  Loop limit: ${loopCheck.reason}`);
                missionState_1.missionState.updateMission(missionId, { status: 'failed', loopCount });
                break;
            }
            // Guardrail: mission timeout
            const timeoutCheck = guardrails_1.guardrails.checkMissionTimeout(startedAt);
            if (!timeoutCheck.ok) {
                console.warn(`[Mission] ⚠️  Mission timed out`);
                missionState_1.missionState.updateMission(missionId, { status: 'failed', loopCount });
                break;
            }
            // Get next task
            const task = taskBus_1.taskBus.getNext(missionId);
            if (!task) {
                console.log(`[Mission] ✅ All tasks complete`);
                break;
            }
            // Claim task
            taskBus_1.taskBus.claim(task.id, task.assignedTo);
            console.log(`[Mission]   ▶ [${task.assignedTo}] ${task.title}`);
            // Human approval for dangerous tasks
            if (task.isDangerous) {
                const approved = await humanInTheLoop_1.humanInTheLoop.requestApproval(task.title, `Task marked as dangerous in mission: ${goal}`, task.id);
                if (!approved) {
                    console.warn(`[Mission]   ❌ Dangerous task rejected: ${task.title}`);
                    taskBus_1.taskBus.fail(task.id, 'Rejected by human-in-the-loop');
                    tasksFailed++;
                    missionState_1.missionState.updateMission(missionId, { tasksFailed, loopCount: ++loopCount });
                    continue;
                }
            }
            // Signal acting
            liveThinking_1.liveThinking.act(task.assignedTo, `Starting: ${task.title}`, missionId);
            // Build context with current TODO
            const todoContext = missionTodo_1.missionTodo.readTodo(missionId);
            const taskContext = `Current todo:\n${todoContext}\n\nNext task: ${task.description}`;
            // Execute task via assigned agent
            const execTask = {
                id: task.id,
                title: task.title,
                description: task.description,
            };
            let taskResult = '';
            let taskSuccess = true;
            try {
                taskResult = await agentExecutor_1.agentExecutor.assign(toRole(task.assignedTo), execTask, taskContext, missionId);
            }
            catch (err) {
                taskResult = err?.message ?? String(err);
                taskSuccess = false;
            }
            // Compress context if long
            await contextCompressor_1.contextCompressor.compress([taskResult]);
            // Tick TODO file
            missionTodo_1.missionTodo.tickTask(missionId, task.title);
            // Update task in bus
            if (taskSuccess) {
                taskBus_1.taskBus.complete(task.id, taskResult);
                tasksDone++;
                liveThinking_1.liveThinking.done(task.assignedTo, `Completed: ${task.title}`, missionId);
            }
            else {
                taskBus_1.taskBus.fail(task.id, taskResult);
                tasksFailed++;
                liveThinking_1.liveThinking.error(task.assignedTo, taskResult, missionId);
            }
            loopCount++;
            missionState_1.missionState.updateMission(missionId, { tasksDone, tasksFailed, loopCount });
            // Stop if nothing pending
            if (taskBus_1.taskBus.getPending(missionId).length === 0)
                break;
        }
        // ── Step 6: Finalise mission ─────────────────────────────
        const finalStatus = this.cancelled.has(missionId) ? 'cancelled'
            : this.paused.has(missionId) ? 'paused'
                : tasksFailed > 0 && tasksDone === 0 ? 'failed'
                    : 'complete';
        missionState_1.missionState.updateMission(missionId, {
            status: finalStatus,
            completedAt: new Date().toISOString(),
            tasksDone,
            tasksFailed,
            loopCount,
        });
        if (finalStatus === 'complete') {
            eventBus_1.eventBus.emit('mission:complete', { missionId, goal });
            console.log(`[Mission] 🎉 Mission complete: "${goal}" (${tasksDone} tasks)`);
        }
        return missionState_1.missionState.loadMission(missionId);
    }
    pauseMission(id) {
        this.paused.add(id);
        missionState_1.missionState.updateMission(id, { status: 'paused' });
        console.log(`[Mission] ⏸  Paused: ${id}`);
    }
    async resumeMission(id) {
        this.paused.delete(id);
        const mission = missionState_1.missionState.loadMission(id);
        if (!mission) {
            console.warn(`[Mission] Resume: mission not found: ${id}`);
            return;
        }
        missionState_1.missionState.updateMission(id, { status: 'active' });
        console.log(`[Mission] ▶️  Resuming: ${id}`);
        await this.startMission(mission.goal, mission.description, mission.options);
    }
    cancelMission(id) {
        this.cancelled.add(id);
        missionState_1.missionState.updateMission(id, { status: 'cancelled' });
        console.log(`[Mission] 🚫 Cancelled: ${id}`);
    }
}
exports.autonomousMission = new AutonomousMission();
