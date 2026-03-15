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
exports.ingestDocument = ingestDocument;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const localBrain_1 = require("../llm/localBrain");
const knowledgeEngine_1 = require("../memory/knowledgeEngine");
// Force correct access to pdf-parse function
const pdfModule = require("pdf-parse");
const pdfParse = pdfModule.default || pdfModule;
function chunkText(text, chunkSize = 3000) {
    const chunks = [];
    let index = 0;
    while (index < text.length) {
        chunks.push(text.slice(index, index + chunkSize));
        index += chunkSize;
    }
    return chunks;
}
async function extractStructuredKnowledge(topic, content) {
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
    const raw = await (0, localBrain_1.localLLM)(prompt);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match)
        throw new Error("No JSON returned");
    return JSON.parse(match[0]);
}
async function ingestDocument(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    let text = "";
    if (ext === ".pdf") {
        const buffer = fs_1.default.readFileSync(filePath);
        const data = await pdfParse(buffer);
        text = data.text;
    }
    else if (ext === ".txt" || ext === ".md") {
        text = fs_1.default.readFileSync(filePath, "utf-8");
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
            const knowledge = await extractStructuredKnowledge(path_1.default.basename(filePath) + ` - chunk ${i + 1}`, chunks[i]);
            (0, knowledgeEngine_1.addKnowledge)({
                topic: path_1.default.basename(filePath) + ` - chunk ${i + 1}`,
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
        }
        catch (err) {
            console.log(`Chunk ${i + 1} failed.`);
        }
    }
    console.log("Document ingestion complete.");
}
