// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import { AgentLoop } from "./agentLoop";
import { sessionManager } from "./sessionManager";
import { appendMemory } from "../memory/memoryEngine";
import { reflectOnResearch } from "./reflectionEngine";
import { readPage } from "../skills/browser/pageReader";

export class ResearchAgent {
  private agent = new AgentLoop();

  async run(topic: string) {
    console.log(`\nResearching: ${topic}\n`);

    try {
      const sess = sessionManager.create(`search ${topic}`, process.cwd());
      const searchResults = await this.agent.run(`search ${topic}`, sess.id);

      console.log("Search Results:", searchResults);

      let pageContent = "";

      if (
        Array.isArray(searchResults) &&
        searchResults.length > 0 &&
        searchResults[0].url
      ) {
        console.log("Opening first result...");
        pageContent = await readPage(searchResults[0].url);
      }

      appendMemory("topicsResearched", topic);

      const reflection = await reflectOnResearch(
        topic,
        {
          searchResults,
          pageContent
        }
      );

      console.log("\nUsefulness Score:", reflection.usefulnessScore);
      console.log("Confidence Score:", reflection.confidenceScore);
      console.log("Next Direction:", reflection.strategicDirection);

      console.log("\nDeep research stored successfully.\n");

    } catch (err: any) {
      appendMemory("failures", {
        topic,
        error: err.message
      });

      console.log("Research failed and logged.\n");
    }
  }
}