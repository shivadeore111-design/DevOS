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
// bin/npx-init.ts — Entry point for `npx devos` / first-run bootstrap.
//
// Sprint 24: Setup wizard runs as FIRST step before coreBoot, so every
// new user gets hardware detection + model selection on their first run.
const setupWizard_1 = require("../core/setupWizard");
async function main() {
    // ── Step 1: First-boot setup (Sprint 24) ──────────────────
    // Runs on every fresh machine; skipped immediately if already complete.
    if (!(0, setupWizard_1.isSetupComplete)()) {
        await (0, setupWizard_1.runSetupWizard)();
    }
    // ── Step 2: Core boot (full DevOS initialisation) ─────────
    // coreBoot() is defined in the full host implementation.
    // Importing dynamically so this file compiles in the sandbox
    // without the full module graph.
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — coreBoot is only available in the full host implementation
        const { coreBoot } = await Promise.resolve().then(() => __importStar(require('../core/coreBoot')));
        await coreBoot();
    }
    catch (err) {
        // coreBoot not available in sandbox — this is expected
        if (process.env.NODE_ENV !== 'test') {
            console.error(`[npx-init] coreBoot unavailable: ${err?.message}`);
        }
    }
}
main().catch(err => {
    console.error('[npx-init] Fatal:', err);
    process.exit(1);
});
