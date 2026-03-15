"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hardwareConfig = exports.HardwareConfig = void 0;
// core/hardwareConfig.ts — Reads config/hardware.json and gates model selection
//                          by available VRAM / param count.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const CONFIG_PATH = path_1.default.join(process.cwd(), "config", "hardware.json");
/** Maps common size suffixes in model names to approximate parameter counts. */
const SIZE_MAP = {
    "0.5b": 500000000,
    "1b": 1000000000,
    "1.5b": 1500000000,
    "2b": 2000000000,
    "3b": 3000000000,
    "4b": 4000000000,
    "6b": 6000000000,
    "7b": 7000000000,
    "8b": 8000000000,
    "9b": 9000000000,
    "11b": 11000000000,
    "12b": 12000000000,
    "13b": 13000000000,
    "14b": 14000000000,
    "30b": 30000000000,
    "34b": 34000000000,
    "70b": 70000000000,
    "72b": 72000000000,
};
class HardwareConfig {
    constructor() {
        this.data = this._load();
    }
    /** Re-read the JSON file from disk (useful after edits at runtime). */
    reload() {
        this.data = this._load();
        console.log(`[HardwareConfig] Reloaded — maxModelSizeB: ${this.data.maxModelSizeB.toLocaleString()}`);
    }
    /** Returns the configured maximum model parameter count. */
    getMaxModelSize() {
        return this.data.maxModelSizeB;
    }
    /**
     * Returns true if a model is allowed to run given:
     *  1. It is not in blockedModels
     *  2. Its inferred parameter count does not exceed maxModelSizeB
     */
    isModelAllowed(modelName) {
        const name = modelName.toLowerCase();
        // Check explicit block list first
        if (this.data.blockedModels.some(b => name.includes(b.toLowerCase()))) {
            return false;
        }
        // Infer size from model name suffix
        const size = this._inferModelSize(name);
        if (size === null)
            return true; // unknown size — allow by default
        return size <= this.data.maxModelSizeB;
    }
    /**
     * Returns the recommended model for a given task key.
     * Falls back to the "default" key, then to the env model.
     */
    getRecommendedModel(task) {
        const key = task.toLowerCase();
        const models = this.data.recommendedModels;
        return models[key] ?? models["default"] ?? process.env.OLLAMA_MODEL ?? "llama3";
    }
    /** Expose raw config in case callers need it. */
    getConfig() {
        return this.data;
    }
    // ── Private ───────────────────────────────────────────────
    _load() {
        try {
            const raw = fs_1.default.readFileSync(CONFIG_PATH, "utf-8");
            return JSON.parse(raw);
        }
        catch {
            console.warn(`[HardwareConfig] Could not read ${CONFIG_PATH} — using defaults`);
            return {
                gpu: { name: "unknown", vramGb: 6, cuda: false },
                cpu: { cores: 4, name: "unknown" },
                ramGb: 16,
                maxModelSizeB: 7000000000,
                recommendedModels: {
                    default: "llama3",
                    coding: "qwen2.5-coder:7b",
                },
                blockedModels: [],
                maxConcurrentModels: 1,
            };
        }
    }
    /**
     * Extracts the parameter-count suffix from a model name string.
     * Returns null when no recognised suffix is found.
     * e.g. "qwen2.5-coder:7b" → 7_000_000_000
     *      "mistral-nemo:12b" → 12_000_000_000
     */
    _inferModelSize(modelName) {
        const lower = modelName.toLowerCase();
        // Try exact suffix matches (longest first to avoid "7b" inside "70b")
        const keys = Object.keys(SIZE_MAP).sort((a, b) => b.length - a.length);
        for (const key of keys) {
            const re = new RegExp(`[^\\d]${key.replace(".", "\\.")}(:|$|\\s)`, "i");
            if (re.test(lower) || lower.startsWith(key)) {
                return SIZE_MAP[key];
            }
        }
        // Generic numeric match: "42b" or "42B"
        const genericRe = /(\d+(?:\.\d+)?)b(?:$|[^a-z])/i;
        const match = genericRe.exec(lower);
        if (match) {
            return Math.round(parseFloat(match[1]) * 1000000000);
        }
        return null;
    }
}
exports.HardwareConfig = HardwareConfig;
exports.hardwareConfig = new HardwareConfig();
