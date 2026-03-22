"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadMemory = loadMemory;
exports.saveMemory = saveMemory;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const registry_1 = require("../core/registry");
function getMemoryPath() {
    const active = (0, registry_1.getActiveProject)();
    if (!active)
        throw new Error("No active project.");
    return path_1.default.join(__dirname, "..", "projects", active, "memory.json");
}
function loadMemory() {
    const memoryPath = getMemoryPath();
    if (!fs_1.default.existsSync(memoryPath)) {
        const initial = {
            techStack: [],
            recentTasks: [],
            knownIssues: [],
            decisions: [],
            deploymentTargets: []
        };
        fs_1.default.mkdirSync(path_1.default.dirname(memoryPath), { recursive: true });
        fs_1.default.writeFileSync(memoryPath, JSON.stringify(initial, null, 2));
        return initial;
    }
    return JSON.parse(fs_1.default.readFileSync(memoryPath, "utf-8"));
}
function saveMemory(memory) {
    const memoryPath = getMemoryPath();
    fs_1.default.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
}
