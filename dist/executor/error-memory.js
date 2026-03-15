"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorMemory = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ErrorMemory {
    constructor(workspace) {
        this.memory = [];
        this.memoryPath = path.join(workspace, "error-memory.json");
        this.load();
    }
    load() {
        if (fs.existsSync(this.memoryPath)) {
            const raw = fs.readFileSync(this.memoryPath, "utf-8");
            this.memory = JSON.parse(raw);
        }
    }
    save() {
        fs.writeFileSync(this.memoryPath, JSON.stringify(this.memory, null, 2));
    }
    findFix(errorOutput) {
        for (const entry of this.memory) {
            if (errorOutput.includes(entry.errorPattern)) {
                return entry.fixAction;
            }
        }
        return null;
    }
    storeFix(errorOutput, fixAction) {
        const simplified = this.simplifyError(errorOutput);
        const existing = this.memory.find((e) => e.errorPattern === simplified);
        if (existing) {
            existing.successCount += 1;
        }
        else {
            this.memory.push({
                errorPattern: simplified,
                fixAction,
                successCount: 1
            });
        }
        this.save();
    }
    simplifyError(errorOutput) {
        return errorOutput
            .split("\n")[0]
            .trim()
            .slice(0, 200);
    }
}
exports.ErrorMemory = ErrorMemory;
