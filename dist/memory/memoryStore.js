"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryStore = void 0;
// ============================================================
// memoryStore.ts — DevOS Agent Memory Layer
// Persistent key-value memory with tagging and search
// ============================================================
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const MEMORY_DIR = path_1.default.join(process.cwd(), "workspace", "memory");
const MEMORY_FILE = path_1.default.join(MEMORY_DIR, "memory.json");
class MemoryStore {
    constructor() {
        this.store = new Map();
    }
    load() {
        if (!fs_1.default.existsSync(MEMORY_DIR))
            fs_1.default.mkdirSync(MEMORY_DIR, { recursive: true });
        if (!fs_1.default.existsSync(MEMORY_FILE)) {
            this.persist();
            return;
        }
        try {
            const raw = JSON.parse(fs_1.default.readFileSync(MEMORY_FILE, "utf-8"));
            this.store.clear();
            for (const e of raw)
                this.store.set(e.key, e);
            console.log(`[Memory] Loaded ${this.store.size} entries.`);
        }
        catch (err) {
            console.error(`[Memory] Load failed: ${err.message}`);
        }
    }
    set(key, value, tags = []) {
        const now = new Date().toISOString();
        const existing = this.store.get(key);
        const entry = {
            key,
            value,
            tags,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };
        this.store.set(key, entry);
        this.persist();
        return entry;
    }
    get(key) {
        return this.store.get(key)?.value;
    }
    search(tag) {
        return Array.from(this.store.values()).filter(e => e.tags.includes(tag));
    }
    delete(key) {
        const ok = this.store.delete(key);
        if (ok)
            this.persist();
        return ok;
    }
    getAll() {
        return Array.from(this.store.values());
    }
    persist() {
        const tmp = MEMORY_FILE + ".tmp";
        try {
            if (!fs_1.default.existsSync(MEMORY_DIR))
                fs_1.default.mkdirSync(MEMORY_DIR, { recursive: true });
            fs_1.default.writeFileSync(tmp, JSON.stringify(this.getAll(), null, 2), "utf-8");
            fs_1.default.renameSync(tmp, MEMORY_FILE);
        }
        catch (err) {
            console.error(`[Memory] Persist failed: ${err.message}`);
        }
    }
}
exports.memoryStore = new MemoryStore();
