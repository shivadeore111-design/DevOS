"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeGraph = exports.KnowledgeGraph = void 0;
// knowledge/knowledgeGraph.ts — Directed relationship graph over knowledge entries.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const knowledgeStore_1 = require("./knowledgeStore");
const GRAPH_FILE = path_1.default.join(process.cwd(), "knowledge", "knowledge-graph.json");
class KnowledgeGraph {
    constructor() {
        this.edges = [];
        this._load();
    }
    // ── Mutations ─────────────────────────────────────────────
    addEdge(fromId, toId, relationship, strength = 0.5) {
        // Avoid exact duplicates
        const exists = this.edges.some(e => e.fromId === fromId && e.toId === toId && e.relationship === relationship);
        if (!exists) {
            this.edges.push({ fromId, toId, relationship, strength: Math.min(1, Math.max(0, strength)) });
            this._persist();
        }
    }
    // ── Queries ───────────────────────────────────────────────
    /**
     * Returns knowledge entries related to `id`, sorted by edge strength descending.
     * Follows both outgoing and incoming edges.
     */
    getRelated(id, limit = 5) {
        const relatedIds = this.edges
            .filter(e => e.fromId === id || e.toId === id)
            .sort((a, b) => b.strength - a.strength)
            .map(e => (e.fromId === id ? e.toId : e.fromId))
            .filter((rid, idx, arr) => arr.indexOf(rid) === idx) // dedupe
            .slice(0, limit);
        return relatedIds
            .map(rid => knowledgeStore_1.knowledgeStore.get(rid))
            .filter((e) => e !== null);
    }
    /**
     * BFS path finding between two knowledge entries.
     * Returns array of node IDs representing the path, or [] if none found.
     */
    findPath(fromId, toId) {
        if (fromId === toId)
            return [fromId];
        const visited = new Set([fromId]);
        const queue = [{ id: fromId, path: [fromId] }];
        while (queue.length > 0) {
            const current = queue.shift();
            const neighbours = this.edges
                .filter(e => e.fromId === current.id || e.toId === current.id)
                .map(e => (e.fromId === current.id ? e.toId : e.fromId));
            for (const neighbour of neighbours) {
                if (visited.has(neighbour))
                    continue;
                const newPath = [...current.path, neighbour];
                if (neighbour === toId)
                    return newPath;
                visited.add(neighbour);
                queue.push({ id: neighbour, path: newPath });
            }
        }
        return []; // no path
    }
    /** Return all edges. */
    listEdges() {
        return [...this.edges];
    }
    // ── Persistence ───────────────────────────────────────────
    _load() {
        try {
            if (!fs_1.default.existsSync(GRAPH_FILE))
                return;
            const raw = fs_1.default.readFileSync(GRAPH_FILE, "utf-8");
            this.edges = JSON.parse(raw);
        }
        catch {
            this.edges = [];
        }
    }
    _persist() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(GRAPH_FILE), { recursive: true });
            fs_1.default.writeFileSync(GRAPH_FILE, JSON.stringify(this.edges, null, 2), "utf-8");
        }
        catch (err) {
            console.warn(`[KnowledgeGraph] Persist failed: ${err.message}`);
        }
    }
}
exports.KnowledgeGraph = KnowledgeGraph;
exports.knowledgeGraph = new KnowledgeGraph();
