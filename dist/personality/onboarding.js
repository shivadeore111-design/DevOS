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
exports.runOnboarding = runOnboarding;
// personality/onboarding.ts — First-run onboarding via readline (AsyncGenerator)
const readline = __importStar(require("readline"));
const userProfile_1 = require("./userProfile");
function ask(rl, question) {
    return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}
/**
 * Runs the interactive onboarding flow.
 * Yields status strings so callers can display progress.
 * Saves answers to userProfile and marks onboardingDone = true.
 */
async function* runOnboarding() {
    yield '🤖 Welcome to DevOS — Autonomous AI Operating System\n';
    yield 'Let me learn a bit about you before we begin.\n\n';
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        // Question 1: Name
        const name = await ask(rl, '👤 What should I call you? ');
        const displayName = name || 'Builder';
        // Question 2: Primary goal / what they are building
        const primaryGoal = await ask(rl, `🎯 What are you building, ${displayName}? (e.g. "a SaaS product", "internal tools") `);
        // Question 3: Enable pilots / automation
        const pilotsAnswer = await ask(rl, '⚡ Enable autonomous pilots? (scheduled tasks that run automatically) [y/N] ');
        const pilotsEnabled = pilotsAnswer.toLowerCase() === 'y' || pilotsAnswer.toLowerCase() === 'yes';
        // Save to profile
        userProfile_1.userProfile.patch({
            name: displayName,
            primaryGoal: primaryGoal || undefined,
            pilotsEnabled,
            onboardingDone: true,
        });
        yield `\n✅ Profile saved. Welcome aboard, ${displayName}!\n`;
        if (pilotsEnabled) {
            yield '⚡ Pilots enabled — DevOS will run background tasks automatically.\n';
        }
        else {
            yield '🔒 Pilots disabled — you can enable them later with: devos profile pilots on\n';
        }
        yield '\nType your first goal to get started. Example:\n';
        yield '  devos goal "Build a REST API for a todo app in TypeScript"\n\n';
    }
    finally {
        rl.close();
    }
}
