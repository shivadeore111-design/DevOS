"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseDesigner = exports.DatabaseDesigner = void 0;
// ============================================================
// skills/architecture/databaseDesigner.ts
// Designs relational and NoSQL schemas with migration SQL.
// ============================================================
const router_1 = require("../../llm/router");
// ── Skill ─────────────────────────────────────────────────────
class DatabaseDesigner {
    constructor() {
        this.name = "database_designer";
        this.description = "Designs complete database schemas with tables, indexes, relations, and migration SQL";
    }
    async execute(args) {
        return this.design(args.requirements);
    }
    async design(requirements) {
        const systemPrompt = `You are a senior database architect. Design normalized, production-ready schemas.
Follow best practices: uuid primary keys, audit timestamps, proper indexing, referential integrity.
Return ONLY valid JSON — no markdown, no commentary.`;
        const prompt = `Design a complete database schema for: "${requirements}"

Return JSON matching this schema:
{
  "name": "schema name",
  "engine": "postgres",
  "tables": [
    {
      "name": "users",
      "description": "User accounts",
      "columns": [
        { "name": "id", "type": "UUID", "nullable": false, "defaultValue": "gen_random_uuid()", "constraints": ["PRIMARY KEY"] },
        { "name": "email", "type": "VARCHAR(255)", "nullable": false, "constraints": ["UNIQUE", "NOT NULL"] },
        { "name": "created_at", "type": "TIMESTAMPTZ", "nullable": false, "defaultValue": "NOW()", "constraints": ["NOT NULL"] }
      ]
    }
  ],
  "indexes": [
    { "name": "idx_users_email", "table": "users", "columns": ["email"], "unique": true }
  ],
  "relations": [
    { "from": "posts.user_id", "to": "users.id", "type": "many-to-one", "cascade": "CASCADE" }
  ],
  "migrationSQL": "CREATE EXTENSION IF NOT EXISTS pgcrypto;\\nCREATE TABLE users (...);"
}`;
        const fallback = {
            name: requirements.slice(0, 40),
            engine: "postgres",
            tables: [
                {
                    name: "users",
                    description: "User accounts",
                    columns: [
                        { name: "id", type: "UUID", nullable: false, defaultValue: "gen_random_uuid()", constraints: ["PRIMARY KEY"] },
                        { name: "email", type: "VARCHAR(255)", nullable: false, constraints: ["UNIQUE", "NOT NULL"] },
                        { name: "name", type: "VARCHAR(255)", nullable: false, constraints: ["NOT NULL"] },
                        { name: "created_at", type: "TIMESTAMPTZ", nullable: false, defaultValue: "NOW()", constraints: ["NOT NULL"] },
                        { name: "updated_at", type: "TIMESTAMPTZ", nullable: false, defaultValue: "NOW()", constraints: ["NOT NULL"] },
                    ],
                },
                {
                    name: "sessions",
                    description: "Auth sessions",
                    columns: [
                        { name: "id", type: "UUID", nullable: false, defaultValue: "gen_random_uuid()", constraints: ["PRIMARY KEY"] },
                        { name: "user_id", type: "UUID", nullable: false, constraints: ["NOT NULL", "REFERENCES users(id) ON DELETE CASCADE"] },
                        { name: "token", type: "VARCHAR(512)", nullable: false, constraints: ["UNIQUE", "NOT NULL"] },
                        { name: "expires_at", type: "TIMESTAMPTZ", nullable: false, constraints: ["NOT NULL"] },
                    ],
                },
            ],
            indexes: [
                { name: "idx_users_email", table: "users", columns: ["email"], unique: true },
                { name: "idx_sessions_token", table: "sessions", columns: ["token"], unique: true },
                { name: "idx_sessions_user_id", table: "sessions", columns: ["user_id"], unique: false },
            ],
            relations: [
                { from: "sessions.user_id", to: "users.id", type: "many-to-many", cascade: "CASCADE" },
            ],
            migrationSQL: [
                "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
                "CREATE TABLE users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
                "CREATE TABLE sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, token VARCHAR(512) UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL);",
                "CREATE INDEX idx_users_email ON users(email);",
                "CREATE INDEX idx_sessions_token ON sessions(token);",
                "CREATE INDEX idx_sessions_user_id ON sessions(user_id);",
            ].join("\n"),
            generatedAt: new Date().toISOString(),
        };
        const result = await (0, router_1.llmCallJSON)(prompt, systemPrompt, fallback);
        return { ...result, generatedAt: new Date().toISOString() };
    }
}
exports.DatabaseDesigner = DatabaseDesigner;
exports.databaseDesigner = new DatabaseDesigner();
