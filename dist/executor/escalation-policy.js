"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscalationPolicy = void 0;
class EscalationPolicy {
    constructor(maxAttempts = 2) {
        this.state = {
            attempts: 0,
            maxAttempts
        };
    }
    /**
     * Determines if escalation is allowed
     */
    canEscalate(risk, action) {
        if (this.isDangerousCommand(action)) {
            return false;
        }
        if (risk === "high") {
            return false;
        }
        if (this.state.attempts >= this.state.maxAttempts) {
            return false;
        }
        return true;
    }
    /**
     * Record escalation usage
     */
    recordEscalation() {
        this.state.attempts += 1;
    }
    /**
     * Reset between execution cycles
     */
    reset() {
        this.state.attempts = 0;
    }
    /**
     * Detect commands that justify escalation
     */
    shouldEscalate(action) {
        const patterns = [
            /npm\s+/i,
            /git\s+/i,
            /tsc/i,
            /node\s+/i,
            /yarn\s+/i,
            /pnpm\s+/i,
            /docker\s+/i,
            /mkdir\s+/i
        ];
        return patterns.some((pattern) => pattern.test(action));
    }
    /**
     * Hard block unsafe system-level commands
     */
    isDangerousCommand(command) {
        const blockedPatterns = [
            /rm\s+-rf\s+\//i,
            /rm\s+-rf\s+\*/i,
            /format\s+/i,
            /shutdown/i,
            /reboot/i,
            /del\s+\/f/i,
            /rmdir\s+\/s/i,
            /:\(\)\{:\|\:&\};:/ // fork bomb
        ];
        return blockedPatterns.some((pattern) => pattern.test(command));
    }
}
exports.EscalationPolicy = EscalationPolicy;
