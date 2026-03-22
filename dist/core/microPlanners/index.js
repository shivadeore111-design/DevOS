"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResearchTopicPlanner = exports.researchTopicPlanner = exports.DockerDeployerPlanner = exports.dockerDeployerPlanner = exports.NodeDebuggerPlanner = exports.nodeDebuggerPlanner = exports.WebAppBuilderPlanner = exports.webAppBuilderPlanner = exports.ApiBuilderPlanner = exports.apiBuilderPlanner = exports.microPlanners = void 0;
exports.getMicroPlanner = getMicroPlanner;
// core/microPlanners/index.ts — Registry of all micro-planners
const apiBuilder_1 = require("./apiBuilder");
Object.defineProperty(exports, "apiBuilderPlanner", { enumerable: true, get: function () { return apiBuilder_1.apiBuilderPlanner; } });
Object.defineProperty(exports, "ApiBuilderPlanner", { enumerable: true, get: function () { return apiBuilder_1.ApiBuilderPlanner; } });
const webAppBuilder_1 = require("./webAppBuilder");
Object.defineProperty(exports, "webAppBuilderPlanner", { enumerable: true, get: function () { return webAppBuilder_1.webAppBuilderPlanner; } });
Object.defineProperty(exports, "WebAppBuilderPlanner", { enumerable: true, get: function () { return webAppBuilder_1.WebAppBuilderPlanner; } });
const nodeDebugger_1 = require("./nodeDebugger");
Object.defineProperty(exports, "nodeDebuggerPlanner", { enumerable: true, get: function () { return nodeDebugger_1.nodeDebuggerPlanner; } });
Object.defineProperty(exports, "NodeDebuggerPlanner", { enumerable: true, get: function () { return nodeDebugger_1.NodeDebuggerPlanner; } });
const dockerDeployer_1 = require("./dockerDeployer");
Object.defineProperty(exports, "dockerDeployerPlanner", { enumerable: true, get: function () { return dockerDeployer_1.dockerDeployerPlanner; } });
Object.defineProperty(exports, "DockerDeployerPlanner", { enumerable: true, get: function () { return dockerDeployer_1.DockerDeployerPlanner; } });
const researchTopic_1 = require("./researchTopic");
Object.defineProperty(exports, "researchTopicPlanner", { enumerable: true, get: function () { return researchTopic_1.researchTopicPlanner; } });
Object.defineProperty(exports, "ResearchTopicPlanner", { enumerable: true, get: function () { return researchTopic_1.ResearchTopicPlanner; } });
// ── Registry ──────────────────────────────────────────────────
exports.microPlanners = {
    apiBuilder: apiBuilder_1.apiBuilderPlanner,
    webAppBuilder: webAppBuilder_1.webAppBuilderPlanner,
    nodeDebugger: nodeDebugger_1.nodeDebuggerPlanner,
    dockerDeployer: dockerDeployer_1.dockerDeployerPlanner,
    researchTopic: researchTopic_1.researchTopicPlanner,
};
/** Return a micro-planner by name, or undefined if not found */
function getMicroPlanner(name) {
    return exports.microPlanners[name];
}
