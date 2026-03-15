"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addKnowledge = addKnowledge;
exports.getAllKnowledge = getAllKnowledge;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const knowledgePath = path_1.default.join(__dirname, "knowledgeBase.json");
function loadKnowledge() {
    if (!fs_1.default.existsSync(knowledgePath)) {
        return { entries: [] };
    }
    const raw = fs_1.default.readFileSync(knowledgePath, "utf-8");
    return JSON.parse(raw);
}
function saveKnowledge(data) {
    fs_1.default.writeFileSync(knowledgePath, JSON.stringify(data, null, 2));
}
function normalizeArray(arr) {
    if (!Array.isArray(arr))
        return [];
    return arr.map(item => {
        if (typeof item === "string") {
            return { name: item, description: "" };
        }
        if (typeof item === "object" && item !== null) {
            return {
                name: item.name || "",
                description: item.description || ""
            };
        }
        return { name: "", description: "" };
    });
}
function addKnowledge(entry) {
    const db = loadKnowledge();
    const exists = db.entries.some(e => e.topic === entry.topic);
    if (exists)
        return;
    const normalizedEntry = {
        ...entry,
        coreConcepts: normalizeArray(entry.coreConcepts),
        toolsMentioned: normalizeArray(entry.toolsMentioned),
        domains: normalizeArray(entry.domains),
        opportunities: normalizeArray(entry.opportunities),
        risks: normalizeArray(entry.risks),
        implementationIdeas: normalizeArray(entry.implementationIdeas),
        timestamp: new Date().toISOString()
    };
    db.entries.push(normalizedEntry);
    saveKnowledge(db);
}
function getAllKnowledge() {
    return loadKnowledge().entries;
}
