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
exports.getRegistry = getRegistry;
exports.setActiveProject = setActiveProject;
exports.getActiveProject = getActiveProject;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const REGISTRY_PATH = path_1.default.join(__dirname, "..", "projects", "registry.json");
function ensureRegistry() {
    if (!fs_1.default.existsSync(REGISTRY_PATH)) {
        const initial = {
            activeProject: null,
            projects: []
        };
        fs_1.default.mkdirSync(path_1.default.dirname(REGISTRY_PATH), { recursive: true });
        fs_1.default.writeFileSync(REGISTRY_PATH, JSON.stringify(initial, null, 2));
        return initial;
    }
    return JSON.parse(fs_1.default.readFileSync(REGISTRY_PATH, "utf-8"));
}
function getRegistry() {
    return ensureRegistry();
}
function setActiveProject(name) {
    const registry = ensureRegistry();
    if (!registry.projects.includes(name)) {
        registry.projects.push(name);
    }
    registry.activeProject = name;
    fs_1.default.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}
function getActiveProject() {
    const registry = ensureRegistry();
    return registry.activeProject;
}
