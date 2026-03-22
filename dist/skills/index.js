"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.skills = exports.terminal = exports.TerminalOperator = exports.costOptimizer = exports.CostOptimizer = exports.dependencyManager = exports.DependencyManager = exports.typescriptExpert = exports.TypeScriptExpert = exports.cleanCodeEnforcer = exports.CleanCodeEnforcer = exports.featureBuilder = exports.FeatureBuilder = exports.projectScaffolder = exports.ProjectScaffolder = exports.taskPlanner = exports.TaskPlanner = exports.scalabilityPlanner = exports.ScalabilityPlanner = exports.databaseDesigner = exports.DatabaseDesigner = exports.apiDesigner = exports.APIDesigner = exports.systemArchitect = exports.SystemArchitect = exports.skillRegistry = void 0;
// ============================================================
// skills/index.ts — Central Skill Registry
// Imports and registers all available DevOS skills.
// ============================================================
var registry_1 = require("./registry");
Object.defineProperty(exports, "skillRegistry", { enumerable: true, get: function () { return registry_1.skillRegistry; } });
// ── Browser ───────────────────────────────────────────────────
const browser_1 = require("./browser");
// ── Architecture ──────────────────────────────────────────────
const systemArchitect_1 = require("./architecture/systemArchitect");
const apiDesigner_1 = require("./architecture/apiDesigner");
const databaseDesigner_1 = require("./architecture/databaseDesigner");
const scalabilityPlanner_1 = require("./architecture/scalabilityPlanner");
// ── Planning ─────────────────────────────────────────────────
const taskPlanner_1 = require("./planning/taskPlanner");
const projectScaffolder_1 = require("./planning/projectScaffolder");
// ── Coding ───────────────────────────────────────────────────
const featureBuilder_1 = require("./coding/featureBuilder");
const cleanCodeEnforcer_1 = require("./coding/cleanCodeEnforcer");
const typescriptExpert_1 = require("./coding/typescriptExpert");
const dependencyManager_1 = require("./coding/dependencyManager");
// ── Performance ──────────────────────────────────────────────
const costOptimizer_1 = require("./performance/costOptimizer");
// ── Re-export named classes & instances ───────────────────────
var systemArchitect_2 = require("./architecture/systemArchitect");
Object.defineProperty(exports, "SystemArchitect", { enumerable: true, get: function () { return systemArchitect_2.SystemArchitect; } });
Object.defineProperty(exports, "systemArchitect", { enumerable: true, get: function () { return systemArchitect_2.systemArchitect; } });
var apiDesigner_2 = require("./architecture/apiDesigner");
Object.defineProperty(exports, "APIDesigner", { enumerable: true, get: function () { return apiDesigner_2.APIDesigner; } });
Object.defineProperty(exports, "apiDesigner", { enumerable: true, get: function () { return apiDesigner_2.apiDesigner; } });
var databaseDesigner_2 = require("./architecture/databaseDesigner");
Object.defineProperty(exports, "DatabaseDesigner", { enumerable: true, get: function () { return databaseDesigner_2.DatabaseDesigner; } });
Object.defineProperty(exports, "databaseDesigner", { enumerable: true, get: function () { return databaseDesigner_2.databaseDesigner; } });
var scalabilityPlanner_2 = require("./architecture/scalabilityPlanner");
Object.defineProperty(exports, "ScalabilityPlanner", { enumerable: true, get: function () { return scalabilityPlanner_2.ScalabilityPlanner; } });
Object.defineProperty(exports, "scalabilityPlanner", { enumerable: true, get: function () { return scalabilityPlanner_2.scalabilityPlanner; } });
var taskPlanner_2 = require("./planning/taskPlanner");
Object.defineProperty(exports, "TaskPlanner", { enumerable: true, get: function () { return taskPlanner_2.TaskPlanner; } });
Object.defineProperty(exports, "taskPlanner", { enumerable: true, get: function () { return taskPlanner_2.taskPlanner; } });
var projectScaffolder_2 = require("./planning/projectScaffolder");
Object.defineProperty(exports, "ProjectScaffolder", { enumerable: true, get: function () { return projectScaffolder_2.ProjectScaffolder; } });
Object.defineProperty(exports, "projectScaffolder", { enumerable: true, get: function () { return projectScaffolder_2.projectScaffolder; } });
var featureBuilder_2 = require("./coding/featureBuilder");
Object.defineProperty(exports, "FeatureBuilder", { enumerable: true, get: function () { return featureBuilder_2.FeatureBuilder; } });
Object.defineProperty(exports, "featureBuilder", { enumerable: true, get: function () { return featureBuilder_2.featureBuilder; } });
var cleanCodeEnforcer_2 = require("./coding/cleanCodeEnforcer");
Object.defineProperty(exports, "CleanCodeEnforcer", { enumerable: true, get: function () { return cleanCodeEnforcer_2.CleanCodeEnforcer; } });
Object.defineProperty(exports, "cleanCodeEnforcer", { enumerable: true, get: function () { return cleanCodeEnforcer_2.cleanCodeEnforcer; } });
var typescriptExpert_2 = require("./coding/typescriptExpert");
Object.defineProperty(exports, "TypeScriptExpert", { enumerable: true, get: function () { return typescriptExpert_2.TypeScriptExpert; } });
Object.defineProperty(exports, "typescriptExpert", { enumerable: true, get: function () { return typescriptExpert_2.typescriptExpert; } });
var dependencyManager_2 = require("./coding/dependencyManager");
Object.defineProperty(exports, "DependencyManager", { enumerable: true, get: function () { return dependencyManager_2.DependencyManager; } });
Object.defineProperty(exports, "dependencyManager", { enumerable: true, get: function () { return dependencyManager_2.dependencyManager; } });
var costOptimizer_2 = require("./performance/costOptimizer");
Object.defineProperty(exports, "CostOptimizer", { enumerable: true, get: function () { return costOptimizer_2.CostOptimizer; } });
Object.defineProperty(exports, "costOptimizer", { enumerable: true, get: function () { return costOptimizer_2.costOptimizer; } });
var terminalOperator_1 = require("./utils/terminalOperator");
Object.defineProperty(exports, "TerminalOperator", { enumerable: true, get: function () { return terminalOperator_1.TerminalOperator; } });
Object.defineProperty(exports, "terminal", { enumerable: true, get: function () { return terminalOperator_1.terminal; } });
// ── Registered skill list (for executor/index.ts lookup) ──────
const registry_2 = require("./registry");
const allSkills = [
    browser_1.browserSkill,
    systemArchitect_1.systemArchitect,
    apiDesigner_1.apiDesigner,
    databaseDesigner_1.databaseDesigner,
    scalabilityPlanner_1.scalabilityPlanner,
    taskPlanner_1.taskPlanner,
    projectScaffolder_1.projectScaffolder,
    featureBuilder_1.featureBuilder,
    cleanCodeEnforcer_1.cleanCodeEnforcer,
    typescriptExpert_1.typescriptExpert,
    dependencyManager_1.dependencyManager,
    costOptimizer_1.costOptimizer,
];
for (const skill of allSkills) {
    registry_2.skillRegistry.register(skill);
}
/** Flat array of all registered skill instances. */
exports.skills = allSkills;
