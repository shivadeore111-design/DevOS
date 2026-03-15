"use strict";
// ============================================================
// devos/pilots/pilotRegistry.ts
// Loads, stores, and manages PilotManifest configs
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pilotRegistry = exports.PilotRegistry = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const PILOTS_DIR = path_1.default.join(process.cwd(), "config", "pilots");
class PilotRegistry {
    constructor() {
        this.manifests = new Map();
        this._load();
    }
    // ── Load all JSON manifests from disk ──────────────────────
    _load() {
        if (!fs_1.default.existsSync(PILOTS_DIR)) {
            fs_1.default.mkdirSync(PILOTS_DIR, { recursive: true });
            return;
        }
        const files = fs_1.default.readdirSync(PILOTS_DIR).filter(f => f.endsWith(".json"));
        for (const file of files) {
            try {
                const raw = fs_1.default.readFileSync(path_1.default.join(PILOTS_DIR, file), "utf-8");
                const manifest = JSON.parse(raw);
                this.manifests.set(manifest.id, manifest);
            }
            catch (err) {
                console.warn(`[PilotRegistry] Failed to load ${file}: ${err.message}`);
            }
        }
        console.log(`[PilotRegistry] Loaded ${this.manifests.size} pilot(s)`);
    }
    // ── Accessors ─────────────────────────────────────────────
    get(id) {
        return this.manifests.get(id) ?? null;
    }
    list() {
        return Array.from(this.manifests.values());
    }
    listEnabled() {
        return this.list().filter(m => m.enabled);
    }
    // ── Mutations (persisted) ─────────────────────────────────
    enable(id) {
        const manifest = this.manifests.get(id);
        if (!manifest) {
            console.warn(`[PilotRegistry] Pilot not found: ${id}`);
            return;
        }
        manifest.enabled = true;
        this._persist(manifest);
        console.log(`[PilotRegistry] ✅ Enabled pilot: ${id}`);
    }
    disable(id) {
        const manifest = this.manifests.get(id);
        if (!manifest) {
            console.warn(`[PilotRegistry] Pilot not found: ${id}`);
            return;
        }
        manifest.enabled = false;
        this._persist(manifest);
        console.log(`[PilotRegistry] ⏸  Disabled pilot: ${id}`);
    }
    register(manifest) {
        this.manifests.set(manifest.id, manifest);
        this._persist(manifest);
        console.log(`[PilotRegistry] Registered pilot: ${manifest.id}`);
    }
    // ── Private: persist one manifest to its JSON file ────────
    _persist(manifest) {
        const filePath = path_1.default.join(PILOTS_DIR, `${manifest.id}.json`);
        fs_1.default.mkdirSync(PILOTS_DIR, { recursive: true });
        fs_1.default.writeFileSync(filePath, JSON.stringify(manifest, null, 2), "utf-8");
    }
}
exports.PilotRegistry = PilotRegistry;
exports.pilotRegistry = new PilotRegistry();
