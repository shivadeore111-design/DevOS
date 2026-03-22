"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProject = runProject;
const child_process_1 = require("child_process");
async function runProject(rootDir) {
    return new Promise((resolve) => {
        (0, child_process_1.exec)(`cd ${rootDir} && npm install`, (err) => {
            if (err) {
                console.log("Install failed.");
                resolve(false);
                return;
            }
            console.log("Dependencies installed.");
            (0, child_process_1.exec)(`cd ${rootDir} && npm run dev`, () => {
                resolve(true);
            });
        });
    });
}
