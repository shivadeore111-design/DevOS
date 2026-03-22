// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import fs from "fs";
import path from "path";
import { localLLM } from "../llm/localBrain";
import { addKnowledge } from "../memory/knowledgeEngine";

// Force correct access to pdf-parse function
const pdfModule = require("pdf-parse");
const pdfParse = pdfModule.default || pdfModule;

function chunkText(text: string, chunkSize = 3000): string[] {
  const chunks: string[] = [];
  let index = 0;

  while (index < text.length) {
    chunks.push(text.slice(index, index + chunkSize));
    index += chunkSize;
  }

  return chunks;
}

async function extractStructuredKnowledge(topic: string, content: string) {
  const prompt = `
Extract structured knowledge from the following content.

Return ONLY valid JSON:

{
  "summary": "concise summary",
  "coreConcepts": [],
  "toolsMentioned": [],
  "domains": [],
  "opportunities": [],
  "risks": [],
  "implementationIdeas": []
}

Content:
${content}
`;

  const raw = await localLLM(prompt);

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON returned");

  return JSON.parse(match[0]);
}

export async function ingestDocument(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  let text = "";

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    text = data.text;
  } 
  else if (ext === ".txt" || ext === ".md") {
    text = fs.readFileSync(filePath, "utf-8");
  } 
  else {
    throw new Error("Unsupported file type");
  }

  if (!text || text.trim().length === 0) {
    throw new Error("Document text extraction failed.");
  }

  const chunks = chunkText(text);

  console.log(`Document split into ${chunks.length} chunks.`);

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1}/${chunks.length}...`);

    try {
      const knowledge = await extractStructuredKnowledge(
        path.basename(filePath) + ` - chunk ${i + 1}`,
        chunks[i]
      );

      addKnowledge({
        topic: path.basename(filePath) + ` - chunk ${i + 1}`,
        summary: knowledge.summary,
        coreConcepts: knowledge.coreConcepts,
        toolsMentioned: knowledge.toolsMentioned,
        domains: knowledge.domains,
        opportunities: knowledge.opportunities,
        risks: knowledge.risks,
        implementationIdeas: knowledge.implementationIdeas,
        confidenceScore: 8
      });

      console.log(`Chunk ${i + 1} stored successfully.`);
    } catch (err) {
      console.log(`Chunk ${i + 1} failed.`);
    }
  }

  console.log("Document ingestion complete.");
}