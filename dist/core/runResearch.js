"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
const researchAgent_1 = require("./researchAgent");
const topicGenerator_1 = require("./topicGenerator");
const controlEngine_1 = require("./controlEngine");
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function start() {
    const agent = new researchAgent_1.ResearchAgent();
    console.log("DevOS Research Mode Activated...\n");
    let cycle = 0;
    while (true) {
        const control = (0, controlEngine_1.shouldStop)(cycle);
        if (control.stop) {
            console.log("\nResearch halted:", control.reason);
            break;
        }
        const topic = await (0, topicGenerator_1.generateNextTopic)();
        console.log("Generated Topic:", topic);
        await agent.run(topic);
        cycle++;
        const delay = (0, controlEngine_1.calculateAdaptiveDelay)();
        console.log(`Waiting ${delay / 1000} seconds before next cycle...\n`);
        await sleep(delay);
    }
    console.log("DevOS session ended safely.");
}
start();
