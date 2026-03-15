// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// api/routes/stream.ts — SSE event streaming endpoints

// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express") as any;

import { eventBus } from "../../core/eventBus";

const router = express.Router();

const SSE_EVENTS = [
  "goal_started",
  "goal_completed",
  "goal_failed",
  "task_completed",
  "task_failed",
  "action_executed",
  "plan_generated",
  "session_created",
  "product_module_completed",
  "emergency_stop",
  "agent_thinking",
  "mission:complete",
  "pilot_completed",
] as const;

function sendSseHeaders(res: any): void {
  res.setHeader("Content-Type",                "text/event-stream");
  res.setHeader("Cache-Control",               "no-cache");
  res.setHeader("Connection",                  "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
}

function writeSseEvent(res: any, event: string, data: unknown): void {
  // Write as UNNAMED event (data: only) so EventSource.onmessage catches it
  // Include event type inside the payload so the client can filter
  const payload = {
    type: event,
    ...(data && typeof data === 'object' ? data : { value: data })
  }
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
  if (typeof res.flush === 'function') res.flush()
}

// GET /api/stream — all DevOS runtime events
router.get("/api/stream", (req: any, res: any) => {
  sendSseHeaders(res);

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
    if (typeof res.flush === "function") res.flush();
  }, 15000);

  const handlers: Record<string, (data: any) => void> = {};
  for (const event of SSE_EVENTS) {
    handlers[event] = (data: unknown) => writeSseEvent(res, event, data);
    eventBus.on(event, handlers[event]);
  }

  req.on("close", () => {
    clearInterval(heartbeat);
    for (const event of SSE_EVENTS) eventBus.off(event, handlers[event]);
  });
});

// GET /api/stream/goals/:id — events filtered to one goal
router.get("/api/stream/goals/:id", (req: any, res: any) => {
  const { id } = req.params;
  sendSseHeaders(res);

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
    if (typeof res.flush === "function") res.flush();
  }, 15000);

  const handlers: Record<string, (data: any) => void> = {};
  for (const event of SSE_EVENTS) {
    handlers[event] = (data: any) => {
      if (!data || data.goalId === id || data.taskId === id || data.sessionId === id) {
        writeSseEvent(res, event, data);
      }
    };
    eventBus.on(event, handlers[event]);
  }

  req.on("close", () => {
    clearInterval(heartbeat);
    for (const event of SSE_EVENTS) eventBus.off(event, handlers[event]);
  });
});

export default router;
