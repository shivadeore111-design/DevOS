// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

import https from "https";

export class WebActions {
  async search(query: string): Promise<{ title: string; url: string }[]> {
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;

    return new Promise((resolve) => {
      https.get(apiUrl, (res) => {
        let data = "";

        res.on("data", chunk => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);

            const results: { title: string; url: string }[] = [];

            if (parsed.RelatedTopics && Array.isArray(parsed.RelatedTopics)) {
              parsed.RelatedTopics.forEach((item: any) => {
                if (item.Text && item.FirstURL && results.length < 5) {
                  results.push({
                    title: item.Text,
                    url: item.FirstURL
                  });
                }
              });
            }

            resolve(results);

          } catch {
            resolve([]);
          }
        });

      }).on("error", () => {
        resolve([]);
      });
    });
  }
}