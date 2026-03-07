// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

export type DevOSMode = "research" | "build" | "task";

interface ModeConfig {
  allowResearch: boolean;
  allowKnowledgeWrite: boolean;
  allowSkillGeneration: boolean;
  deterministicExecution: boolean;
}

const modeMatrix: Record<DevOSMode, ModeConfig> = {
  research: {
    allowResearch: true,
    allowKnowledgeWrite: true,
    allowSkillGeneration: true,
    deterministicExecution: false
  },
  build: {
    allowResearch: false,
    allowKnowledgeWrite: false,
    allowSkillGeneration: false,
    deterministicExecution: true
  },
  task: {
    allowResearch: false,
    allowKnowledgeWrite: false,
    allowSkillGeneration: false,
    deterministicExecution: true
  }
};

export class ModeController {
  private currentMode: DevOSMode;

  constructor(initialMode: DevOSMode = "task") {
    this.currentMode = initialMode;
  }

  setMode(mode: DevOSMode) {
    console.log(`\n🧠 Switching DevOS mode → ${mode.toUpperCase()}`);
    this.currentMode = mode;
  }

  getMode(): DevOSMode {
    return this.currentMode;
  }

  getConfig(): ModeConfig {
    return modeMatrix[this.currentMode];
  }

  isResearchAllowed(): boolean {
    return this.getConfig().allowResearch;
  }

  isDeterministicExecution(): boolean {
    return this.getConfig().deterministicExecution;
  }
}