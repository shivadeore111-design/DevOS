// ============================================================
// devos/product/blueprintRegistry.ts
// Loads blueprints from config/blueprints/, provides lookup + matching
// ============================================================

import fs   from "fs";
import path from "path";

export interface BlueprintStep {
  order:       number;
  module:      string;
  action:      string;
  description: string;
}

export interface Blueprint {
  id:              string;
  name:            string;
  description:     string;
  version:         string;
  modules:         string[];
  stack:           Record<string, string>;
  steps:           BlueprintStep[];
  successCriteria: string[];
}

const BLUEPRINTS_DIR = path.join(process.cwd(), "config", "blueprints");

export class BlueprintRegistry {
  private blueprints: Map<string, Blueprint> = new Map();

  constructor() {
    this._load();
  }

  // ── Load all JSON blueprints from disk ─────────────────────
  private _load(): void {
    if (!fs.existsSync(BLUEPRINTS_DIR)) return;

    const files = fs.readdirSync(BLUEPRINTS_DIR).filter(f => f.endsWith(".json"));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(BLUEPRINTS_DIR, file), "utf-8");
        const bp  = JSON.parse(raw) as Blueprint;
        this.blueprints.set(bp.id, bp);
      } catch (err: any) {
        console.warn(`[BlueprintRegistry] Failed to load ${file}: ${err.message}`);
      }
    }
    console.log(`[BlueprintRegistry] Loaded ${this.blueprints.size} blueprint(s)`);
  }

  // ── Get by id ──────────────────────────────────────────────
  get(id: string): Blueprint | null {
    return this.blueprints.get(id) ?? null;
  }

  // ── List all ───────────────────────────────────────────────
  list(): Blueprint[] {
    return Array.from(this.blueprints.values());
  }

  // ── Register (runtime) ─────────────────────────────────────
  register(blueprint: Blueprint): void {
    this.blueprints.set(blueprint.id, blueprint);
  }

  // ── Match blueprint to a parsed goal by stack overlap ──────
  // parsedGoal can have fields: stack[], tech[], type, domain, etc.
  match(parsedGoal: any): Blueprint | null {
    // Collect candidate terms from the goal
    const goalTerms = new Set<string>(
      [
        ...(parsedGoal.stack          ?? []),
        ...(parsedGoal.tech           ?? []),
        ...(parsedGoal.technologies   ?? []),
        parsedGoal.type,
        parsedGoal.domain,
        parsedGoal.goal ?? "",
      ]
        .filter(Boolean)
        .map((t: string) => String(t).toLowerCase())
    );

    // Also tokenise the raw goal string if present
    const rawGoal: string = parsedGoal.goal ?? parsedGoal.description ?? "";
    for (const word of rawGoal.toLowerCase().split(/\W+/)) {
      if (word.length > 2) goalTerms.add(word);
    }

    let bestMatch: Blueprint | null  = null;
    let bestScore                    = 0;

    for (const bp of this.blueprints.values()) {
      // Stack values from blueprint
      const bpTerms = new Set<string>(
        Object.values(bp.stack)
          .concat(bp.modules)
          .map(v => v.toLowerCase())
      );

      // Also allow matching on blueprint id / name words
      for (const word of (bp.name + " " + bp.id).toLowerCase().split(/\W+/)) {
        if (word.length > 2) bpTerms.add(word);
      }

      // Overlap = |intersection| / |bpTerms|
      let hits = 0;
      for (const term of goalTerms) {
        if (bpTerms.has(term)) hits++;
      }
      const overlap = bpTerms.size > 0 ? hits / bpTerms.size : 0;

      if (overlap > bestScore) {
        bestScore = overlap;
        bestMatch = bp;
      }
    }

    // Only return match if overlap > 50%
    if (bestScore > 0.5) {
      console.log(`[BlueprintRegistry] Matched: ${bestMatch!.id} (overlap: ${(bestScore * 100).toFixed(0)}%)`);
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

export const blueprintRegistry = new BlueprintRegistry();
