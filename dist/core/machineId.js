"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMachineId = getMachineId;
// core/machineId.ts — Hardware-bound machine identifier
//
// Derives a stable, anonymised 16-char hex ID from the BIOS UUID
// (via wmic on Windows) with a hostname+username fallback.
// The ID is one-way hashed — the raw UUID never leaves the machine.
const child_process_1 = require("child_process");
const crypto_1 = __importDefault(require("crypto"));
const os_1 = __importDefault(require("os"));
function getMachineId() {
    try {
        const out = (0, child_process_1.execSync)('wmic csproduct get UUID /value', { timeout: 3000 }).toString();
        const uuid = out.match(/UUID=([^\s]+)/)?.[1]?.trim() || '';
        if (uuid && uuid !== 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF') {
            return crypto_1.default.createHash('sha256').update(uuid).digest('hex').slice(0, 16);
        }
    }
    catch { }
    // Fallback: hostname + username (works on Linux/macOS too)
    const fallback = `${os_1.default.hostname()}-${os_1.default.userInfo().username}`;
    return crypto_1.default.createHash('sha256').update(fallback).digest('hex').slice(0, 16);
}
