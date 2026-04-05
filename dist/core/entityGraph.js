"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.entityGraph = exports.EntityGraph = void 0;
// core/entityGraph.ts — Lightweight entity graph that auto-extracts
// topics, files, tools, and searches from conversation text, and
// tracks weighted relationships between them.
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const GRAPH_PATH = path_1.default.join(process.cwd(), 'workspace', 'entity_graph.json');
class EntityGraph {
    constructor() {
        this.graph = { nodes: [], edges: [] };
        this.load();
    }
    // ── Persistence ───────────────────────────────────────────────
    load() {
        try {
            if (fs_1.default.existsSync(GRAPH_PATH)) {
                this.graph = JSON.parse(fs_1.default.readFileSync(GRAPH_PATH, 'utf-8'));
            }
        }
        catch { }
    }
    save() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(GRAPH_PATH), { recursive: true });
            fs_1.default.writeFileSync(GRAPH_PATH, JSON.stringify(this.graph, null, 2));
        }
        catch { }
    }
    // ── Entity extraction ─────────────────────────────────────────
    extractAndAdd(text, context) {
        const extracted = [];
        // Extract Windows file paths
        const filePaths = text.match(/[A-Z]:\\[^\s"']+\.[a-z]+/gi) || [];
        filePaths.forEach(f => extracted.push({ name: f, type: 'file' }));
        // Extract quoted terms
        const quoted = text.match(/"([^"]{3,40})"/g)?.map(q => q.replace(/"/g, '')) || [];
        quoted.forEach(q => extracted.push({ name: q, type: 'concept' }));
        // Extract capitalized multi-word phrases (likely proper nouns / product names)
        const phrases = text.match(/\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,2})\b/g) || [];
        const skipWords = new Set([
            'The', 'This', 'That', 'You', 'Your', 'I', 'We', 'It',
            'In', 'On', 'At', 'To', 'For', 'Of', 'And', 'Or', 'But',
            'Aiden', 'DevOS', 'Windows', 'Step', 'Phase', 'Task',
        ]);
        phrases
            .filter(p => !skipWords.has(p) && p.length > 3)
            .slice(0, 10)
            .forEach(p => extracted.push({ name: p, type: 'topic' }));
        // Add context entities
        if (context?.files) {
            context.files.forEach(f => extracted.push({ name: f, type: 'file' }));
        }
        if (context?.tools) {
            context.tools.forEach(t => extracted.push({ name: t, type: 'tool' }));
        }
        if (context?.searchQuery) {
            extracted.push({ name: context.searchQuery, type: 'search' });
        }
        // Upsert all extracted entities as nodes
        extracted.forEach(({ name, type }) => this.addNode(name, type));
        // Create edges between co-occurring entities (sliding window of 3)
        const names = extracted.map(e => e.name);
        for (let i = 0; i < names.length; i++) {
            for (let j = i + 1; j < names.length && j < i + 3; j++) {
                this.addEdge(names[i], names[j], 'related_to');
            }
        }
        // Semantic relationship: search query → files created
        if (context?.files && context?.searchQuery) {
            context.files.forEach(f => {
                this.addEdge(context.searchQuery, f, 'saved_to');
            });
        }
        this.save();
    }
    // ── Graph mutation ────────────────────────────────────────────
    addNode(name, type) {
        if (!name || name.length < 2 || name.length > 200)
            return;
        const existing = this.graph.nodes.find(n => n.name === name);
        if (existing) {
            existing.lastSeen = Date.now();
            existing.frequency++;
        }
        else {
            this.graph.nodes.push({
                name,
                type,
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                frequency: 1,
            });
        }
        // Cap node count
        if (this.graph.nodes.length > 1000) {
            this.graph.nodes = this.graph.nodes
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, 800);
        }
    }
    addEdge(from, to, relation) {
        if (from === to)
            return;
        const existing = this.graph.edges.find(e => e.from === from && e.to === to && e.relation === relation);
        if (existing) {
            existing.weight++;
            existing.timestamp = Date.now();
        }
        else {
            this.graph.edges.push({ from, to, relation, weight: 1, timestamp: Date.now() });
        }
        // Cap edge count
        if (this.graph.edges.length > 2000) {
            this.graph.edges = this.graph.edges
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 1500);
        }
    }
    // ── Public API ────────────────────────────────────────────────
    getRelated(entity, maxResults = 5) {
        const related = this.graph.edges
            .filter(e => e.from === entity || e.to === entity)
            .sort((a, b) => b.weight - a.weight)
            .slice(0, maxResults)
            .map(e => {
            const other = e.from === entity ? e.to : e.from;
            return `${other} (${e.relation})`;
        });
        return [...new Set(related)];
    }
    getFrequent(topN = 10) {
        return [...this.graph.nodes]
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, topN);
    }
    buildContextString(_query) {
        const frequent = this.getFrequent(5);
        if (frequent.length === 0)
            return '';
        const lines = ['KNOWN ENTITIES:'];
        frequent.forEach(node => {
            const related = this.getRelated(node.name, 3);
            if (related.length > 0) {
                lines.push(`- ${node.name} (${node.type}) → ${related.join(', ')}`);
            }
            else {
                lines.push(`- ${node.name} (${node.type})`);
            }
        });
        return lines.join('\n');
    }
    getStats() {
        return {
            nodes: this.graph.nodes.length,
            edges: this.graph.edges.length,
        };
    }
}
exports.EntityGraph = EntityGraph;
exports.entityGraph = new EntityGraph();
