"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResearchAgent = void 0;
const agentLoop_1 = require("./agentLoop");
const sessionManager_1 = require("./sessionManager");
const memoryEngine_1 = require("../memory/memoryEngine");
const reflectionEngine_1 = require("./reflectionEngine");
const pageReader_1 = require("../skills/browser/pageReader");
class ResearchAgent {
    constructor() {
        this.agent = new agentLoop_1.AgentLoop();
    }
    async run(topic) {
        console.log(`\nResearching: ${topic}\n`);
        try {
            const sess = sessionManager_1.sessionManager.create(`search ${topic}`, process.cwd());
            const searchResults = await this.agent.run(`search ${topic}`, sess.id);
            console.log("Search Results:", searchResults);
            let pageContent = "";
            if (Array.isArray(searchResults) &&
                searchResults.length > 0 &&
                searchResults[0].url) {
                console.log("Opening first result...");
                pageContent = await (0, pageReader_1.readPage)(searchResults[0].url);
            }
            (0, memoryEngine_1.appendMemory)("topicsResearched", topic);
            const reflection = await (0, reflectionEngine_1.reflectOnResearch)(topic, {
                searchResults,
                pageContent
            });
            console.log("\nUsefulness Score:", reflection.usefulnessScore);
            console.log("Confidence Score:", reflection.confidenceScore);
            console.log("Next Direction:", reflection.strategicDirection);
            console.log("\nDeep research stored successfully.\n");
        }
        catch (err) {
            (0, memoryEngine_1.appendMemory)("failures", {
                topic,
                error: err.message
            });
            console.log("Research failed and logged.\n");
        }
    }
}
exports.ResearchAgent = ResearchAgent;
