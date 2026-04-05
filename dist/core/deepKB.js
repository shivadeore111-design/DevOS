"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepKB = exports.DeepKB = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class DeepKB {
    constructor() {
        this.graph = new Map();
        this.nodes = new Map();
        this.graphPath = path_1.default.join(process.cwd(), 'workspace', 'knowledge', 'deep-graph.json');
        this.load();
    }
    addEntity(id, name, type) {
        this.nodes.set(id, { id, name, type });
        this.save();
    }
    addRelation(fromId, toId, relation, weight = 1.0) {
        if (!this.graph.has(fromId))
            this.graph.set(fromId, []);
        this.graph.get(fromId).push({ fromId, toId, relation, weight });
        this.save();
    }
    // Expand context around a query result — 2 hops max
    expand(startId, depth = 2) {
        const visited = new Set();
        const results = [];
        const dfs = (nodeId, d, rel) => {
            if (d === 0 || visited.has(nodeId))
                return;
            visited.add(nodeId);
            const node = this.nodes.get(nodeId);
            if (node && nodeId !== startId) {
                results.push({ ...node, relation: rel, distance: depth - d + 1 });
            }
            for (const edge of this.graph.get(nodeId) || []) {
                dfs(edge.toId, d - 1, edge.relation);
            }
        };
        dfs(startId, depth, '');
        return results.sort((a, b) => a.distance - b.distance);
    }
    // Auto-extract entities from KB search results and build graph
    ingestFromKBResult(text, sourceId) {
        // Extract capitalized multi-word entities (companies, people, places)
        const entities = text.match(/[A-Z][a-z]+ (?:[A-Z][a-z]+ )*[A-Z][a-z]+|[A-Z]{2,}/g) || [];
        for (const entity of [...new Set(entities)].slice(0, 10)) {
            const entityId = entity.toLowerCase().replace(/\s+/g, '_');
            this.addEntity(entityId, entity, 'extracted');
            this.addRelation(sourceId, entityId, 'mentions', 0.5);
        }
    }
    save() {
        try {
            fs_1.default.mkdirSync(path_1.default.dirname(this.graphPath), { recursive: true });
            fs_1.default.writeFileSync(this.graphPath, JSON.stringify({
                nodes: Object.fromEntries(this.nodes),
                edges: Object.fromEntries(this.graph),
            }, null, 2));
        }
        catch { }
    }
    load() {
        try {
            if (!fs_1.default.existsSync(this.graphPath))
                return;
            const data = JSON.parse(fs_1.default.readFileSync(this.graphPath, 'utf-8'));
            this.nodes = new Map(Object.entries(data.nodes || {}));
            this.graph = new Map(Object.entries(data.edges || {}));
        }
        catch { }
    }
}
exports.DeepKB = DeepKB;
exports.deepKB = new DeepKB();
