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
exports.ExecutionJournal = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ExecutionJournal {
    constructor(workspace) {
        this.journalPath = path.join(workspace, "execution-log.json");
        if (!fs.existsSync(this.journalPath)) {
            fs.writeFileSync(this.journalPath, JSON.stringify([], null, 2));
        }
    }
    read() {
        const raw = fs.readFileSync(this.journalPath, "utf-8");
        return JSON.parse(raw);
    }
    write(entries) {
        fs.writeFileSync(this.journalPath, JSON.stringify(entries, null, 2));
    }
    log(entry) {
        const entries = this.read();
        entries.push(entry);
        this.write(entries);
    }
}
exports.ExecutionJournal = ExecutionJournal;
