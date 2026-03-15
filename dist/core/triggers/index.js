"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubTrigger = exports.webhookTrigger = exports.cronTrigger = void 0;
exports.startAllTriggers = startAllTriggers;
exports.stopAllTriggers = stopAllTriggers;
var cronTrigger_1 = require("./cronTrigger");
Object.defineProperty(exports, "cronTrigger", { enumerable: true, get: function () { return cronTrigger_1.cronTrigger; } });
var webhookTrigger_1 = require("./webhookTrigger");
Object.defineProperty(exports, "webhookTrigger", { enumerable: true, get: function () { return webhookTrigger_1.webhookTrigger; } });
var githubTrigger_1 = require("./githubTrigger");
Object.defineProperty(exports, "githubTrigger", { enumerable: true, get: function () { return githubTrigger_1.githubTrigger; } });
const cronTrigger_2 = require("./cronTrigger");
const webhookTrigger_2 = require("./webhookTrigger");
function startAllTriggers(webhookPort) {
    cronTrigger_2.cronTrigger.start();
    webhookTrigger_2.webhookTrigger.start(webhookPort);
    console.log("[Triggers] All triggers started");
}
function stopAllTriggers() {
    cronTrigger_2.cronTrigger.stop();
    webhookTrigger_2.webhookTrigger.stop();
    console.log("[Triggers] All triggers stopped");
}
