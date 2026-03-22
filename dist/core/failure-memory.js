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
exports.FailureMemory = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class FailureMemory {
    constructor(workspace) {
        this.memoryPath = path_1.default.join(workspace, "failureMemory.json");
        if (!fs_1.default.existsSync(this.memoryPath)) {
            fs_1.default.writeFileSync(this.memoryPath, JSON.stringify({}, null, 2));
        }
        this.memory = JSON.parse(fs_1.default.readFileSync(this.memoryPath, "utf-8"));
    }
    recordFailure(command, reason) {
        const key = command.trim();
        if (!this.memory[key]) {
            this.memory[key] = {
                command: key,
                reason,
                attempts: 1,
                lastFailure: new Date().toISOString(),
            };
        }
        else {
            this.memory[key].attempts += 1;
            this.memory[key].lastFailure = new Date().toISOString();
            this.memory[key].reason = reason;
        }
        this.save();
    }
    getFailure(command) {
        return this.memory[command.trim()] || null;
    }
    shouldBlockRetry(command, threshold = 2) {
        const record = this.getFailure(command);
        if (!record)
            return false;
        return record.attempts >= threshold;
    }
    save() {
        fs_1.default.writeFileSync(this.memoryPath, JSON.stringify(this.memory, null, 2));
    }
}
exports.FailureMemory = FailureMemory;
