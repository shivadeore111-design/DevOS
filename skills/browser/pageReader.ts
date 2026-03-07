// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================

// @ts-ignore — playwright must be installed separately: npm install playwright
import { chromium } from "playwright";

export async function readPage(url: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { timeout: 30000 });

    await page.evaluate(() => {
      document.querySelectorAll("script, style, noscript")
        .forEach(el => el.remove());
    });

    const text = await page.evaluate(() => document.body.innerText);

    await browser.close();

    return text.slice(0, 8000);

  } catch (err) {
    await browser.close();
    return "";
  }
}