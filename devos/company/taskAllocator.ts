// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// devos/company/taskAllocator.ts — LLM-driven task allocation
// Breaks an objective into per-department tasks via Ollama
// ============================================================

import axios from "axios";

// ── Interfaces ────────────────────────────────────────────────

export interface DepartmentTask {
  role: string;
  title: string;
  task: string;
  subtasks: string[];
  dependsOn: string[];
  estimatedDuration: string;
}

export interface CompanyPlan {
  objective: string;
  departments: DepartmentTask[];
}

// ── TaskAllocator ─────────────────────────────────────────────

export class TaskAllocator {
  private ollamaUrl: string;

  constructor(ollamaBaseUrl = "http://localhost:11434") {
    this.ollamaUrl = ollamaBaseUrl;
  }

  async allocate(objective: string): Promise<CompanyPlan> {
    const prompt = `You are a company project planner. Given an objective, break it into tasks for 6 departments: strategy, research, product, engineering, qa, growth.

For each department, output a JSON array element with this exact structure:
{
  "role": "<strategy|research|product|engineering|qa|growth>",
  "title": "<short title>",
  "task": "<main task description>",
  "subtasks": ["<subtask1>", "<subtask2>", "<subtask3>"],
  "dependsOn": ["<role that must finish first, or empty>"],
  "estimatedDuration": "<e.g. 2 hours>"
}

Return ONLY valid JSON — a JSON object with key "departments" containing an array of exactly 6 department task objects.

Objective: ${objective}`;

    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model:  "mistral-nemo:12b",
          prompt,
          stream: false,
          options: { temperature: 0.3 },
        },
        { timeout: 120000 }
      );

      const raw = response.data?.response ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in LLM response");

      const parsed = JSON.parse(jsonMatch[0]);
      const departments: DepartmentTask[] = Array.isArray(parsed.departments)
        ? parsed.departments
        : this._fallbackPlan(objective);

      return { objective, departments };
    } catch (err: any) {
      console.warn(`[TaskAllocator] LLM allocation failed (${err.message}), using fallback plan.`);
      return { objective, departments: this._fallbackPlan(objective) };
    }
  }

  private _fallbackPlan(objective: string): DepartmentTask[] {
    return [
      {
        role: "strategy",
        title: "Define product scope and milestones",
        task: `Create a strategic plan for: ${objective}`,
        subtasks: ["Define scope", "Set milestones", "Prioritize features"],
        dependsOn: [],
        estimatedDuration: "2 hours",
      },
      {
        role: "research",
        title: "Market and technology research",
        task: `Research market and technologies for: ${objective}`,
        subtasks: ["Competitor analysis", "Technology stack research", "Market sizing"],
        dependsOn: ["strategy"],
        estimatedDuration: "3 hours",
      },
      {
        role: "product",
        title: "Product requirements and user stories",
        task: `Create PRD and user stories for: ${objective}`,
        subtasks: ["Write PRD", "Define user stories", "Set acceptance criteria"],
        dependsOn: ["strategy", "research"],
        estimatedDuration: "2 hours",
      },
      {
        role: "engineering",
        title: "Implement core features",
        task: `Implement the core features for: ${objective}`,
        subtasks: ["Scaffold project", "Implement features", "Write documentation"],
        dependsOn: ["product"],
        estimatedDuration: "8 hours",
      },
      {
        role: "qa",
        title: "Quality assurance and testing",
        task: `Write tests and verify features for: ${objective}`,
        subtasks: ["Write unit tests", "Integration testing", "Bug fixes"],
        dependsOn: ["engineering"],
        estimatedDuration: "3 hours",
      },
      {
        role: "growth",
        title: "Marketing and launch strategy",
        task: `Create growth strategy for: ${objective}`,
        subtasks: ["Launch plan", "SEO strategy", "User acquisition channels"],
        dependsOn: ["product"],
        estimatedDuration: "2 hours",
      },
    ];
  }
}
