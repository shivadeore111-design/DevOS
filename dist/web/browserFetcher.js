"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserFetcher = exports.BrowserFetcher = void 0;
// web/browserFetcher.ts — Playwright-based headless browser fetcher with
//                          stealth, fingerprint spoofing, and persistent browser.
const stealthPlugin_1 = require("./stealthPlugin");
const fingerprintSpoofer_1 = require("./fingerprintSpoofer");
const DEFAULT_TIMEOUT = 20000;
const MAX_CONTENT_CHARS = 8000;
const MAX_CONCURRENT = 3;
class BrowserFetcher {
    constructor() {
        this.browser = null;
        this._launching = false;
        this._launchQueue = [];
    }
    /**
     * Returns the shared Chromium browser, launching it once if needed.
     * Concurrent callers wait for the single launch to finish.
     */
    async getBrowser() {
        if (this.browser)
            return this.browser;
        // If already launching, queue up
        if (this._launching) {
            return new Promise((resolve, reject) => {
                this._launchQueue.push({ resolve, reject });
            });
        }
        this._launching = true;
        let playwright;
        try {
            playwright = require("playwright");
        }
        catch (e) {
            this._launching = false;
            const err = new Error("Playwright is not installed. Run: npm install playwright && npx playwright install chromium");
            for (const waiter of this._launchQueue)
                waiter.reject(err);
            this._launchQueue = [];
            throw err;
        }
        try {
            this.browser = await playwright.chromium.launch({
                headless: true,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-infobars",
                    "--window-size=1920,1080",
                ],
            });
            // Register exit handler once
            process.on("exit", () => { this.close().catch(() => { }); });
            for (const waiter of this._launchQueue)
                waiter.resolve(this.browser);
            this._launchQueue = [];
            this._launching = false;
            return this.browser;
        }
        catch (err) {
            this._launching = false;
            for (const waiter of this._launchQueue)
                waiter.reject(err);
            this._launchQueue = [];
            throw err;
        }
    }
    /** Closes the shared browser instance. Safe to call multiple times. */
    async close() {
        if (this.browser) {
            try {
                await this.browser.close();
            }
            catch { /* ignore */ }
            this.browser = null;
            this._launching = false;
        }
    }
    /**
     * Fetch a single URL. Creates a new context + page from the shared browser,
     * applies stealth + random fingerprint, extracts title + text, then closes context.
     */
    async fetch(url, options = {}) {
        const timeout = options.timeout ?? DEFAULT_TIMEOUT;
        let browser;
        try {
            browser = await this.getBrowser();
        }
        catch (err) {
            return { success: false, url, error: err.message };
        }
        const fp = fingerprintSpoofer_1.fingerprintSpoofer.getRandomFingerprint();
        let context = null;
        try {
            context = await browser.newContext({
                userAgent: fp.userAgent,
                viewport: fp.viewport,
                locale: fp.locale,
                timezoneId: fp.timezone,
                colorScheme: fp.colorScheme,
                deviceScaleFactor: fp.deviceScaleFactor,
                ignoreHTTPSErrors: true,
            });
            const page = await context.newPage();
            await stealthPlugin_1.stealthPlugin.applyToPage(page);
            const response = await page.goto(url, {
                waitUntil: options.waitFor ?? "domcontentloaded",
                timeout,
            });
            const statusCode = response?.status() ?? 0;
            const title = await page.title();
            const text = (await page.evaluate(() => document.body?.innerText ?? "")).slice(0, MAX_CONTENT_CHARS);
            const html = await page.content();
            await context.close();
            return { success: true, url, title, text, html, statusCode };
        }
        catch (err) {
            if (context) {
                try {
                    await context.close();
                }
                catch { /* ignore */ }
            }
            // If browser crashed, clear it so next call relaunches
            try {
                await browser.isConnected();
            }
            catch {
                this.browser = null;
            }
            return { success: false, url, error: err.message };
        }
    }
    /**
     * Fetch multiple URLs in parallel with a concurrency cap of MAX_CONCURRENT.
     * All fetches share the same browser instance.
     */
    async fetchMultiple(urls) {
        const results = new Array(urls.length);
        const queue = urls.map((url, i) => ({ url, i }));
        const worker = async () => {
            while (queue.length > 0) {
                const item = queue.shift();
                if (!item)
                    return;
                results[item.i] = await this.fetch(item.url);
            }
        };
        const workers = Array.from({ length: Math.min(MAX_CONCURRENT, urls.length) }, worker);
        await Promise.all(workers);
        return results;
    }
}
exports.BrowserFetcher = BrowserFetcher;
exports.browserFetcher = new BrowserFetcher();
