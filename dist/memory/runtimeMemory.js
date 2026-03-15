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
exports.RuntimeMemory = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class RuntimeMemory {
    constructor() {
        this.filePath = path_1.default.join(process.cwd(), "memory", "runtime-memory.json");
        if (!fs_1.default.existsSync(this.filePath)) {
            fs_1.default.writeFileSync(this.filePath, JSON.stringify({ badCommands: [], timeouts: [], blocked: [] }, null, 2));
        }
        this.data = JSON.parse(fs_1.default.readFileSync(this.filePath, "utf-8"));
    }
    save() {
        fs_1.default.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    }
    recordTimeout(command) {
        if (!this.data.timeouts.includes(command)) {
            this.data.timeouts.push(command);
            this.save();
            console.log("🧠 Learned timeout pattern.");
        }
    }
    recordBadCommand(command) {
        if (!this.data.badCommands.includes(command)) {
            this.data.badCommands.push(command);
            this.save();
            console.log("🧠 Learned bad command.");
        }
    }
    recordBlocked(command) {
        if (!this.data.blocked.includes(command)) {
            this.data.blocked.push(command);
            this.save();
            console.log("🧠 Learned blocked command.");
        }
    }
    isKnownBad(command) {
        return (this.data.badCommands.includes(command) ||
            this.data.timeouts.includes(command) ||
            this.data.blocked.includes(command));
    }
}
exports.RuntimeMemory = RuntimeMemory;
