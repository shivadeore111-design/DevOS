"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectTaskType = detectTaskType;
exports.scoreModelForTask = scoreModelForTask;
exports.getAvailableModels = getAvailableModels;
exports.recommendModel = recommendModel;
exports.promptUserToSwitch = promptUserToSwitch;
exports.resolveModel = resolveModel;
// ============================================================
// DevOS - Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
const axios_1 = __importDefault(require("axios"));
const readline_1 = __importDefault(require("readline"));
const hardwareConfig_1 = require("../core/hardwareConfig");
const BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
let cachedModels = [];
let cacheExpiry = 0;
const CACHE_TTL = 60000;
const SCORE_TABLE = {
    "qwen2.5-coder": { coding: 95, planning: 60, marketing: 50, json: 90, deployment: 90, research: 65, general: 70 },
    "mistral-nemo": { coding: 65, planning: 90, marketing: 92, json: 75, deployment: 70, research: 88, general: 85 },
    "mistral": { coding: 60, planning: 80, marketing: 85, json: 70, deployment: 65, research: 80, general: 78 },
    "llama3": { coding: 65, planning: 78, marketing: 75, json: 68, deployment: 65, research: 75, general: 80 },
    "qwen2.5": { coding: 70, planning: 75, marketing: 72, json: 80, deployment: 72, research: 74, general: 72 },
    "deepseek-coder": { coding: 92, planning: 55, marketing: 48, json: 88, deployment: 88, research: 60, general: 65 },
    "codellama": { coding: 90, planning: 50, marketing: 45, json: 82, deployment: 85, research: 55, general: 60 },
    "phi": { coding: 62, planning: 70, marketing: 68, json: 65, deployment: 62, research: 70, general: 72 },
    "gemma": { coding: 60, planning: 72, marketing: 70, json: 65, deployment: 60, research: 72, general: 70 },
};
const DEFAULT_SCORES = {
    coding: 60, planning: 60, marketing: 60, json: 60, deployment: 60, research: 60, general: 60,
};
function detectTaskType(prompt, systemPrompt) {
    const text = (prompt + " " + (systemPrompt ?? "")).toLowerCase();
    const has = (keywords) => keywords.some((k) => text.includes(k));
    if (has(["return json", "return only json", "valid json", "json array", "json object"]))
        return "json";
    if (has(["docker", "nginx", "deploy", "vps", "ssl", "pm2", "ci/cd", "github actions"]))
        return "deployment";
    if (has(["code", "typescript", "javascript", "function", "implement", "debug", "class", "script", "module", "bug"]))
        return "coding";
    if (has(["icp", "landing page", "email sequence", "copy", "headline", "cta", "content calendar", "audience", "positioning"]))
        return "marketing";
    if (has(["plan", "strategy", "milestone", "roadmap", "phases", "timeline", "goal", "okr"]))
        return "planning";
    if (has(["research", "analyze", "compare", "summarize", "insights", "findings", "study"]))
        return "research";
    return "general";
}
function scoreModelForTask(modelName, taskType) {
    const name = modelName.toLowerCase();
    if (!hardwareConfig_1.hardwareConfig.isModelAllowed(name))
        return 0;
    let scores = DEFAULT_SCORES;
    for (const key of Object.keys(SCORE_TABLE)) {
        if (name.includes(key)) {
            scores = SCORE_TABLE[key];
            break;
        }
    }
    const base = scores[taskType];
    const bonus = /7b|34b|70b/.test(name) ? 5 : 0;
    return Math.min(base + bonus, 100);
}
async function getAvailableModels() {
    if (cachedModels.length > 0 && Date.now() < cacheExpiry)
        return cachedModels;
    try {
        const res = await axios_1.default.get(`${BASE_URL}/api/tags`, { timeout: 5000 });
        cachedModels = (res.data.models ?? []).map((m) => m.name);
        cacheExpiry = Date.now() + CACHE_TTL;
        return cachedModels;
    }
    catch {
        return [];
    }
}
async function recommendModel(prompt, systemPrompt) {
    const currentModel = process.env.OLLAMA_MODEL ?? "llama3";
    const taskType = detectTaskType(prompt, systemPrompt);
    const available = await getAvailableModels();
    const currentScore = scoreModelForTask(currentModel, taskType);
    if (available.length === 0) {
        return {
            currentModel, recommendedModel: currentModel,
            taskType, currentScore, recommendedScore: currentScore,
            scoreDiff: 0, shouldSuggest: false, message: "",
        };
    }
    // Seed with the hardware-config recommendation as the starting best candidate
    const hwRecommended = hardwareConfig_1.hardwareConfig.getRecommendedModel(taskType);
    const hwScore = scoreModelForTask(hwRecommended, taskType);
    let bestModel = hwScore > currentScore ? hwRecommended : currentModel;
    let bestScore = hwScore > currentScore ? hwScore : currentScore;
    for (const model of available) {
        const score = scoreModelForTask(model, taskType);
        if (score > bestScore) {
            bestScore = score;
            bestModel = model;
        }
    }
    const scoreDiff = bestScore - currentScore;
    const shouldSuggest = scoreDiff >= 15;
    const message = shouldSuggest
        ? `${bestModel} scores higher for ${taskType} tasks (${bestScore} vs ${currentScore}). Switch?`
        : "";
    return {
        currentModel, recommendedModel: bestModel,
        taskType, currentScore, recommendedScore: bestScore,
        scoreDiff, shouldSuggest, message,
    };
}
async function promptUserToSwitch(rec) {
    if (!rec.shouldSuggest) {
        console.log(`[ModelRouter] Task: ${rec.taskType} -> Model: ${rec.currentModel} (score: ${rec.currentScore})`);
        return rec.currentModel;
    }
    console.log(`\n${rec.message}`);
    return new Promise((resolve) => {
        const rl = readline_1.default.createInterface({ input: process.stdin, output: process.stdout });
        rl.question("   Use recommended? [Y/n]: ", (answer) => {
            rl.close();
            const val = answer.trim().toLowerCase();
            if (val === "y" || val === "") {
                console.log(`   Switching to ${rec.recommendedModel} for this task`);
                resolve(rec.recommendedModel);
            }
            else {
                console.log(`   Keeping ${rec.currentModel}`);
                resolve(rec.currentModel);
            }
        });
    });
}
async function resolveModel(prompt, systemPrompt) {
    const rec = await recommendModel(prompt, systemPrompt);
    return promptUserToSwitch(rec);
}
