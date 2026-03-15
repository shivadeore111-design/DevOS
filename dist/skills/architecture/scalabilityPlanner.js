"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.scalabilityPlanner = exports.ScalabilityPlanner = void 0;
// ============================================================
// skills/architecture/scalabilityPlanner.ts
// Plans caching, queueing, and load balancing strategies.
// ============================================================
const router_1 = require("../../llm/router");
// ── Skill ─────────────────────────────────────────────────────
class ScalabilityPlanner {
    constructor() {
        this.name = "scalability_planner";
        this.description = "Plans caching strategy, queue design, and load balancing for any system";
    }
    async execute(args) {
        return this.plan(args.systemDescription);
    }
    async plan(systemDescription) {
        const systemPrompt = `You are a principal engineer specialising in scalability.
Design battle-tested scaling strategies using proven open-source tools.
Prefer Redis/BullMQ for queues, Redis for caching, nginx for load balancing.
Return ONLY valid JSON — no markdown, no commentary.`;
        const prompt = `Design a scalability plan for: "${systemDescription}"

Return JSON matching this schema:
{
  "cachingStrategy": {
    "type": "Redis",
    "ttlSeconds": 300,
    "keys": ["user:{id}", "session:{token}"],
    "invalidation": "write-through on update",
    "implementation": "ioredis with cache-aside pattern",
    "estimatedHitRate": 0.85
  },
  "queueDesign": {
    "technology": "Redis + BullMQ",
    "queues": [
      { "name": "emails", "priority": 1, "description": "Transactional email delivery" }
    ],
    "workers": 4,
    "retries": 3,
    "dlq": true,
    "description": "Why this queue design"
  },
  "loadBalancing": {
    "algorithm": "Round Robin",
    "healthCheck": "/api/health",
    "sessionSticky": false,
    "instances": 3,
    "description": "Why this load balancing"
  },
  "estimatedRPSCapacity": 5000,
  "scalingTriggers": ["CPU > 70%", "Memory > 80%", "Queue depth > 1000"]
}`;
        const fallback = {
            systemDescription,
            cachingStrategy: {
                type: "Redis",
                ttlSeconds: 300,
                keys: ["user:{id}", "session:{token}", "list:{query_hash}"],
                invalidation: "write-through on create/update, TTL-based expiry",
                implementation: "ioredis with cache-aside pattern in service layer",
                estimatedHitRate: 0.80,
            },
            queueDesign: {
                technology: "Redis + BullMQ",
                queues: [
                    { name: "emails", priority: 1, description: "Transactional emails (welcome, reset)" },
                    { name: "jobs", priority: 2, description: "Background processing tasks" },
                    { name: "webhooks", priority: 3, description: "Outbound webhook delivery with retry" },
                ],
                workers: 4,
                retries: 3,
                dlq: true,
                description: "BullMQ on Redis provides reliable priority queues with DLQ, retry, and monitoring via Bull Board",
            },
            loadBalancing: {
                algorithm: "Least Connections",
                healthCheck: "/api/health",
                sessionSticky: false,
                instances: 3,
                description: "nginx upstream with least_conn, passive health checks, 10s timeout",
            },
            estimatedRPSCapacity: 3000,
            scalingTriggers: [
                "CPU > 70% for 2min — scale out +1 instance",
                "Memory > 80%      — alert + scale out",
                "Queue depth > 500  — add worker instance",
                "p95 latency > 500ms — scale out immediately",
            ],
            generatedAt: new Date().toISOString(),
        };
        const result = await (0, router_1.llmCallJSON)(prompt, systemPrompt, { ...fallback });
        return {
            systemDescription,
            ...result,
            generatedAt: new Date().toISOString(),
        };
    }
}
exports.ScalabilityPlanner = ScalabilityPlanner;
exports.scalabilityPlanner = new ScalabilityPlanner();
