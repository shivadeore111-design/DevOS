"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeKnowledge = analyzeKnowledge;
const knowledgeEngine_1 = require("../memory/knowledgeEngine");
function analyzeKnowledge() {
    const entries = (0, knowledgeEngine_1.getAllKnowledge)();
    const conceptCount = {};
    const domainCount = {};
    const riskCount = {};
    const opportunityCount = {};
    entries.forEach(entry => {
        entry.coreConcepts.forEach(c => {
            conceptCount[c.name] = (conceptCount[c.name] || 0) + 1;
        });
        entry.domains.forEach(d => {
            domainCount[d.name] = (domainCount[d.name] || 0) + 1;
        });
        entry.risks.forEach(r => {
            riskCount[r.name] = (riskCount[r.name] || 0) + 1;
        });
        entry.opportunities.forEach(o => {
            opportunityCount[o.name] = (opportunityCount[o.name] || 0) + 1;
        });
    });
    const sortByValue = (obj) => Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);
    const dominantConcepts = sortByValue(conceptCount).slice(0, 5);
    const dominantDomains = sortByValue(domainCount);
    const recurringRisks = sortByValue(riskCount).slice(0, 5);
    const highOpportunityAreas = sortByValue(opportunityCount).slice(0, 5);
    const underexploredDomains = dominantDomains
        .slice(-3); // least frequent domains
    return {
        dominantConcepts,
        underexploredDomains,
        recurringRisks,
        highOpportunityAreas
    };
}
