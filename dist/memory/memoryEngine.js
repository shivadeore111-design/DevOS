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
exports.appendMemory = appendMemory;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const memoryPath = path_1.default.join(__dirname, "researchMemory.json");
function loadMemory() {
    if (!fs_1.default.existsSync(memoryPath)) {
        return {
            topicsResearched: [],
            insights: [],
            improvements: [],
            failures: []
        };
    }
    const raw = fs_1.default.readFileSync(memoryPath, "utf-8");
    return JSON.parse(raw);
}
function saveMemory(data) {
    fs_1.default.writeFileSync(memoryPath, JSON.stringify(data, null, 2));
}
function appendMemory(section, entry) {
    const memory = loadMemory();
    if (!memory[section]) {
        memory[section] = [];
    }
    memory[section].push({
        timestamp: new Date().toISOString(),
        data: entry
    });
    saveMemory(memory);
}
