"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationMemory = exports.ConversationMemory = void 0;
// core/conversationMemory.ts — Multi-session cross-session conversation memory.
// Each browser tab gets its own session. Facts and semantic memory are shared
// across sessions; exchange history is per-session.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const semanticMemory_1 = require("./semanticMemory");
const entityGraph_1 = require("./entityGraph");
const secretScanner_1 = require("./secretScanner");
const MEMORY_PATH = path_1.default.join(process.cwd(), 'workspace', 'conversation.json');
// ── ConversationMemory ─────────────────────────────────────────
class ConversationMemory {
    constructor() {
        this.sessionId = 'default';
        this.allSessions = {};
        this.state = this.load();
    }
    // ── Persistence ──────────────────────────────────────────────
    load() {
        try {
            if (fs_1.default.existsSync(MEMORY_PATH)) {
                const raw = fs_1.default.readFileSync(MEMORY_PATH, 'utf-8');
                const parsed = JSON.parse(raw);
                // Backward-compatibility: old format was a single ConversationState
                // (has .exchanges array at top level). Migrate into multi-session map.
                if (Array.isArray(parsed.exchanges)) {
                    const legacy = parsed;
                    this.allSessions = { [legacy.sessionId || 'default']: legacy };
                }
                else {
                    this.allSessions = parsed;
                }
            }
        }
        catch { }
        return this.allSessions[this.sessionId] || this.freshState();
    }
    freshState() {
        return {
            exchanges: [],
            facts: {
                lastFilesCreated: [],
                lastSearchQueries: [],
                lastToolsUsed: [],
                mentionedEntities: [],
                preferredPaths: [],
            },
            sessionId: this.sessionId,
            updatedAt: Date.now(),
        };
    }
    save() {
        try {
            const dir = path_1.default.dirname(MEMORY_PATH);
            fs_1.default.mkdirSync(dir, { recursive: true });
            this.state.updatedAt = Date.now();
            this.allSessions[this.sessionId] = this.state;
            const tmp = MEMORY_PATH + '.tmp';
            fs_1.default.writeFileSync(tmp, JSON.stringify(this.allSessions, null, 2));
            fs_1.default.renameSync(tmp, MEMORY_PATH);
        }
        catch (e) {
            console.error('[ConversationMemory] Save failed:', e.message);
        }
    }
    // ── Session management ────────────────────────────────────────
    setSession(sessionId) {
        if (sessionId === this.sessionId)
            return;
        this.sessionId = sessionId;
        // Load (or create fresh) state for this session
        this.state = this.allSessions[sessionId] || this.freshState();
    }
    getSessions() {
        return Object.keys(this.allSessions);
    }
    // Pull key facts from ALL sessions — useful for cross-session context
    getCrossSessionFacts() {
        const allFacts = [];
        Object.values(this.allSessions).forEach(session => {
            const f = session.facts;
            if (f.lastFilesCreated?.length) {
                allFacts.push(`Created: ${f.lastFilesCreated[f.lastFilesCreated.length - 1]}`);
            }
            if (f.lastSearchQueries?.length) {
                allFacts.push(`Searched: "${f.lastSearchQueries[f.lastSearchQueries.length - 1]}"`);
            }
            if (f.mentionedEntities?.length) {
                allFacts.push(`Topics: ${f.mentionedEntities.slice(0, 3).join(', ')}`);
            }
        });
        return [...new Set(allFacts)].slice(0, 10).join('\n');
    }
    // ── Add messages ─────────────────────────────────────────────
    addUserMessage(message) {
        const resolved = this.resolveReferences(message);
        // Sprint 22: redact secrets before persisting to semantic memory
        const safeResolved = (0, secretScanner_1.scanAndRedact)(resolved);
        semanticMemory_1.semanticMemory.add(safeResolved, 'exchange', ['user']);
        return resolved; // return original (unredacted) for in-process use
    }
    addAssistantMessage(reply, metadata = {}) {
        // Sprint 22: redact secrets before writing to disk
        const safeReply = (0, secretScanner_1.scanAndRedact)(reply);
        const lastExchange = this.state.exchanges[this.state.exchanges.length - 1];
        if (lastExchange && !lastExchange.aiReply) {
            lastExchange.aiReply = safeReply.slice(0, 2000);
            lastExchange.toolsUsed = metadata.toolsUsed || [];
            lastExchange.filesCreated = metadata.filesCreated || [];
            lastExchange.searchQueries = metadata.searchQueries || [];
            lastExchange.planId = metadata.planId;
        }
        else {
            const ex = {
                id: `ex_${Date.now()}`,
                userMessage: '',
                aiReply: safeReply.slice(0, 2000),
                timestamp: Date.now(),
                toolsUsed: metadata.toolsUsed || [],
                filesCreated: metadata.filesCreated || [],
                searchQueries: metadata.searchQueries || [],
                planId: metadata.planId,
            };
            this.state.exchanges.push(ex);
        }
        // Keep only last 20 exchanges per session
        if (this.state.exchanges.length > 20) {
            this.state.exchanges = this.state.exchanges.slice(-20);
        }
        this.save();
        // Index into shared semantic memory (using redacted copy)
        semanticMemory_1.semanticMemory.add(safeReply.slice(0, 500), 'exchange', ['assistant']);
        // Auto-extract entities and build graph from this exchange
        entityGraph_1.entityGraph.extractAndAdd(safeReply, {
            files: metadata?.filesCreated,
            tools: metadata?.toolsUsed,
            searchQuery: metadata?.searchQueries?.[0],
        });
    }
    // Called at the start of processing each user message — records the user turn
    recordUserTurn(resolvedMessage) {
        // Sprint 22: redact secrets before writing to disk
        const safeMessage = (0, secretScanner_1.scanAndRedact)(resolvedMessage);
        const ex = {
            id: `ex_${Date.now()}`,
            userMessage: safeMessage.slice(0, 500),
            aiReply: '', // filled in by addAssistantMessage
            timestamp: Date.now(),
            toolsUsed: [],
            filesCreated: [],
            searchQueries: [],
        };
        this.state.exchanges.push(ex);
        this.save();
    }
    // ── Update facts from execution ───────────────────────────────
    updateFromExecution(toolsUsed, filesCreated, searchQueries, planId) {
        const facts = this.state.facts;
        if (toolsUsed.length)
            facts.lastToolsUsed = toolsUsed;
        if (filesCreated.length)
            facts.lastFilesCreated = filesCreated;
        if (searchQueries.length)
            facts.lastSearchQueries = searchQueries;
        if (planId)
            facts.lastPlanId = planId;
        for (const f of filesCreated) {
            if (!facts.preferredPaths.includes(f))
                facts.preferredPaths.push(f);
        }
        if (facts.preferredPaths.length > 10) {
            facts.preferredPaths = facts.preferredPaths.slice(-10);
        }
        for (const q of searchQueries) {
            const matches = q.match(/\b[A-Z][a-zA-Z]{2,}\b/g) || [];
            for (const m of matches) {
                if (!facts.mentionedEntities.includes(m))
                    facts.mentionedEntities.push(m);
            }
        }
        if (facts.mentionedEntities.length > 30) {
            facts.mentionedEntities = facts.mentionedEntities.slice(-30);
        }
        this.save();
    }
    // ── Reference resolution ─────────────────────────────────────
    resolveReferences(message) {
        const facts = this.state.facts;
        let resolved = message;
        // Only replace "the file"/"that file" if NOT followed by an explicit file path
        if (/\b(that file|the file|that document|that report|that script)\b(?!\s+[/\\]|\s+[A-Z]:)/i.test(resolved)) {
            const lastFile = facts.lastFilesCreated[facts.lastFilesCreated.length - 1];
            if (lastFile) {
                resolved = resolved.replace(/\b(that file|the file|that document|that report|that script)\b(?!\s+[/\\]|\s+[A-Z]:)/gi, lastFile);
            }
        }
        if (/\b(that search|those results|the results|that query)\b/i.test(resolved)) {
            const lastQuery = facts.lastSearchQueries[facts.lastSearchQueries.length - 1];
            if (lastQuery) {
                resolved = resolved.replace(/\b(that search|those results|the results|that query)\b/gi, `"${lastQuery}"`);
            }
        }
        return resolved;
    }
    // ── Context building for planner ─────────────────────────────
    buildContext() {
        const facts = this.state.facts;
        const allExchanges = this.state.exchanges;
        const recent = allExchanges.slice(-6);
        const older = allExchanges.slice(0, -6);
        const lastUserMsg = recent.filter(e => e.userMessage).slice(-1)[0]?.userMessage || '';
        const lines = [];
        // ── Key facts (files, searches, tools) ─────────────────────
        if (facts.lastFilesCreated.length > 0) {
            lines.push(`Recently created files: ${facts.lastFilesCreated.join(', ')}`);
        }
        if (facts.lastSearchQueries.length > 0) {
            lines.push(`Recent searches: ${facts.lastSearchQueries.join(', ')}`);
        }
        if (facts.lastToolsUsed.length > 0) {
            lines.push(`Last tools used: ${facts.lastToolsUsed.join(', ')}`);
        }
        if (facts.mentionedEntities.length > 0) {
            lines.push(`Topics discussed: ${facts.mentionedEntities.slice(-10).join(', ')}`);
        }
        if (facts.preferredPaths.length > 0) {
            lines.push(`User file paths: ${facts.preferredPaths.slice(-5).join(', ')}`);
        }
        // ── Older exchange compression ──────────────────────────────
        // Exchanges beyond the last 6 are compressed to key facts only
        if (older.length > 0) {
            const olderFacts = older
                .slice(-10) // max 10 older items to scan
                .map(ex => {
                const parts = [];
                const src = [ex.userMessage || '', ex.aiReply || ''].join(' ');
                // Extract file paths
                const filePaths = src.match(/[A-Za-z]:\\[^\s"']+\.[a-z]{1,5}/g) || [];
                parts.push(...filePaths.slice(0, 2));
                // Extract URLs
                const urls = src.match(/https?:\/\/[^\s"']+/g) || [];
                parts.push(...urls.slice(0, 1));
                // If nothing specific, use truncated user message
                if (parts.length === 0 && ex.userMessage) {
                    parts.push(ex.userMessage.slice(0, 60));
                }
                return parts.join(', ');
            })
                .filter(Boolean);
            if (olderFacts.length > 0) {
                lines.push('');
                lines.push(`Earlier this session: ${olderFacts.join(' | ')}`);
            }
        }
        // ── Cross-session context ───────────────────────────────────
        const crossSession = this.getCrossSessionFacts();
        if (crossSession) {
            lines.push('');
            lines.push('CROSS-SESSION CONTEXT:');
            crossSession.split('\n').forEach(l => lines.push(`  ${l}`));
        }
        // ── Recent exchanges (verbatim, last 6) ─────────────────────
        if (recent.length > 0) {
            lines.push('');
            lines.push('Recent exchanges:');
            for (const ex of recent) {
                if (ex.userMessage)
                    lines.push(`  User: ${ex.userMessage.slice(0, 150)}`);
                if (ex.aiReply)
                    lines.push(`  Aiden: ${ex.aiReply.slice(0, 100)}`);
            }
        }
        // ── Semantic memory — similar past exchanges ────────────────
        if (lastUserMsg) {
            const semanticMatches = semanticMemory_1.semanticMemory.searchText(lastUserMsg, 3);
            if (semanticMatches.length > 0) {
                lines.push('');
                lines.push('SEMANTIC MEMORY (similar past exchanges):');
                semanticMatches.forEach(m => lines.push(`- ${m.slice(0, 120)}`));
            }
        }
        // ── Entity graph context ────────────────────────────────────
        const graphContext = entityGraph_1.entityGraph.buildContextString(lastUserMsg);
        if (graphContext) {
            lines.push('');
            lines.push(graphContext);
        }
        // Hard cap at 1200 chars to keep planner prompts lean
        return lines.join('\n').slice(0, 1200);
    }
    // ── Accessors ─────────────────────────────────────────────────
    getRecentHistory() {
        return this.state.exchanges.slice(-10);
    }
    getFacts() {
        return this.state.facts;
    }
    // ── Clear (current session only) ──────────────────────────────
    clear() {
        this.state = this.freshState();
        this.save();
    }
}
exports.ConversationMemory = ConversationMemory;
exports.conversationMemory = new ConversationMemory();
