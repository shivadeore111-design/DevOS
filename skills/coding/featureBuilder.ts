// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// skills/coding/featureBuilder.ts
// Generates full feature implementations from a description.
// Writes code files directly to the project directory.
// ============================================================

import fs   from "fs";
import path from "path";
import { llmCall }  from "../../llm/router";
import { Skill }    from "../registry";

// ── Return types ──────────────────────────────────────────────

export interface GeneratedFile {
  relativePath: string;
  content:      string;
  language:     string;
}

export interface BuildResult {
  feature:      string;
  projectDir:   string;
  filesWritten: string[];
  summary:      string;
  success:      boolean;
  error?:       string;
}

// ── Skill ─────────────────────────────────────────────────────

export class FeatureBuilder implements Skill {
  readonly name        = "feature_builder";
  readonly description = "Generates and writes full feature implementations (auth, payments, dashboards, REST endpoints) into a project directory";

  async execute(args: { feature: string; projectDir: string; context?: string }): Promise<BuildResult> {
    return this.build(args.feature, args.projectDir, args.context);
  }

  async build(feature: string, projectDir: string, context?: string): Promise<BuildResult> {
    const contextSection = context
      ? `\n\nProject context:\n${context}`
      : "";

    const systemPrompt = `You are an expert software engineer. Generate complete, production-ready feature implementations.
Return a JSON array of files. Each file must have: relativePath (string), content (full file content), language (string).
Return ONLY the JSON array — no markdown, no explanation.`;

    const prompt = `Generate a complete implementation for: "${feature}"
Project directory: ${projectDir}${contextSection}

Examples of features: auth system (JWT + bcrypt), Stripe payment integration, admin dashboard, CRUD REST endpoints, websocket chat.

Return a JSON ARRAY of file objects:
[
  {
    "relativePath": "src/auth/authService.ts",
    "content": "import ...",
    "language": "typescript"
  },
  {
    "relativePath": "src/auth/authRouter.ts",
    "content": "import ...",
    "language": "typescript"
  }
]

Generate 2-6 files. Be thorough — include types, error handling, logging.`;

    const filesWritten: string[] = [];

    try {
      const { content } = await llmCall(prompt, systemPrompt);

      const generated = this.extractFilesArray(content);

      if (generated.length === 0) {
        // fallback: write a single stub file
        const stubPath = path.join(projectDir, "src", "features", `${feature.replace(/\s+/g, "_").toLowerCase()}.ts`);
        fs.mkdirSync(path.dirname(stubPath), { recursive: true });
        fs.writeFileSync(stubPath, `// ${feature}\n// TODO: implement\nexport {};\n`, "utf-8");
        filesWritten.push(stubPath);
        return {
          feature, projectDir, filesWritten,
          summary: `Stub created for "${feature}" — LLM output could not be parsed`,
          success: true,
        };
      }

      for (const file of generated) {
        const fullPath = path.isAbsolute(file.relativePath)
          ? file.relativePath
          : path.join(projectDir, file.relativePath);

        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, file.content, "utf-8");
        filesWritten.push(file.relativePath);
        console.log(`[FeatureBuilder] ✅ Wrote: ${file.relativePath}`);
      }

      return {
        feature, projectDir, filesWritten,
        summary: `Successfully implemented "${feature}" in ${filesWritten.length} file(s)`,
        success: true,
      };

    } catch (err: any) {
      return {
        feature, projectDir, filesWritten,
        summary: `Failed: ${err.message}`,
        success: false,
        error:   err.message,
      };
    }
  }

  private extractFilesArray(text: string): GeneratedFile[] {
    try {
      // Try matching a JSON array
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (f: any) => typeof f.relativePath === "string" && typeof f.content === "string"
      ) as GeneratedFile[];
    } catch {
      return [];
    }
  }
}

export const featureBuilder = new FeatureBuilder();
