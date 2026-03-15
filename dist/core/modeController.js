"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModeController = void 0;
const modeMatrix = {
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
class ModeController {
    constructor(initialMode = "task") {
        this.currentMode = initialMode;
    }
    setMode(mode) {
        console.log(`\n🧠 Switching DevOS mode → ${mode.toUpperCase()}`);
        this.currentMode = mode;
    }
    getMode() {
        return this.currentMode;
    }
    getConfig() {
        return modeMatrix[this.currentMode];
    }
    isResearchAllowed() {
        return this.getConfig().allowResearch;
    }
    isDeterministicExecution() {
        return this.getConfig().deterministicExecution;
    }
}
exports.ModeController = ModeController;
