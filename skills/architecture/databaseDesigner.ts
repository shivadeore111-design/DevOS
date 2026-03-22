// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// skills/architecture/databaseDesigner.ts
// Designs relational and NoSQL schemas with migration SQL.
// ============================================================

import { llmCallJSON } from "../../llm/router";
import { Skill }       from "../registry";

// ── Return types ──────────────────────────────────────────────

export interface ColumnSpec {
  name:        string;
  type:        string;   // VARCHAR(255), BIGINT, BOOLEAN, JSONB, etc.
  nullable:    boolean;
  defaultValue?: string;
  constraints: string[]; // PRIMARY KEY, UNIQUE, NOT NULL, REFERENCES ...
}

export interface TableSpec {
  name:        string;
  description: string;
  columns:     ColumnSpec[];
}

export interface IndexSpec {
  name:    string;
  table:   string;
  columns: string[];
  unique:  boolean;
  partial?: string;  // WHERE clause for partial indexes
}

export interface RelationSpec {
  from:      string;   // "table.column"
  to:        string;   // "table.column"
  type:      "one-to-one" | "one-to-many" | "many-to-many";
  cascade:   string;   // "CASCADE", "SET NULL", "RESTRICT"
}

export interface DatabaseSchema {
  name:         string;
  engine:       string;   // postgres, mysql, sqlite, mongodb
  tables:       TableSpec[];
  indexes:      IndexSpec[];
  relations:    RelationSpec[];
  migrationSQL: string;
  generatedAt:  string;
}

// ── Skill ─────────────────────────────────────────────────────

export class DatabaseDesigner implements Skill {
  readonly name        = "database_designer";
  readonly description = "Designs complete database schemas with tables, indexes, relations, and migration SQL";

  async execute(args: { requirements: string }): Promise<DatabaseSchema> {
    return this.design(args.requirements);
  }

  async design(requirements: string): Promise<DatabaseSchema> {
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

    const fallback: DatabaseSchema = {
      name:    requirements.slice(0, 40),
      engine:  "postgres",
      tables: [
        {
          name:        "users",
          description: "User accounts",
          columns: [
            { name: "id",         type: "UUID",         nullable: false, defaultValue: "gen_random_uuid()", constraints: ["PRIMARY KEY"] },
            { name: "email",      type: "VARCHAR(255)", nullable: false, constraints: ["UNIQUE", "NOT NULL"] },
            { name: "name",       type: "VARCHAR(255)", nullable: false, constraints: ["NOT NULL"] },
            { name: "created_at", type: "TIMESTAMPTZ",  nullable: false, defaultValue: "NOW()", constraints: ["NOT NULL"] },
            { name: "updated_at", type: "TIMESTAMPTZ",  nullable: false, defaultValue: "NOW()", constraints: ["NOT NULL"] },
          ],
        },
        {
          name:        "sessions",
          description: "Auth sessions",
          columns: [
            { name: "id",         type: "UUID",         nullable: false, defaultValue: "gen_random_uuid()", constraints: ["PRIMARY KEY"] },
            { name: "user_id",    type: "UUID",         nullable: false, constraints: ["NOT NULL", "REFERENCES users(id) ON DELETE CASCADE"] },
            { name: "token",      type: "VARCHAR(512)", nullable: false, constraints: ["UNIQUE", "NOT NULL"] },
            { name: "expires_at", type: "TIMESTAMPTZ",  nullable: false, constraints: ["NOT NULL"] },
          ],
        },
      ],
      indexes: [
        { name: "idx_users_email",       table: "users",    columns: ["email"],      unique: true  },
        { name: "idx_sessions_token",    table: "sessions", columns: ["token"],      unique: true  },
        { name: "idx_sessions_user_id",  table: "sessions", columns: ["user_id"],    unique: false },
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

    const result = await llmCallJSON<Omit<DatabaseSchema, "generatedAt">>(prompt, systemPrompt, fallback);
    return { ...result, generatedAt: new Date().toISOString() } as DatabaseSchema;
  }
}

export const databaseDesigner = new DatabaseDesigner();
