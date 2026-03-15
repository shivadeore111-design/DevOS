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
exports.conversationMemory = void 0;
// personality/conversationMemory.ts — Short-term conversation memory + fact extraction
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ollama_1 = require("../llm/ollama");
const MEMORY_FILE = path.join(process.cwd(), 'workspace', 'conversation-memory.json');
const MAX_MESSAGES = 200;
function loadStore() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
        }
    }
    catch { /* corrupt file — start fresh */ }
    return { messages: [], facts: [] };
}
function saveStore(store) {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2));
}
class ConversationMemory {
    addMessage(role, content, intent) {
        const store = loadStore();
        const msg = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role,
            content,
            timestamp: new Date().toISOString(),
            ...(intent ? { intent } : {}),
        };
        store.messages.push(msg);
        // Keep only the most recent MAX_MESSAGES
        if (store.messages.length > MAX_MESSAGES) {
            store.messages = store.messages.slice(-MAX_MESSAGES);
        }
        saveStore(store);
        return msg;
    }
    getRecentMessages(n = 20) {
        const store = loadStore();
        return store.messages.slice(-n);
    }
    /** Build a compact context string from the last N messages */
    getContext(n = 10) {
        const msgs = this.getRecentMessages(n);
        if (msgs.length === 0)
            return '';
        return msgs
            .map(m => `${m.role === 'user' ? 'User' : 'DevOS'}: ${m.content}`)
            .join('\n');
    }
    /** Call Ollama to extract facts from recent messages and save them */
    async extractFacts(messages) {
        if (messages.length === 0)
            return [];
        const conversation = messages
            .map(m => `${m.role === 'user' ? 'User' : 'DevOS'}: ${m.content}`)
            .join('\n');
        const prompt = `Extract factual information about the user from this conversation.
Return ONLY a JSON array of strings, each being a concise fact. Example: ["User prefers TypeScript", "User is building a SaaS product"]
If no facts can be extracted, return [].

Conversation:
${conversation}

Facts:`;
        try {
            const raw = await (0, ollama_1.callOllama)(prompt, undefined, 'qwen2.5-coder:7b');
            const match = raw.match(/\[[\s\S]*\]/);
            if (!match)
                return [];
            const factStrings = JSON.parse(match[0]);
            if (!Array.isArray(factStrings))
                return [];
            const sourceId = messages[messages.length - 1]?.id ?? 'unknown';
            const facts = factStrings
                .filter(f => typeof f === 'string' && f.trim().length > 0)
                .map(f => ({
                id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                fact: f.trim(),
                source: sourceId,
                extractedAt: new Date().toISOString(),
            }));
            this.saveFacts(facts);
            return facts;
        }
        catch {
            return [];
        }
    }
    saveFacts(newFacts) {
        if (newFacts.length === 0)
            return;
        const store = loadStore();
        store.facts.push(...newFacts);
        saveStore(store);
    }
    getFacts() {
        return loadStore().facts;
    }
    clear() {
        saveStore({ messages: [], facts: [] });
    }
}
exports.conversationMemory = new ConversationMemory();
