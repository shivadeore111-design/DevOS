// ============================================================
// devos/pilots/pilotRegistry.ts
// Loads, stores, and manages PilotManifest configs
// ============================================================

import fs   from "fs";
import path from "path";
import { PilotManifest } from "./types";

const PILOTS_DIR = path.join(process.cwd(), "config", "pilots");

export class PilotRegistry {
  private manifests: Map<string, PilotManifest> = new Map();

  constructor() {
    this._load();
  }

  // ── Load all JSON manifests from disk ──────────────────────
  private _load(): void {
    if (!fs.existsSync(PILOTS_DIR)) {
      fs.mkdirSync(PILOTS_DIR, { recursive: true });
      return;
    }
    const files = fs.readdirSync(PILOTS_DIR).filter(f => f.endsWith(".json"));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(PILOTS_DIR, file), "utf-8");
        const manifest = JSON.parse(raw) as PilotManifest;
        this.manifests.set(manifest.id, manifest);
      } catch (err: any) {
        console.warn(`[PilotRegistry] Failed to load ${file}: ${err.message}`);
      }
    }
    console.log(`[PilotRegistry] Loaded ${this.manifests.size} pilot(s)`);
  }

  // ── Accessors ─────────────────────────────────────────────

  get(id: string): PilotManifest | null {
    return this.manifests.get(id) ?? null;
  }

  list(): PilotManifest[] {
    return Array.from(this.manifests.values());
  }

  listEnabled(): PilotManifest[] {
    return this.list().filter(m => m.enabled);
  }

  // ── Mutations (persisted) ─────────────────────────────────

  enable(id: string): void {
    const manifest = this.manifests.get(id);
    if (!manifest) {
      console.warn(`[PilotRegistry] Pilot not found: ${id}`);
      return;
    }
    manifest.enabled = true;
    this._persist(manifest);
    console.log(`[PilotRegistry] ✅ Enabled pilot: ${id}`);
  }

  disable(id: string): void {
    const manifest = this.manifests.get(id);
    if (!manifest) {
      console.warn(`[PilotRegistry] Pilot not found: ${id}`);
      return;
    }
    manifest.enabled = false;
    this._persist(manifest);
    console.log(`[PilotRegistry] ⏸  Disabled pilot: ${id}`);
  }

  register(manifest: PilotManifest): void {
    this.manifests.set(manifest.id, manifest);
    this._persist(manifest);
    console.log(`[PilotRegistry] Registered pilot: ${manifest.id}`);
  }

  // ── Private: persist one manifest to its JSON file ────────

  private _persist(manifest: PilotManifest): void {
    const filePath = path.join(PILOTS_DIR, `${manifest.id}.json`);
    fs.mkdirSync(PILOTS_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), "utf-8");
  }
}

export const pilotRegistry = new PilotRegistry();
