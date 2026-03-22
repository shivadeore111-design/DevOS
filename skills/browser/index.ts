// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { WebActions } from "./webActions";

export const browserSkill = {
  name: "web.search",
  description: "Search the web using DuckDuckGo",
  execute: async (args: { query: string }) => {
    const web = new WebActions();
    return await web.search(args.query);
  }
};