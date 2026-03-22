// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";

const knowledgePath = path.join(__dirname, "knowledgeBase.json");

type NamedItem = {
  name: string;
  description: string;
};

function normalizeArray(arr: any[]): NamedItem[] {
  if (!Array.isArray(arr)) return [];

  return arr.map(item => {
    if (typeof item === "string") {
      return {
        name: item,
        description: ""
      };
    }

    if (typeof item === "object" && item !== null) {
      return {
        name: item.name || "",
        description: item.description || ""
      };
    }

    return {
      name: "",
      description: ""
    };
  });
}

function normalizeKnowledge() {
  if (!fs.existsSync(knowledgePath)) {
    console.log("knowledgeBase.json not found.");
    return;
  }

  const raw = fs.readFileSync(knowledgePath, "utf-8");
  const data = JSON.parse(raw);

  data.entries = data.entries.map((entry: any) => ({
    ...entry,
    coreConcepts: normalizeArray(entry.coreConcepts),
    toolsMentioned: normalizeArray(entry.toolsMentioned),
    domains: normalizeArray(entry.domains),
    opportunities: normalizeArray(entry.opportunities),
    risks: normalizeArray(entry.risks),
    implementationIdeas: normalizeArray(entry.implementationIdeas)
  }));

  fs.writeFileSync(knowledgePath, JSON.stringify(data, null, 2));
  console.log("Knowledge normalized successfully.");
}

normalizeKnowledge();