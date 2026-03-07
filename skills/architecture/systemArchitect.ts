// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// skills/architecture/systemArchitect.ts
// Designs complete system architectures from a plain-English goal.
// Uses qwen2.5-coder:14b for richer technical depth.
// ============================================================

import { callOllama }      from "../../llm/ollama";
import { ensureOllamaReady } from "../../llm/router";
import { Skill }           from "../registry";

// ── Return types ──────────────────────────────────────────────

export interface ServiceSpec {
  name:        string;
  description: string;
  tech:        string;
  port?:       number;
  scalable:    boolean;
}

export interface DatabaseDesign {
  type:        string;   // postgres, mongodb, redis, etc.
  tables:      string[];
  description: string;
}

export interface APIStructure {
  pattern:        string;   // REST, GraphQL, gRPC, etc.
  endpoints:      string[];
  authentication: string;
  versioning:     string;
}

export interface DeploymentPlan {
  platform:        string;   // Railway, Vercel, AWS, Oracle Cloud, etc.
  containerized:   boolean;
  cicd:            string;
  steps:           string[];
  estimatedCostUSD: number;
}

export interface SystemArchitecture {
  goal:           string;
  services:       ServiceSpec[];
  databaseDesign: DatabaseDesign;
  apiStructure:   APIStructure;
  deploymentPlan: DeploymentPlan;
  rationale:      string;
  generatedAt:    string;
}

// ── Skill ─────────────────────────────────────────────────────

export class SystemArchitect implements Skill {
  readonly name        = "system_architect";
  readonly description = "Designs complete system architectures from a plain-English goal";

  private readonly MODEL = "qwen2.5-coder:14b";

  async execute(args: { goal: string }): Promise<SystemArchitecture> {
    return this.design(args.goal);
  }

  async design(goal: string): Promise<SystemArchitecture> {
    await ensureOllamaReady();

    const system = `You are a senior software architect at a top tech company.
Design production-grade system architectures. Be specific about technologies, ports, and trade-offs.
Return ONLY valid JSON — no markdown fences, no extra text.`;

    const prompt = `Design a complete system architecture for: "${goal}"

Return JSON matching this schema exactly:
{
  "services": [
    { "name": "string", "description": "string", "tech": "string", "port": 3000, "scalable": true }
  ],
  "databaseDesign": {
    "type": "postgres|mongodb|redis|...",
    "tables": ["table1", "table2"],
    "description": "string"
  },
  "apiStructure": {
    "pattern": "REST|GraphQL|gRPC",
    "endpoints": ["/api/v1/resource GET", "/api/v1/resource POST"],
    "authentication": "JWT|OAuth2|API Key",
    "versioning": "URL path|header"
  },
  "deploymentPlan": {
    "platform": "Railway|Vercel|AWS|Oracle Cloud",
    "containerized": true,
    "cicd": "GitHub Actions|CircleCI",
    "steps": ["step1", "step2"],
    "estimatedCostUSD": 50
  },
  "rationale": "Why these choices were made"
}`;

    const raw      = await callOllama(prompt, system, this.MODEL);
    const parsed   = this.extractJSON<Omit<SystemArchitecture, "goal" | "generatedAt">>(raw);
    const fallback = this.buildFallback(goal);

    return {
      goal,
      services:       parsed?.services       ?? fallback.services,
      databaseDesign: parsed?.databaseDesign ?? fallback.databaseDesign,
      apiStructure:   parsed?.apiStructure   ?? fallback.apiStructure,
      deploymentPlan: parsed?.deploymentPlan ?? fallback.deploymentPlan,
      rationale:      parsed?.rationale      ?? "Generated with fallback defaults.",
      generatedAt:    new Date().toISOString(),
    };
  }

  private extractJSON<T>(text: string): T | null {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? (JSON.parse(match[0]) as T) : null;
    } catch { return null; }
  }

  private buildFallback(goal: string): Omit<SystemArchitecture, "goal" | "generatedAt" | "rationale"> {
    return {
      services: [
        { name: "api-server",  description: "Main REST API",   tech: "Node.js/Express", port: 3000, scalable: true },
        { name: "web-client",  description: "Frontend SPA",    tech: "Next.js",         port: 3001, scalable: true },
        { name: "worker",      description: "Background jobs",  tech: "Node.js",         scalable: true },
      ],
      databaseDesign: {
        type:        "postgres",
        tables:      ["users", "sessions", "events"],
        description: `Primary relational store for ${goal}`,
      },
      apiStructure: {
        pattern:        "REST",
        endpoints:      ["GET /api/v1/health", "POST /api/v1/auth/login", "GET /api/v1/data"],
        authentication: "JWT",
        versioning:     "URL path",
      },
      deploymentPlan: {
        platform:         "Railway",
        containerized:    true,
        cicd:             "GitHub Actions",
        steps:            ["Build Docker images", "Run tests", "Deploy to Railway", "Health check"],
        estimatedCostUSD: 25,
      },
    };
  }
}

export const systemArchitect = new SystemArchitect();
