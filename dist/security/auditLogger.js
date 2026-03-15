"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
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
exports.auditLogger = exports.AuditLogger = void 0;
// security/auditLogger.ts — Append-only structured audit log
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const LOG_PATH = path.join(process.cwd(), "logs", "audit.log");
class AuditLogger {
    constructor() {
        const dir = path.dirname(LOG_PATH);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
    }
    log(entry) {
        const line = JSON.stringify(entry) + "\n";
        fs.appendFileSync(LOG_PATH, line);
    }
    getRecent(n = 50) {
        if (!fs.existsSync(LOG_PATH))
            return [];
        const lines = fs.readFileSync(LOG_PATH, "utf-8")
            .trim().split("\n").filter(Boolean);
        return lines.slice(-n).map(l => JSON.parse(l)).reverse();
    }
    getByType(type) {
        return this.getRecent(500).filter(e => e.type === type);
    }
}
exports.AuditLogger = AuditLogger;
exports.auditLogger = new AuditLogger();
