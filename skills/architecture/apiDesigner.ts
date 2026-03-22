// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// skills/architecture/apiDesigner.ts
// Designs RESTful/GraphQL APIs from a plain-English description.
// ============================================================

import { llmCallJSON }  from "../../llm/router";
import { Skill }        from "../registry";

// ── Return types ──────────────────────────────────────────────

export interface EndpointSpec {
  method:      "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path:        string;
  description: string;
  auth:        boolean;
  requestBody?: Record<string, string>;
  response:    Record<string, string>;
}

export interface SchemaField {
  type:     string;
  required: boolean;
  example?: string;
}

export interface ValidationRule {
  field:  string;
  rules:  string[];
}

export interface APIDesign {
  name:            string;
  description:     string;
  baseUrl:         string;
  version:         string;
  endpoints:       EndpointSpec[];
  schemas:         Record<string, Record<string, SchemaField>>;
  validationRules: ValidationRule[];
  generatedAt:     string;
}

// ── Skill ─────────────────────────────────────────────────────

export class APIDesigner implements Skill {
  readonly name        = "api_designer";
  readonly description = "Designs complete REST/GraphQL APIs with endpoints, schemas, and validation rules";

  async execute(args: { description: string }): Promise<APIDesign> {
    return this.design(args.description);
  }

  async design(description: string): Promise<APIDesign> {
    const systemPrompt = `You are an expert API designer following REST best practices.
Design clean, versioned APIs with proper HTTP methods, status codes, and validation.
Return ONLY valid JSON — no markdown, no commentary.`;

    const prompt = `Design a complete REST API for: "${description}"

Return this JSON schema:
{
  "name": "API name",
  "description": "What this API does",
  "baseUrl": "/api/v1",
  "version": "1.0.0",
  "endpoints": [
    {
      "method": "GET|POST|PUT|PATCH|DELETE",
      "path": "/resource",
      "description": "What it does",
      "auth": true,
      "requestBody": { "field": "type" },
      "response": { "field": "type" }
    }
  ],
  "schemas": {
    "ModelName": { "id": { "type": "uuid", "required": true }, "name": { "type": "string", "required": true } }
  },
  "validationRules": [
    { "field": "email", "rules": ["required", "email format", "max 255 chars"] }
  ]
}`;

    const fallback: APIDesign = {
      name:        description.slice(0, 50),
      description,
      baseUrl:     "/api/v1",
      version:     "1.0.0",
      endpoints:   [
        { method: "GET",    path: "/health",        description: "Health check",   auth: false, response: { status: "string" } },
        { method: "POST",   path: "/auth/login",    description: "Authenticate",   auth: false, requestBody: { email: "string", password: "string" }, response: { token: "string" } },
        { method: "GET",    path: "/resource",      description: "List resources", auth: true,  response: { items: "array", total: "number" } },
        { method: "POST",   path: "/resource",      description: "Create resource",auth: true,  requestBody: { name: "string" }, response: { id: "uuid" } },
        { method: "DELETE", path: "/resource/:id",  description: "Delete resource",auth: true,  response: { success: "boolean" } },
      ],
      schemas: {
        Resource: {
          id:        { type: "uuid",     required: true },
          name:      { type: "string",   required: true },
          createdAt: { type: "datetime", required: true },
        },
      },
      validationRules: [
        { field: "email",    rules: ["required", "email format", "max 255 chars"] },
        { field: "password", rules: ["required", "min 8 chars", "at least 1 number"] },
        { field: "name",     rules: ["required", "min 1 char", "max 100 chars"] },
      ],
      generatedAt: new Date().toISOString(),
    };

    const result = await llmCallJSON<Omit<APIDesign, "generatedAt">>(prompt, systemPrompt, fallback);
    return { ...result, generatedAt: new Date().toISOString() } as APIDesign;
  }
}

export const apiDesigner = new APIDesigner();
