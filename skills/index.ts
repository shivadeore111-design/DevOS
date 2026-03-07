// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

export interface Skill {
  name: string;
  description: string;
  execute: (args: any) => Promise<any>;
}

import { browserSkill } from "./browser";
// import other skills here

export const skills: Skill[] = [
  browserSkill
];