// ============================================================
// devos/product/productManager.ts
// Tracks product build state, persists to workspace/products.json
// ============================================================

import fs   from "fs";
import path from "path";

export interface ProductBuild {
  id:               string;
  blueprintId:      string;
  goal:             string;
  workspacePath:    string;
  status:           "planning" | "building" | "testing" | "completed" | "failed";
  modulesCompleted: string[];
  modulesFailed:    string[];
  startedAt:        Date;
  completedAt?:     Date;
}

const PRODUCTS_FILE = path.join(process.cwd(), "workspace", "products.json");

function makeId(): string {
  return "pb_" + Math.random().toString(36).slice(2, 9);
}

export class ProductManager {
  private builds: Map<string, ProductBuild> = new Map();

  constructor() {
    this._load();
  }

  // ── Persistence ───────────────────────────────────────────

  private _load(): void {
    try {
      if (!fs.existsSync(PRODUCTS_FILE)) return;
      const raw: any[] = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
      for (const b of raw) {
        b.startedAt   = new Date(b.startedAt);
        if (b.completedAt) b.completedAt = new Date(b.completedAt);
        this.builds.set(b.id, b as ProductBuild);
      }
      console.log(`[ProductManager] Loaded ${this.builds.size} product build(s)`);
    } catch { /* first run */ }
  }

  private _persist(): void {
    const dir = path.dirname(PRODUCTS_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(
      Array.from(this.builds.values()), null, 2
    ), "utf-8");
  }

  // ── CRUD ──────────────────────────────────────────────────

  create(goal: string, blueprintId: string, workspacePath: string): ProductBuild {
    const build: ProductBuild = {
      id:               makeId(),
      blueprintId,
      goal,
      workspacePath,
      status:           "planning",
      modulesCompleted: [],
      modulesFailed:    [],
      startedAt:        new Date(),
    };
    this.builds.set(build.id, build);
    this._persist();
    console.log(`[ProductManager] Created build: ${build.id} (${blueprintId})`);
    return build;
  }

  get(id: string): ProductBuild | null {
    return this.builds.get(id) ?? null;
  }

  list(): ProductBuild[] {
    return Array.from(this.builds.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  updateStatus(id: string, status: ProductBuild["status"]): void {
    const build = this.builds.get(id);
    if (!build) return;
    build.status = status;
    if (status === "completed" || status === "failed") {
      build.completedAt = new Date();
    }
    this._persist();
  }

  recordModule(id: string, module: string, success: boolean): void {
    const build = this.builds.get(id);
    if (!build) return;
    if (success) {
      if (!build.modulesCompleted.includes(module)) build.modulesCompleted.push(module);
    } else {
      if (!build.modulesFailed.includes(module)) build.modulesFailed.push(module);
    }
    this._persist();
  }
}

export const productManager = new ProductManager();
