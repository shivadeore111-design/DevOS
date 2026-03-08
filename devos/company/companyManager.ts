// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// devos/company/companyManager.ts — Company Mode Orchestrator
// Coordinates all 6 department agents toward a shared objective
// ============================================================

import { ProjectStore, ProjectContext } from "./projectContext";
import { TaskAllocator }               from "./taskAllocator";
import { eventBus }                    from "../../dashboard/events";
import { AgentCoordinator }            from "../../agents/agentCoordinator_v2";

// ── CompanyManager ────────────────────────────────────────────

export class CompanyManager {
  private ollamaUrl: string;
  private store:     ProjectStore;
  private allocator: TaskAllocator;

  constructor(ollamaBaseUrl = "http://localhost:11434") {
    this.ollamaUrl = ollamaBaseUrl;
    this.store     = new ProjectStore();
    this.allocator = new TaskAllocator(ollamaBaseUrl);
  }

  /**
   * Kick off a company-mode run for the given objective.
   * Returns the created project ID immediately; agents run in background.
   */
  async run(objective: string): Promise<string> {
    // 1. Create project
    const project = this.store.create(`Company: ${objective.slice(0, 60)}`, objective);
    const projectId = project.id;

    // 2. Emit company_started
    eventBus.emit({
      type:      "company_started",
      payload:   { projectId, objective },
      timestamp: new Date().toISOString(),
    });

    // 3. Plan in background (non-blocking)
    this._executeCompany(projectId, objective).catch(err => {
      console.error(`[CompanyManager] Run failed for ${projectId}: ${err.message}`);
      this.store.update(projectId, { status: "paused" });
      eventBus.emit({
        type:      "company_failed",
        payload:   { projectId, error: err.message },
        timestamp: new Date().toISOString(),
      });
    });

    return projectId;
  }

  private async _executeCompany(projectId: string, objective: string): Promise<void> {
    // 2. Allocate tasks per department
    const plan = await this.allocator.allocate(objective);

    eventBus.emit({
      type:      "company_plan_created",
      payload:   { projectId, departments: plan.departments.map(d => d.role) },
      timestamp: new Date().toISOString(),
    });

    this.store.update(projectId, { status: "active" });

    // 3. Execute each department task sequentially respecting dependsOn
    const completed = new Set<string>();
    const tasks     = [...plan.departments];
    const maxPasses = tasks.length * 2;
    let passes      = 0;

    while (tasks.length > 0 && passes < maxPasses) {
      passes++;
      for (let i = tasks.length - 1; i >= 0; i--) {
        const dept = tasks[i];
        const depsReady = dept.dependsOn.every(dep => completed.has(dep));
        if (!depsReady) continue;

        tasks.splice(i, 1);

        // Mark agent as running
        this.store.updateAgent(projectId, dept.role, {
          status:      "running",
          currentTask: dept.task,
        });

        eventBus.emit({
          type:      "agent_task_started",
          payload:   { projectId, role: dept.role, task: dept.task },
          timestamp: new Date().toISOString(),
        });

        try {
          // 4. Spawn via agentCoordinator_v2
          const agentResult = await AgentCoordinator.spawnAgent(
            dept.role as any,
            dept.task,
            { projectId, objective, subtasks: dept.subtasks }
          );

          const output = agentResult?.result ?? agentResult ?? "";

          this.store.updateAgent(projectId, dept.role, {
            status:         "completed",
            currentTask:    undefined,
            completedTasks: [dept.task],
            output:         typeof output === "string" ? output : JSON.stringify(output),
          });

          completed.add(dept.role);

          eventBus.emit({
            type:      "agent_task_completed",
            payload:   { projectId, role: dept.role, output: String(output).slice(0, 500) },
            timestamp: new Date().toISOString(),
          });
        } catch (err: any) {
          this.store.updateAgent(projectId, dept.role, {
            status:      "failed",
            currentTask: undefined,
            output:      `Error: ${err.message}`,
          });

          // Mark as completed so dependents aren't blocked forever
          completed.add(dept.role);

          eventBus.emit({
            type:      "agent_task_completed",
            payload:   { projectId, role: dept.role, error: err.message },
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // 5. Mark project complete
    this.store.update(projectId, { status: "completed" });

    eventBus.emit({
      type:      "company_completed",
      payload:   { projectId, objective },
      timestamp: new Date().toISOString(),
    });
  }

  getStatus(projectId: string): ProjectContext {
    const project = this.store.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    return project;
  }
}

// ── Singleton ─────────────────────────────────────────────────

export const companyManager = new CompanyManager();
