"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
// api/routes/missions.ts — Mission orchestration REST endpoints
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');
const autonomousMission_1 = require("../../coordination/autonomousMission");
const missionState_1 = require("../../coordination/missionState");
const missionTodo_1 = require("../../coordination/missionTodo");
const taskBus_1 = require("../../coordination/taskBus");
const humanInTheLoop_1 = require("../../coordination/humanInTheLoop");
const router = express.Router();
// POST /api/missions — start a new mission
router.post('/api/missions', async (req, res) => {
    const { goal, description, options } = req.body ?? {};
    if (!goal || typeof goal !== 'string') {
        res.status(400).json({ error: 'Missing required field: goal' });
        return;
    }
    try {
        // Fire async — respond immediately with missionId
        const descStr = description || goal;
        let missionId = null;
        // Create the mission state stub before full execution so we can return the ID
        const { randomUUID } = require('crypto');
        missionId = randomUUID();
        // Start async, don't await
        autonomousMission_1.autonomousMission.startMission(goal, descStr, options ?? {}).catch((err) => {
            console.error(`[MissionsRoute] Mission error: ${err?.message}`);
        });
        res.status(202).json({ message: 'Mission started', goal, options: options ?? {} });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// GET /api/missions — list all missions
router.get('/api/missions', (_req, res) => {
    try {
        res.json(missionState_1.missionState.listMissions());
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// GET /api/missions/:id — mission detail + task queue
router.get('/api/missions/:id', (req, res) => {
    try {
        const mission = missionState_1.missionState.loadMission(req.params.id);
        if (!mission) {
            res.status(404).json({ error: `Mission not found: ${req.params.id}` });
            return;
        }
        const tasks = taskBus_1.taskBus.getQueue(req.params.id);
        res.json({ ...mission, tasks });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// GET /api/missions/:id/todo — raw markdown TODO
router.get('/api/missions/:id/todo', (req, res) => {
    try {
        const todo = missionTodo_1.missionTodo.readTodo(req.params.id);
        res.setHeader('Content-Type', 'text/plain');
        res.send(todo || '(no todo file yet)');
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// POST /api/missions/:id/pause
router.post('/api/missions/:id/pause', (req, res) => {
    try {
        autonomousMission_1.autonomousMission.pauseMission(req.params.id);
        res.json({ id: req.params.id, status: 'paused' });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// POST /api/missions/:id/resume
router.post('/api/missions/:id/resume', async (req, res) => {
    try {
        autonomousMission_1.autonomousMission.resumeMission(req.params.id).catch(() => { });
        res.json({ id: req.params.id, status: 'resuming' });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// POST /api/missions/:id/cancel
router.post('/api/missions/:id/cancel', (req, res) => {
    try {
        autonomousMission_1.autonomousMission.cancelMission(req.params.id);
        res.json({ id: req.params.id, status: 'cancelled' });
    }
    catch (err) {
        res.status(500).json({ error: err?.message ?? String(err) });
    }
});
// POST /api/coordination/approve — approve a pending human-in-the-loop task
router.post('/api/coordination/approve', (req, res) => {
    const { taskId } = req.body ?? {};
    if (!taskId) {
        res.status(400).json({ error: 'Missing field: taskId' });
        return;
    }
    humanInTheLoop_1.humanInTheLoop.approve(taskId);
    res.json({ taskId, approved: true });
});
// POST /api/coordination/reject — reject a pending human-in-the-loop task
router.post('/api/coordination/reject', (req, res) => {
    const { taskId, reason } = req.body ?? {};
    if (!taskId) {
        res.status(400).json({ error: 'Missing field: taskId' });
        return;
    }
    humanInTheLoop_1.humanInTheLoop.reject(taskId, reason);
    res.json({ taskId, approved: false, reason: reason ?? null });
});
exports.default = router;
