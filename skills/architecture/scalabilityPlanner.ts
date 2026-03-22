// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// skills/architecture/scalabilityPlanner.ts
// Plans caching, queueing, and load balancing strategies.
// ============================================================

import { llmCallJSON } from "../../llm/router";
import { Skill }       from "../registry";

// ── Return types ──────────────────────────────────────────────

export interface CachingStrategy {
  type:           string;   // Redis, Memcached, CDN, in-memory
  ttlSeconds:     number;
  keys:           string[];
  invalidation:   string;
  implementation: string;
  estimatedHitRate: number; // 0-1
}

export interface QueueDesign {
  technology:  string;   // Redis/BullMQ, RabbitMQ, AWS SQS, etc.
  queues:      Array<{ name: string; priority: number; description: string }>;
  workers:     number;
  retries:     number;
  dlq:         boolean;
  description: string;
}

export interface LoadBalancingConfig {
  algorithm:    string;   // Round Robin, Least Connections, IP Hash
  healthCheck:  string;   // /health endpoint path
  sessionSticky: boolean;
  instances:    number;
  description:  string;
}

export interface ScalingPlan {
  systemDescription: string;
  cachingStrategy:   CachingStrategy;
  queueDesign:       QueueDesign;
  loadBalancing:     LoadBalancingConfig;
  estimatedRPSCapacity: number;
  scalingTriggers:   string[];
  generatedAt:       string;
}

// ── Skill ─────────────────────────────────────────────────────

export class ScalabilityPlanner implements Skill {
  readonly name        = "scalability_planner";
  readonly description = "Plans caching strategy, queue design, and load balancing for any system";

  async execute(args: { systemDescription: string }): Promise<ScalingPlan> {
    return this.plan(args.systemDescription);
  }

  async plan(systemDescription: string): Promise<ScalingPlan> {
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

    const fallback: ScalingPlan = {
      systemDescription,
      cachingStrategy: {
        type:             "Redis",
        ttlSeconds:       300,
        keys:             ["user:{id}", "session:{token}", "list:{query_hash}"],
        invalidation:     "write-through on create/update, TTL-based expiry",
        implementation:   "ioredis with cache-aside pattern in service layer",
        estimatedHitRate: 0.80,
      },
      queueDesign: {
        technology:  "Redis + BullMQ",
        queues: [
          { name: "emails",       priority: 1, description: "Transactional emails (welcome, reset)" },
          { name: "jobs",         priority: 2, description: "Background processing tasks" },
          { name: "webhooks",     priority: 3, description: "Outbound webhook delivery with retry" },
        ],
        workers:     4,
        retries:     3,
        dlq:         true,
        description: "BullMQ on Redis provides reliable priority queues with DLQ, retry, and monitoring via Bull Board",
      },
      loadBalancing: {
        algorithm:     "Least Connections",
        healthCheck:   "/api/health",
        sessionSticky: false,
        instances:     3,
        description:   "nginx upstream with least_conn, passive health checks, 10s timeout",
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

    const result = await llmCallJSON<Omit<ScalingPlan, "systemDescription" | "generatedAt">>(
      prompt, systemPrompt,
      { ...fallback }
    );

    return {
      systemDescription,
      ...result,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const scalabilityPlanner = new ScalabilityPlanner();
