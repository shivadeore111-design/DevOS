"use strict";
// ============================================================
// devos/product/productManager.ts
// Tracks product build state, persists to workspace/products.json
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productManager = exports.ProductManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const PRODUCTS_FILE = path_1.default.join(process.cwd(), "workspace", "products.json");
function makeId() {
    return "pb_" + Math.random().toString(36).slice(2, 9);
}
class ProductManager {
    constructor() {
        this.builds = new Map();
        this._load();
    }
    // ── Persistence ───────────────────────────────────────────
    _load() {
        try {
            if (!fs_1.default.existsSync(PRODUCTS_FILE))
                return;
            const raw = JSON.parse(fs_1.default.readFileSync(PRODUCTS_FILE, "utf-8"));
            for (const b of raw) {
                b.startedAt = new Date(b.startedAt);
                if (b.completedAt)
                    b.completedAt = new Date(b.completedAt);
                this.builds.set(b.id, b);
            }
            console.log(`[ProductManager] Loaded ${this.builds.size} product build(s)`);
        }
        catch { /* first run */ }
    }
    _persist() {
        const dir = path_1.default.dirname(PRODUCTS_FILE);
        fs_1.default.mkdirSync(dir, { recursive: true });
        fs_1.default.writeFileSync(PRODUCTS_FILE, JSON.stringify(Array.from(this.builds.values()), null, 2), "utf-8");
    }
    // ── CRUD ──────────────────────────────────────────────────
    create(goal, blueprintId, workspacePath) {
        const build = {
            id: makeId(),
            blueprintId,
            goal,
            workspacePath,
            status: "planning",
            modulesCompleted: [],
            modulesFailed: [],
            startedAt: new Date(),
        };
        this.builds.set(build.id, build);
        this._persist();
        console.log(`[ProductManager] Created build: ${build.id} (${blueprintId})`);
        return build;
    }
    get(id) {
        return this.builds.get(id) ?? null;
    }
    list() {
        return Array.from(this.builds.values()).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    }
    updateStatus(id, status) {
        const build = this.builds.get(id);
        if (!build)
            return;
        build.status = status;
        if (status === "completed" || status === "failed") {
            build.completedAt = new Date();
        }
        this._persist();
    }
    recordModule(id, module, success) {
        const build = this.builds.get(id);
        if (!build)
            return;
        if (success) {
            if (!build.modulesCompleted.includes(module))
                build.modulesCompleted.push(module);
        }
        else {
            if (!build.modulesFailed.includes(module))
                build.modulesFailed.push(module);
        }
        this._persist();
    }
}
exports.ProductManager = ProductManager;
exports.productManager = new ProductManager();
