"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCommand = runCommand;
// core/runCommand.ts
const child_process_1 = require("child_process");
function runCommand(cmd) {
    return new Promise((resolve) => {
        (0, child_process_1.exec)(cmd, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                resolve({
                    success: false,
                    stdout,
                    stderr,
                    errorMessage: error.message
                });
            }
            else {
                resolve({
                    success: true,
                    stdout,
                    stderr
                });
            }
        });
    });
}
