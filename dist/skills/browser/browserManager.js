"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// Unauthorized copying, distribution, or modification
// of this software is strictly prohibited.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserManager = void 0;
// @ts-ignore — playwright must be installed separately: npm install playwright
const playwright_1 = require("playwright");
class BrowserManager {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
    }
    async start(headless = false) {
        this.browser = await playwright_1.chromium.launch({ headless });
        this.context = await this.browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36"
        });
        this.page = await this.context.newPage();
    }
    async goto(url) {
        if (!this.page)
            throw new Error("Browser not started");
        await this.page.goto(url, { timeout: 60000 });
    }
    async type(selector, text) {
        if (!this.page)
            throw new Error("Browser not started");
        await this.page.fill(selector, text);
    }
    async press(key) {
        if (!this.page)
            throw new Error("Browser not started");
        await this.page.keyboard.press(key);
    }
    async getAllText(selector) {
        if (!this.page)
            throw new Error("Browser not started");
        return await this.page.locator(selector).allInnerTexts();
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
        }
    }
}
exports.BrowserManager = BrowserManager;
