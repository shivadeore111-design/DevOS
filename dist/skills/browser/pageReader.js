"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.readPage = readPage;
// @ts-ignore — playwright must be installed separately: npm install playwright
const playwright_1 = require("playwright");
async function readPage(url) {
    const browser = await playwright_1.chromium.launch({ headless: true });
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
    }
    catch (err) {
        await browser.close();
        return "";
    }
}
