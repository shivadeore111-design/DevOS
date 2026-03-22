// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// core/microPlanners/index.ts — Registry of all micro-planners

import { apiBuilderPlanner,    ApiBuilderPlanner    } from "./apiBuilder"
import { webAppBuilderPlanner, WebAppBuilderPlanner } from "./webAppBuilder"
import { nodeDebuggerPlanner,  NodeDebuggerPlanner  } from "./nodeDebugger"
import { dockerDeployerPlanner,DockerDeployerPlanner} from "./dockerDeployer"
import { researchTopicPlanner, ResearchTopicPlanner } from "./researchTopic"
import { ParsedGoal }                                 from "../goalParser"

// ── Shared interface every micro-planner must satisfy ─────────

export interface MicroPlanner {
  canHandle(parsedGoal: ParsedGoal): boolean
  buildPlan(parsedGoal: ParsedGoal): any
}

// ── Registry ──────────────────────────────────────────────────

export const microPlanners: Record<string, MicroPlanner> = {
  apiBuilder:    apiBuilderPlanner,
  webAppBuilder: webAppBuilderPlanner,
  nodeDebugger:  nodeDebuggerPlanner,
  dockerDeployer: dockerDeployerPlanner,
  researchTopic: researchTopicPlanner,
}

/** Return a micro-planner by name, or undefined if not found */
export function getMicroPlanner(name: string): MicroPlanner | undefined {
  return microPlanners[name]
}

// Re-export planner classes for direct use
export {
  apiBuilderPlanner,    ApiBuilderPlanner,
  webAppBuilderPlanner, WebAppBuilderPlanner,
  nodeDebuggerPlanner,  NodeDebuggerPlanner,
  dockerDeployerPlanner,DockerDeployerPlanner,
  researchTopicPlanner, ResearchTopicPlanner,
}
