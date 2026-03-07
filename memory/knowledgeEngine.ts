// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";

const knowledgePath = path.join(__dirname, "knowledgeBase.json");

export type NamedItem = {
  name: string;
  description: string;
};

export interface KnowledgeEntryInput {
  topic: string;
  summary: string;
  coreConcepts: NamedItem[];
  toolsMentioned: NamedItem[];
  domains: NamedItem[];
  opportunities: NamedItem[];
  risks: NamedItem[];
  implementationIdeas: NamedItem[];
  confidenceScore: number;
}

interface KnowledgeEntryStored extends KnowledgeEntryInput {
  timestamp: string;
}

function loadKnowledge(): { entries: KnowledgeEntryStored[] } {
  if (!fs.existsSync(knowledgePath)) {
    return { entries: [] };
  }

  const raw = fs.readFileSync(knowledgePath, "utf-8");
  return JSON.parse(raw);
}

function saveKnowledge(data: { entries: KnowledgeEntryStored[] }) {
  fs.writeFileSync(knowledgePath, JSON.stringify(data, null, 2));
}

function normalizeArray(arr: any[]): NamedItem[] {
  if (!Array.isArray(arr)) return [];

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

export function addKnowledge(entry: KnowledgeEntryInput) {
  const db = loadKnowledge();

  const exists = db.entries.some(e => e.topic === entry.topic);
  if (exists) return;

  const normalizedEntry: KnowledgeEntryStored = {
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

export function getAllKnowledge(): KnowledgeEntryStored[] {
  return loadKnowledge().entries;
}