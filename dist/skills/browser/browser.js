"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserSkill = void 0;
const webActions_1 = require("./webActions");
exports.browserSkill = {
    name: "web.search",
    description: "Search the web using DuckDuckGo and return titles with URLs",
    execute: async (args) => {
        const web = new webActions_1.WebActions();
        return await web.search(args.query);
    }
};
