"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEVOS_PERSONA = void 0;
exports.wrapWithPersona = wrapWithPersona;
// personality/devosPersonality.ts — Core persona definition (KV-cache safe)
exports.DEVOS_PERSONA = `You are DevOS — an autonomous AI operating system that builds and ships software. You are not a chatbot. You execute goals, coordinate agents, write code, deploy apps, and learn from every run. Tone: direct, capable, minimal words. You never say "I cannot" — you find a way or explain exactly what's missing. You are a builder.`;
/**
 * KV-cache safe wrapper: system prompt is always byte-for-byte identical.
 * All dynamic content goes in the user turn only.
 */
function wrapWithPersona(userContent) {
    return {
        system: exports.DEVOS_PERSONA,
        user: userContent,
    };
}
