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
exports.recordError = recordError;
exports.recordSuccessfulFix = recordSuccessfulFix;
// core/memory.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const memoryPath = path_1.default.join(process.cwd(), "workspace", "sandbox", "projectMemory.json");
const defaultMemory = {
    schemaVersion: 2,
    projectName: "",
    lastDeploymentUrl: "",
    lastDeploymentTime: "",
    lastGitCommit: "",
    lastError: "",
    lastFailureStage: "",
    retryState: {
        retryCount: 0,
        maxRetries: 3
    },
    errorHistory: [],
    successfulFixes: [],
    deploymentHistory: []
};
function ensureMemoryFile() {
    if (!fs_1.default.existsSync(memoryPath)) {
        fs_1.default.mkdirSync(path_1.default.dirname(memoryPath), { recursive: true });
        fs_1.default.writeFileSync(memoryPath, JSON.stringify(defaultMemory, null, 2));
    }
}
function loadMemory() {
    ensureMemoryFile();
    const raw = fs_1.default.readFileSync(memoryPath, "utf-8");
    const parsed = JSON.parse(raw);
    // Auto-upgrade older schema
    if (!parsed.schemaVersion || parsed.schemaVersion < 2) {
        const upgraded = { ...defaultMemory, ...parsed, schemaVersion: 2 };
        saveMemory(upgraded);
        return upgraded;
    }
    return parsed;
}
function saveMemory(memory) {
    fs_1.default.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
}
function generateErrorSignature(message) {
    return crypto_1.default.createHash("md5").update(message).digest("hex");
}
function recordError(stage, message) {
    const memory = loadMemory();
    const signature = generateErrorSignature(message);
    const now = new Date().toISOString();
    let existing = memory.errorHistory.find((e) => e.errorSignature === signature);
    if (existing) {
        existing.lastSeen = now;
        existing.occurrences += 1;
    }
    else {
        memory.errorHistory.push({
            id: crypto_1.default.randomUUID(),
            stage,
            errorSignature: signature,
            errorMessage: message,
            firstSeen: now,
            lastSeen: now,
            occurrences: 1,
            resolved: false
        });
    }
    memory.lastError = message;
    memory.lastFailureStage = stage;
    memory.retryState.retryCount += 1;
    saveMemory(memory);
}
function recordSuccessfulFix(signature, fix) {
    const memory = loadMemory();
    const now = new Date().toISOString();
    memory.successfulFixes.push({
        errorSignature: signature,
        fixApplied: fix,
        resolvedAt: now
    });
    const error = memory.errorHistory.find((e) => e.errorSignature === signature);
    if (error) {
        error.resolved = true;
    }
    memory.retryState.retryCount = 0;
    memory.lastError = "";
    memory.lastFailureStage = "";
    saveMemory(memory);
}
