// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// ============================================================
// skills/index.ts — Central Skill Registry
// Imports and registers all available DevOS skills.
// ============================================================

export { Skill, skillRegistry } from "./registry";

// ── Browser ───────────────────────────────────────────────────
import { browserSkill }          from "./browser";

// ── Architecture ──────────────────────────────────────────────
import { systemArchitect }       from "./architecture/systemArchitect";
import { apiDesigner }           from "./architecture/apiDesigner";
import { databaseDesigner }      from "./architecture/databaseDesigner";
import { scalabilityPlanner }    from "./architecture/scalabilityPlanner";

// ── Planning ─────────────────────────────────────────────────
import { taskPlanner }           from "./planning/taskPlanner";
import { projectScaffolder }     from "./planning/projectScaffolder";

// ── Coding ───────────────────────────────────────────────────
import { featureBuilder }        from "./coding/featureBuilder";
import { cleanCodeEnforcer }     from "./coding/cleanCodeEnforcer";
import { typescriptExpert }      from "./coding/typescriptExpert";
import { dependencyManager }     from "./coding/dependencyManager";

// ── Performance ──────────────────────────────────────────────
import { costOptimizer }         from "./performance/costOptimizer";

// ── Re-export named classes & instances ───────────────────────
export { SystemArchitect,    systemArchitect    } from "./architecture/systemArchitect";
export { APIDesigner,        apiDesigner        } from "./architecture/apiDesigner";
export { DatabaseDesigner,   databaseDesigner   } from "./architecture/databaseDesigner";
export { ScalabilityPlanner, scalabilityPlanner } from "./architecture/scalabilityPlanner";
export { TaskPlanner,        taskPlanner        } from "./planning/taskPlanner";
export { ProjectScaffolder,  projectScaffolder  } from "./planning/projectScaffolder";
export { FeatureBuilder,     featureBuilder     } from "./coding/featureBuilder";
export { CleanCodeEnforcer,  cleanCodeEnforcer  } from "./coding/cleanCodeEnforcer";
export { TypeScriptExpert,   typescriptExpert   } from "./coding/typescriptExpert";
export { DependencyManager,  dependencyManager  } from "./coding/dependencyManager";
export { CostOptimizer,      costOptimizer      } from "./performance/costOptimizer";
export { TerminalOperator,   terminal           } from "./utils/terminalOperator";

// ── Registered skill list (for executor/index.ts lookup) ──────
import { skillRegistry } from "./registry";

const allSkills = [
  browserSkill,
  systemArchitect,
  apiDesigner,
  databaseDesigner,
  scalabilityPlanner,
  taskPlanner,
  projectScaffolder,
  featureBuilder,
  cleanCodeEnforcer,
  typescriptExpert,
  dependencyManager,
  costOptimizer,
];

for (const skill of allSkills) {
  skillRegistry.register(skill);
}

/** Flat array of all registered skill instances. */
export const skills = allSkills;
