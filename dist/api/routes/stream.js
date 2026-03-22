"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
// api/routes/stream.ts — SSE event streaming endpoints
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express");
const eventBus_1 = require("../../core/eventBus");
const router = express.Router();
const SSE_EVENTS = [
    "goal_started",
    "goal_completed",
    "goal_failed",
    "action_executed",
    "plan_generated",
    "session_created",
    "product_module_completed",
    "emergency_stop",
];
function sendSseHeaders(res) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();
}
function writeSseEvent(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === "function")
        res.flush();
}
// GET /api/stream — all DevOS runtime events
router.get("/api/stream", (req, res) => {
    sendSseHeaders(res);
    const heartbeat = setInterval(() => {
        res.write(": heartbeat\n\n");
        if (typeof res.flush === "function")
            res.flush();
    }, 15000);
    const handlers = {};
    for (const event of SSE_EVENTS) {
        handlers[event] = (data) => writeSseEvent(res, event, data);
        eventBus_1.eventBus.on(event, handlers[event]);
    }
    req.on("close", () => {
        clearInterval(heartbeat);
        for (const event of SSE_EVENTS)
            eventBus_1.eventBus.off(event, handlers[event]);
    });
});
// GET /api/stream/goals/:id — events filtered to one goal
router.get("/api/stream/goals/:id", (req, res) => {
    const { id } = req.params;
    sendSseHeaders(res);
    const heartbeat = setInterval(() => {
        res.write(": heartbeat\n\n");
        if (typeof res.flush === "function")
            res.flush();
    }, 15000);
    const handlers = {};
    for (const event of SSE_EVENTS) {
        handlers[event] = (data) => {
            if (!data || data.goalId === id || data.taskId === id || data.sessionId === id) {
                writeSseEvent(res, event, data);
            }
        };
        eventBus_1.eventBus.on(event, handlers[event]);
    }
    req.on("close", () => {
        clearInterval(heartbeat);
        for (const event of SSE_EVENTS)
            eventBus_1.eventBus.off(event, handlers[event]);
    });
});
exports.default = router;
