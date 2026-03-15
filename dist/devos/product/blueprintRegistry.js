"use strict";
// ============================================================
// devos/product/blueprintRegistry.ts
// Loads blueprints from config/blueprints/, provides lookup + matching
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.blueprintRegistry = exports.BlueprintRegistry = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const BLUEPRINTS_DIR = path_1.default.join(process.cwd(), "config", "blueprints");
class BlueprintRegistry {
    constructor() {
        this.blueprints = new Map();
        this._load();
    }
    // ── Load all JSON blueprints from disk ─────────────────────
    _load() {
        if (!fs_1.default.existsSync(BLUEPRINTS_DIR))
            return;
        const files = fs_1.default.readdirSync(BLUEPRINTS_DIR).filter(f => f.endsWith(".json"));
        for (const file of files) {
            try {
                const raw = fs_1.default.readFileSync(path_1.default.join(BLUEPRINTS_DIR, file), "utf-8");
                const bp = JSON.parse(raw);
                this.blueprints.set(bp.id, bp);
            }
            catch (err) {
                console.warn(`[BlueprintRegistry] Failed to load ${file}: ${err.message}`);
            }
        }
        console.log(`[BlueprintRegistry] Loaded ${this.blueprints.size} blueprint(s)`);
    }
    // ── Get by id ──────────────────────────────────────────────
    get(id) {
        return this.blueprints.get(id) ?? null;
    }
    // ── List all ───────────────────────────────────────────────
    list() {
        return Array.from(this.blueprints.values());
    }
    // ── Register (runtime) ─────────────────────────────────────
    register(blueprint) {
        this.blueprints.set(blueprint.id, blueprint);
    }
    // ── Match blueprint to a parsed goal by stack overlap ──────
    // parsedGoal can have fields: stack[], tech[], type, domain, etc.
    match(parsedGoal) {
        // Collect candidate terms from the goal
        const goalTerms = new Set([
            ...(parsedGoal.stack ?? []),
            ...(parsedGoal.tech ?? []),
            ...(parsedGoal.technologies ?? []),
            parsedGoal.type,
            parsedGoal.domain,
            parsedGoal.goal ?? "",
        ]
            .filter(Boolean)
            .map((t) => String(t).toLowerCase()));
        // Also tokenise the raw goal string if present
        const rawGoal = parsedGoal.goal ?? parsedGoal.description ?? "";
        for (const word of rawGoal.toLowerCase().split(/\W+/)) {
            if (word.length > 2)
                goalTerms.add(word);
        }
        let bestMatch = null;
        let bestScore = 0;
        for (const bp of this.blueprints.values()) {
            // Stack values from blueprint
            const bpTerms = new Set(Object.values(bp.stack)
                .concat(bp.modules)
                .map(v => v.toLowerCase()));
            // Also allow matching on blueprint id / name words
            for (const word of (bp.name + " " + bp.id).toLowerCase().split(/\W+/)) {
                if (word.length > 2)
                    bpTerms.add(word);
            }
            // Overlap = |intersection| / |bpTerms|
            let hits = 0;
            for (const term of goalTerms) {
                if (bpTerms.has(term))
                    hits++;
            }
            const overlap = bpTerms.size > 0 ? hits / bpTerms.size : 0;
            if (overlap > bestScore) {
                bestScore = overlap;
                bestMatch = bp;
            }
        }
        // Only return match if overlap > 50%
        if (bestScore > 0.5) {
            console.log(`[BlueprintRegistry] Matched: ${bestMatch.id} (overlap: ${(bestScore * 100).toFixed(0)}%)`);
            return bestMatch;
        }
        // Fall back: check if any blueprint keyword appears literally in the goal string
        const lowerGoal = rawGoal.toLowerCase();
        for (const bp of this.blueprints.values()) {
            const keyTerms = [bp.id.replace(/_/g, " "), ...Object.values(bp.stack)];
            for (const term of keyTerms) {
                if (lowerGoal.includes(term.toLowerCase())) {
                    console.log(`[BlueprintRegistry] Keyword match: ${bp.id} (term: "${term}")`);
                    return bp;
                }
            }
        }
        return null;
    }
}
exports.BlueprintRegistry = BlueprintRegistry;
exports.blueprintRegistry = new BlueprintRegistry();
