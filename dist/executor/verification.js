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
exports.VerificationLayer = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class VerificationLayer {
    async verify(result) {
        if (!result.success) {
            return {
                passed: false,
                reason: result.error || "Action returned failure"
            };
        }
        if (result.artifacts?.length) {
            for (const file of result.artifacts) {
                const fullPath = path_1.default.resolve(file);
                if (!fs_1.default.existsSync(fullPath)) {
                    return {
                        passed: false,
                        reason: `Missing artifact: ${file}`
                    };
                }
            }
        }
        return { passed: true };
    }
}
exports.VerificationLayer = VerificationLayer;
