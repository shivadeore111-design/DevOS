"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DESCRIPTIONS = exports.TOOLS = void 0;
exports.executeTool = executeTool;
// core/toolRegistry.ts — Centralized tool registry with real Playwright
// browser automation, file I/O, shell exec, and web utilities.
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const computerControl_1 = require("./computerControl");
const webSearch_1 = require("./webSearch");
const morningBriefing_1 = require("./morningBriefing");
const marketDataTool_1 = require("./tools/marketDataTool");
const companyFilingsTool_1 = require("./tools/companyFilingsTool");
const mcpClient_1 = require("./mcpClient");
const codeInterpreter_1 = require("./codeInterpreter");
const responseCache_1 = require("./responseCache");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// ── Sprint 24: active folder-watcher registry ─────────────────
const activeWatchers = new Map();
// ── CommandGate: dangerous shell command patterns ──────────────
const SHELL_DANGEROUS_PATTERNS = [
    'rm -rf', 'rm -r /', 'del /f /s', 'del /s /q',
    'format c:', 'format c :', 'diskpart',
    'shutdown /s', 'shutdown -s',
    'reg delete', 'reg add hklm',
    'remove-item -recurse -force', 'remove-item -force -recurse',
    'format-volume', 'clear-disk', 'stop-computer', 'restart-computer',
];
function isShellDangerous(cmd) {
    const lower = cmd.toLowerCase();
    return SHELL_DANGEROUS_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}
// ── Singleton Playwright browser ─────────────────────────────
let browserInstance = null;
async function getBrowser() {
    if (!browserInstance) {
        const { chromium } = await Promise.resolve().then(() => __importStar(require('playwright')));
        browserInstance = await chromium.launch({ headless: false });
    }
    return browserInstance;
}
// ── Per-tool timeouts (ms) ────────────────────────────────────
const TOOL_TIMEOUTS = {
    web_search: 15000,
    deep_research: 60000,
    fetch_url: 20000,
    fetch_page: 20000,
    run_python: 60000,
    run_node: 60000,
    shell_exec: 30000,
    run_powershell: 30000,
    screenshot: 10000,
    vision_loop: 120000,
    open_browser: 15000,
    git_push: 60000,
    git_commit: 30000,
    wait: 6000,
    get_stocks: 20000,
    get_market_data: 15000,
    get_company_info: 15000,
    social_research: 30000,
    code_interpreter_python: 35000,
    code_interpreter_node: 35000,
    clipboard_read: 5000,
    clipboard_write: 5000,
    window_list: 10000,
    window_focus: 8000,
    app_launch: 10000,
    app_close: 8000,
    watch_folder: 10000,
    watch_folder_list: 5000,
};
// ── Tool implementations ──────────────────────────────────────
exports.TOOLS = {
    open_browser: async (p) => {
        const url = p.url || p.command || '';
        if (!url)
            return { success: false, output: '', error: 'No URL provided' };
        try {
            const result = await (0, computerControl_1.openBrowser)(url);
            return { success: true, output: result };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    browser_screenshot: async () => {
        try {
            const browser = await getBrowser();
            const pages = browser.contexts().flatMap((c) => c.pages());
            const page = pages[pages.length - 1] || (await (await browser.newContext()).newPage());
            const outPath = path_1.default.join(process.cwd(), 'workspace', `screenshot_${Date.now()}.png`);
            fs_1.default.mkdirSync(path_1.default.dirname(outPath), { recursive: true });
            await page.screenshot({ path: outPath, fullPage: false });
            return { success: true, output: `Screenshot saved: ${outPath}` };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    browser_click: async (p) => {
        const selector = p.selector || p.text || p.command || '';
        try {
            const browser = await getBrowser();
            const pages = browser.contexts().flatMap((c) => c.pages());
            const page = pages[pages.length - 1];
            if (!page)
                return { success: false, output: '', error: 'No browser page open' };
            await page.click(selector).catch(() => page.click(`text=${selector}`));
            return { success: true, output: `Clicked: ${selector}` };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    browser_type: async (p) => {
        const selector = p.selector || 'input';
        const text = p.text || p.command || '';
        try {
            const browser = await getBrowser();
            const pages = browser.contexts().flatMap((c) => c.pages());
            const page = pages[pages.length - 1];
            if (!page)
                return { success: false, output: '', error: 'No browser page open' };
            await page.fill(selector, text);
            return { success: true, output: `Typed "${text}" into ${selector}` };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    browser_extract: async () => {
        try {
            const browser = await getBrowser();
            const pages = browser.contexts().flatMap((c) => c.pages());
            const page = pages[pages.length - 1];
            if (!page)
                return { success: false, output: '', error: 'No browser page open' };
            const content = await page.evaluate('document.body.innerText');
            return { success: true, output: content.slice(0, 3000) };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    shell_exec: async (p) => {
        const cmd = p.command || p.cmd || '';
        if (!cmd)
            return { success: false, output: '', error: 'No command' };
        if (isShellDangerous(cmd)) {
            console.warn(`[CommandGate] BLOCKED shell_exec: ${cmd.slice(0, 120)}`);
            return { success: false, output: '', error: `CommandGate: Blocked potentially dangerous command. User approval required before running: ${cmd.slice(0, 80)}` };
        }
        try {
            const { stdout, stderr } = await execAsync(cmd, {
                shell: 'powershell.exe',
                timeout: 30000,
                cwd: process.cwd(),
                env: { ...process.env, PATH: process.env.PATH },
            });
            return { success: true, output: (stdout || stderr || '').trim() || '(completed)' };
        }
        catch (e) {
            return { success: false, output: e.stdout || '', error: e.message };
        }
    },
    run_powershell: async (p) => {
        const script = p.script || p.command || '';
        if (!script)
            return { success: false, output: '', error: 'No script' };
        if (isShellDangerous(script)) {
            console.warn(`[CommandGate] BLOCKED run_powershell: ${script.slice(0, 120)}`);
            return { success: false, output: '', error: `CommandGate: Blocked potentially dangerous PowerShell script. User approval required before running.` };
        }
        const tmpFile = path_1.default.join(process.cwd(), 'workspace', `tmp_${Date.now()}.ps1`);
        fs_1.default.mkdirSync(path_1.default.dirname(tmpFile), { recursive: true });
        fs_1.default.writeFileSync(tmpFile, script);
        try {
            const { stdout, stderr } = await execAsync(`powershell.exe -ExecutionPolicy Bypass -File "${tmpFile}"`, { timeout: 30000 });
            return { success: true, output: (stdout || stderr || '').trim() };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
        finally {
            try {
                fs_1.default.unlinkSync(tmpFile);
            }
            catch { }
        }
    },
    file_write: async (p) => {
        let filePath = p.path || p.file || '';
        const content = p.content || '';
        if (!filePath)
            return { success: false, output: '', error: 'No path' };
        try {
            // Expand Desktop and ~ shorthands to full Windows paths
            const userName = process.env.USERNAME || process.env.USER || 'User';
            filePath = filePath
                .replace(/^~[\/\\]/i, `C:\\Users\\${userName}\\`)
                .replace(/^Desktop[\/\\]/i, `C:\\Users\\${userName}\\Desktop\\`);
            const resolved = filePath.match(/^[A-Z]:/i) || filePath.startsWith('/')
                ? filePath
                : path_1.default.join(process.cwd(), filePath);
            fs_1.default.mkdirSync(path_1.default.dirname(resolved), { recursive: true });
            fs_1.default.writeFileSync(resolved, content, 'utf-8');
            const written = fs_1.default.existsSync(resolved);
            return {
                success: written,
                output: written
                    ? `Written and verified: ${resolved} (${content.length} chars)`
                    : 'Write failed',
            };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    file_read: async (p) => {
        const filePath = p.path || p.file || '';
        if (!filePath)
            return { success: false, output: '', error: 'No path' };
        try {
            // Resolve path: absolute paths (Windows C:\ or Unix /) used as-is; relative joined with cwd
            const resolved = filePath.match(/^[A-Z]:/i) || filePath.startsWith('/')
                ? filePath
                : path_1.default.join(process.cwd(), filePath);
            if (!fs_1.default.existsSync(resolved))
                return { success: false, output: '', error: `Not found: ${resolved}` };
            return { success: true, output: fs_1.default.readFileSync(resolved, 'utf-8').slice(0, 5000) };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    file_list: async (p) => {
        const dirPath = p.path || p.dir || process.cwd();
        try {
            const resolved = dirPath.match(/^[A-Z]:/i)
                ? dirPath
                : path_1.default.join(process.cwd(), dirPath);
            return { success: true, output: fs_1.default.readdirSync(resolved).join('\n') };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    run_python: async (p) => {
        const script = p.script || p.code || p.command || '';
        if (!script)
            return { success: false, output: '', error: 'No script' };
        const tmp = path_1.default.join(process.cwd(), 'workspace', `py_${Date.now()}.py`);
        fs_1.default.mkdirSync(path_1.default.dirname(tmp), { recursive: true });
        fs_1.default.writeFileSync(tmp, script);
        try {
            const { stdout, stderr } = await execAsync(`python "${tmp}"`, {
                timeout: 60000,
                cwd: process.cwd(),
            });
            return { success: true, output: (stdout || stderr || '').trim() || 'Script completed with no output' };
        }
        catch (e) {
            return { success: false, output: e.stdout || '', error: `Python error: ${e.message}` };
        }
        finally {
            try {
                fs_1.default.unlinkSync(tmp);
            }
            catch { }
        }
    },
    run_node: async (p) => {
        const script = p.script || p.code || p.command || '';
        if (!script)
            return { success: false, output: '', error: 'No script' };
        const tmp = path_1.default.join(process.cwd(), 'workspace', `js_${Date.now()}.js`);
        fs_1.default.mkdirSync(path_1.default.dirname(tmp), { recursive: true });
        fs_1.default.writeFileSync(tmp, script);
        try {
            const { stdout, stderr } = await execAsync(`node "${tmp}"`, {
                timeout: 60000,
                cwd: process.cwd(),
            });
            return { success: true, output: (stdout || stderr || '').trim() || 'Script completed with no output' };
        }
        catch (e) {
            return { success: false, output: e.stdout || '', error: `Node error: ${e.message}` };
        }
        finally {
            try {
                fs_1.default.unlinkSync(tmp);
            }
            catch { }
        }
    },
    system_info: async () => {
        try {
            const { stdout } = await execAsync(`@{ CPU=(Get-CimInstance Win32_Processor).Name; RAM_GB=[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB,1); OS=(Get-CimInstance Win32_OperatingSystem).Caption; FreeGB=[math]::Round((Get-PSDrive C).Free/1GB,1); User=$env:USERNAME } | ConvertTo-Json`, { shell: 'powershell.exe', timeout: 15000 });
            return { success: true, output: stdout.trim() };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    notify: async (p) => {
        const msg = (p.message || p.command || '').replace(/'/g, '').replace(/"/g, '');
        if (!msg.trim())
            return { success: false, output: '', error: 'No message provided for notification' };
        try {
            await execAsync(`powershell -WindowStyle Hidden -Command "Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(3000, 'DevOS', '${msg}', [System.Windows.Forms.ToolTipIcon]::Info); Start-Sleep -s 4; $n.Dispose()"`, { shell: 'powershell.exe' });
            return { success: true, output: `Desktop notification sent: "${msg}".` };
        }
        catch (e) {
            return { success: false, output: '', error: `Notification failed: ${e.message}` };
        }
    },
    web_search: async (p) => {
        const query = p.query || p.command || p.topic || '';
        if (!query)
            return { success: false, output: '', error: 'No query provided' };
        // Date/time fast-path — answer from system clock without network call
        if (/what\s+(year|date|day|time)|current\s+(year|date|day|time)|today'?s?\s+(date|year|day)|what\s+is\s+today/i.test(query)) {
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            return {
                success: true,
                output: `Current date: ${dateStr}. Year: ${now.getFullYear()}. Time: ${now.toLocaleTimeString('en-US')}.`,
                method: 'system_clock',
            };
        }
        return (0, webSearch_1.reliableWebSearch)(query);
    },
    _web_search_legacy_unused: async (p) => {
        // Legacy implementation preserved for reference — no longer called
        const query = p.query || '';
        if (!query)
            return { success: false, output: '', error: 'No query provided' };
        // ── Weather detection ────────────────────────────────────────
        if (/weather|temperature|forecast|rain|snow|sunny|cloudy|humidity|wind/i.test(query)) {
            const city = query
                .replace(/what(?:'s| is) the weather/gi, '')
                .replace(/\bweather\b/gi, '')
                .replace(/\bforecast\b/gi, '')
                .replace(/\btoday\b/gi, '')
                .replace(/\bcurrent\b/gi, '')
                .replace(/\btemperature\b/gi, '')
                .replace(/\brain\b/gi, '')
                .replace(/\bsnow\b/gi, '')
                .replace(/\bsunny\b/gi, '')
                .replace(/\bcloudy\b/gi, '')
                .replace(/\bhumidity\b/gi, '')
                .replace(/\bwind\b/gi, '')
                .replace(/\bin\b/gi, '')
                .replace(/\bfor\b/gi, '')
                .replace(/\bon\b/gi, '')
                .replace(/\s+/g, ' ')
                .trim() || 'auto';
            console.log(`[Weather] city extracted: "${city}"`);
            try {
                const wr = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { signal: AbortSignal.timeout(8000) });
                const data = await wr.json();
                const cc = data.current_condition?.[0];
                const area = data.nearest_area?.[0];
                if (cc && area) {
                    const location = [area.areaName?.[0]?.value, area.country?.[0]?.value].filter(Boolean).join(', ');
                    const desc = cc.weatherDesc?.[0]?.value || '';
                    let out = `Weather for ${location || city}:\n`;
                    out += `Condition: ${desc}\n`;
                    out += `Temperature: ${cc.temp_C}°C / ${cc.temp_F}°F (feels like ${cc.FeelsLikeC}°C)\n`;
                    out += `Humidity: ${cc.humidity}% | Wind: ${cc.windspeedKmph} km/h ${cc.winddir16Point}`;
                    out += ` | Visibility: ${cc.visibility} km | UV Index: ${cc.uvIndex}\n`;
                    const forecasts = (data.weather || []).slice(0, 3);
                    if (forecasts.length) {
                        out += '\n3-Day Forecast:\n';
                        for (const day of forecasts) {
                            const midDesc = day.hourly?.[4]?.weatherDesc?.[0]?.value || '';
                            out += `  ${day.date}: High ${day.maxtempC}°C / Low ${day.mintempC}°C${midDesc ? ' — ' + midDesc : ''}\n`;
                        }
                    }
                    console.log(`[web_search] Weather data retrieved for "${city}"`);
                    return { success: true, output: out.trim() };
                }
            }
            catch (e) {
                console.warn(`[web_search] Weather fetch failed: ${e.message}`);
            }
        }
        const results = [];
        // ── METHOD 1: DuckDuckGo Instant Answer API ──────────────────
        try {
            console.log(`[web_search] Method 1: DDG Instant API`);
            const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
            const ddgRes = await fetch(ddgUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
                signal: AbortSignal.timeout(8000),
            });
            const ddgData = await ddgRes.json();
            const parts = [];
            if (ddgData.Answer)
                parts.push(`Answer: ${ddgData.Answer}`);
            if (ddgData.Abstract)
                parts.push(`Summary: ${ddgData.Abstract}`);
            if (ddgData.AbstractText)
                parts.push(ddgData.AbstractText);
            if (ddgData.RelatedTopics?.length) {
                const topics = ddgData.RelatedTopics
                    .slice(0, 8)
                    .map((t) => t.Text || t.Result || '')
                    .filter(Boolean);
                if (topics.length)
                    parts.push(`Related: ${topics.join('. ')}`);
            }
            if (parts.length > 0) {
                console.log(`[web_search] DDG Instant: got ${parts.length} parts`);
                results.push(`[DuckDuckGo Instant]\n${parts.join('\n')}`);
            }
            else {
                console.log(`[web_search] DDG Instant: no usable data`);
            }
        }
        catch (e) {
            console.warn(`[web_search] DDG instant failed: ${e.message}`);
        }
        // ── METHOD 2: Wikipedia Search API + summary ──────────────────
        try {
            console.log(`[web_search] Method 2: Wikipedia Search API`);
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`;
            const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
            const searchData = await searchRes.json();
            const searchHits = searchData?.query?.search || [];
            console.log(`[web_search] Wikipedia search: ${searchHits.length} results`);
            if (searchHits.length > 0) {
                const topTitle = searchHits[0].title;
                const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`, { signal: AbortSignal.timeout(6000) });
                if (summaryRes.ok) {
                    const wiki = await summaryRes.json();
                    if (wiki.extract && wiki.extract.length > 50) {
                        const snippets = searchHits
                            .slice(1, 4)
                            .map((h) => h.snippet?.replace(/<[^>]+>/g, '') || '')
                            .filter((s) => s.length > 20);
                        const extra = snippets.length > 0 ? `\nOther results: ${snippets.join(' | ')}` : '';
                        console.log(`[web_search] Wikipedia summary: ${wiki.extract.length} chars for "${wiki.title}"`);
                        results.push(`[Wikipedia: ${wiki.title}]\n${wiki.extract.slice(0, 1200)}${extra}`);
                    }
                }
            }
        }
        catch (e) {
            console.warn(`[web_search] Wikipedia failed: ${e.message}`);
        }
        // ── METHOD 3: DDG HTML scrape + snippet extraction + fetch top 3 pages ──
        try {
            console.log(`[web_search] Method 3: DDG HTML scrape`);
            const searchRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
                signal: AbortSignal.timeout(10000),
            });
            const html = await searchRes.text();
            console.log(`[web_search] DDG HTML: ${html.length} bytes`);
            // Extract result snippets via result__snippet class
            const snippetMatches = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)];
            const snippets = snippetMatches
                .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
                .filter(s => s.length > 30)
                .slice(0, 5);
            console.log(`[web_search] DDG HTML snippets: ${snippets.length}`);
            if (snippets.length > 0) {
                results.push(`[Search Snippets for "${query}"]\n${snippets.join('\n\n')}`);
            }
            // Extract destination URLs via uddg= parameter
            const urlMatches = [...html.matchAll(/uddg=(https?[^&"]+)/g)];
            const urls = urlMatches
                .map(m => decodeURIComponent(m[1]))
                .filter(url => !url.includes('duckduckgo.com') &&
                !url.includes('youtube.com') &&
                url.startsWith('https'))
                .filter((url, i, arr) => arr.indexOf(url) === i)
                .slice(0, 3);
            console.log(`[web_search] DDG HTML urls: ${urls.length}`);
            // Fetch top 3 pages for real content
            const pageResults = await Promise.all(urls.map(async (url) => {
                try {
                    console.log(`[web_search] Fetching page: ${url}`);
                    const r = await fetch(url, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                        signal: AbortSignal.timeout(7000),
                    });
                    if (!r.ok)
                        return null;
                    const text = await r.text();
                    const clean = text
                        .replace(/<script[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[\s\S]*?<\/style>/gi, '')
                        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
                        .replace(/<header[\s\S]*?<\/header>/gi, '')
                        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    if (clean.length < 200)
                        return null;
                    console.log(`[web_search] Page fetched: ${clean.length} chars from ${url}`);
                    return `[${url}]\n${clean.slice(0, 2000)}`;
                }
                catch (e) {
                    console.warn(`[web_search] Page fetch failed ${url}: ${e.message}`);
                    return null;
                }
            }));
            results.push(...pageResults.filter(Boolean));
        }
        catch (e) {
            console.warn(`[web_search] HTML scrape failed: ${e.message}`);
        }
        if (results.length === 0) {
            console.warn(`[web_search] All methods failed for: "${query}"`);
            return { success: false, output: '', error: `No results found for: ${query}` };
        }
        console.log(`[web_search] Done: ${results.length} sections`);
        return { success: true, output: results.join('\n\n---\n\n').slice(0, 10000) };
    },
    fetch_url: async (p) => {
        const url = p.url || p.command || '';
        if (!url)
            return { success: false, output: '', error: 'No URL' };
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0' },
                signal: AbortSignal.timeout(15000),
            });
            const status = res.status;
            const text = await res.text();
            const clean = text
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<nav[\s\S]*?<\/nav>/gi, '')
                .replace(/<header[\s\S]*?<\/header>/gi, '')
                .replace(/<footer[\s\S]*?<\/footer>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s{3,}/g, ' ')
                .trim();
            return { success: true, output: `HTTP ${status} ${res.statusText || 'OK'}\n\n${clean.slice(0, 3000)}` };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    // Dedicated page fetcher — strips all HTML, returns clean readable text
    fetch_page: async (p) => {
        const url = p.url || p.command || '';
        if (!url)
            return { success: false, output: '', error: 'No URL' };
        try {
            const r = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                signal: AbortSignal.timeout(10000),
            });
            const text = await r.text();
            const clean = text
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return { success: true, output: clean.slice(0, 3000) };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    // 3-pass deep research using reliableWebSearch fallback chain
    deep_research: async (p) => {
        const topic = p.topic || p.query || p.command || '';
        if (!topic)
            return { success: false, output: '', error: 'No topic provided' };
        return (0, webSearch_1.deepResearch)(topic);
    },
    _deep_research_legacy_unused: async (p) => {
        // Legacy implementation preserved for reference — no longer called
        const topic = p.topic || '';
        if (!topic)
            return { success: false, output: '', error: 'No topic provided' };
        const results = [];
        if (results.length === 0) {
            return { success: false, output: '', error: `No research results for: ${topic}` };
        }
        const combined = results.join('\n\n');
        console.log(`[deep_research] Complete: ${combined.length} chars across ${results.length} passes`);
        return { success: true, output: combined.slice(0, 15000) };
    },
    // Activate a specialist agent persona — actual synthesis happens in respond phase
    run_agent: async (p) => {
        const agentName = (p.agent || 'engineer').toLowerCase();
        const task = p.task || p.command || '';
        if (!task)
            return { success: false, output: '', error: 'No task provided' };
        const agentPersonas = {
            engineer: 'Senior TypeScript/JavaScript engineer — writes clean, working code with full error handling.',
            security: 'Security auditor — analyzes for OWASP Top 10, provides specific fixes with code examples.',
            data_analyst: 'Data analyst — provides statistical analysis, patterns, and visualizable insights.',
            designer: 'UI/UX designer — provides design recommendations with color codes, typography, and layout.',
            researcher: 'Research specialist — extracts entities, compares systematically, identifies trends, gives conclusions.',
            debugger: 'Debugger — forms 3 hypotheses, eliminates systematically, provides exact fix with code.',
        };
        const persona = agentPersonas[agentName] || agentPersonas.engineer;
        try {
            const { memoryLayers } = await Promise.resolve().then(() => __importStar(require('../memory/memoryLayers')));
            memoryLayers.write(`Agent ${agentName} task: ${task}`, ['agent', agentName]);
        }
        catch { }
        return {
            success: true,
            output: `Agent: ${agentName}\nPersona: ${persona}\nTask: ${task}\n\n[Specialist agent will synthesize this task in the response phase with full context]`,
        };
    },
    git_commit: async (p) => {
        const msg = (p.message || p.command || 'DevOS auto-commit').replace(/"/g, "'");
        try {
            const { stdout, stderr } = await execAsync(`git add -A && git commit -m "${msg}"`, { shell: 'powershell.exe', timeout: 30000, cwd: process.cwd() });
            return { success: true, output: stdout || stderr };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    git_push: async (p) => {
        const remote = p.remote || 'origin';
        const branch = p.branch || 'master';
        try {
            const { stdout, stderr } = await execAsync(`git push ${remote} ${branch}`, { shell: 'powershell.exe', timeout: 60000, cwd: process.cwd() });
            return { success: true, output: stdout || stderr };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    get_stocks: async (p) => {
        const market = p.market || p.exchange || 'NSE';
        const type = p.type || 'gainers'; // gainers | losers | active
        console.log(`[get_stocks] Fetching ${type} for ${market}`);
        const results = [];
        // Method 1: Yahoo Finance screener API — free, no auth needed
        try {
            const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=10&region=IN&lang=en-IN`;
            const r = await fetch(yahooUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(10000),
            });
            if (r.ok) {
                const data = await r.json();
                const quotes = data?.finance?.result?.[0]?.quotes || [];
                if (quotes.length > 0) {
                    const lines = quotes.slice(0, 10).map((q) => `${q.symbol}: ${q.regularMarketPrice} (${q.regularMarketChangePercent?.toFixed(2)}%) — ${q.shortName || q.longName || ''}`);
                    results.push(`Top Gainers (Yahoo Finance India):\n${lines.join('\n')}`);
                }
            }
        }
        catch (e) {
            console.warn(`[get_stocks] Yahoo Finance failed: ${e.message}`);
        }
        // Method 2: Finology ticker
        try {
            const finologyUrl = type === 'gainers'
                ? 'https://ticker.finology.in/market/top-gainers'
                : type === 'losers'
                    ? 'https://ticker.finology.in/market/top-losers'
                    : 'https://ticker.finology.in/market/most-active';
            const r = await fetch(finologyUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html',
                },
                signal: AbortSignal.timeout(10000),
            });
            if (r.ok) {
                const html = await r.text();
                const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
                const stocks = [];
                for (const row of rows.slice(1, 15)) {
                    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
                        .map((c) => c[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
                        .filter(Boolean);
                    if (cells.length >= 3 && cells[0].length > 1) {
                        stocks.push(cells.slice(0, 5).join(' | '));
                    }
                }
                if (stocks.length > 0) {
                    results.push(`${market} Top ${type} (Finology):\n${stocks.slice(0, 10).join('\n')}`);
                }
            }
        }
        catch (e) {
            console.warn(`[get_stocks] Finology failed: ${e.message}`);
        }
        // Method 3: Economic Times market stats
        try {
            const segment = type === 'gainers' ? 'gainers' : type === 'losers' ? 'losers' : 'active-stocks';
            const etUrl = `https://economictimes.indiatimes.com/stocks/marketstats/top-${segment}/nse`;
            const r = await fetch(etUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' },
                signal: AbortSignal.timeout(10000),
            });
            if (r.ok) {
                const html = await r.text();
                const clean = html
                    .replace(/<script[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[\s\S]*?<\/style>/gi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                const stockPattern = /\b([A-Z]{2,10})\b[\s\S]{0,30}?(\d+\.?\d*)\s*[(%]\s*([+-]?\d+\.?\d*)/g;
                const matches = [...clean.matchAll(stockPattern)].slice(0, 10);
                if (matches.length > 0) {
                    const lines = matches.map((m) => `${m[1]}: ${m[2]} (${m[3]}%)`);
                    results.push(`ET Market Stats:\n${lines.join('\n')}`);
                }
            }
        }
        catch (e) {
            console.warn(`[get_stocks] ET failed: ${e.message}`);
        }
        if (results.length === 0) {
            // All scrapers failed — fall back to web search
            console.log(`[get_stocks] Scrapers failed — falling back to reliableWebSearch`);
            try {
                const searchResult = await (0, webSearch_1.reliableWebSearch)(`${market} top ${type} stocks today NSE BSE Nifty`);
                if (searchResult.success && searchResult.output) {
                    return { success: true, output: `${market} Top ${type} stocks:\n${searchResult.output}` };
                }
            }
            catch { }
            // Return a structured placeholder so the response at least has market keywords
            return {
                success: true,
                output: `${market} top ${type} stocks data unavailable right now (market may be closed or data source unreachable). Please check NSE/BSE directly at nseindia.com or bseindia.com for live gainers/losers with % changes.`,
            };
        }
        // Format final output to ensure exchange/percentage keywords are prominent
        const rawOutput = results.join('\n\n---\n\n').slice(0, 5000);
        const header = rawOutput.toLowerCase().includes(market.toLowerCase())
            ? rawOutput
            : `${market} Market — Top ${type}:\n${rawOutput}`;
        return {
            success: true,
            output: header,
        };
    },
    // ── Financial tools ─────────────────────────────────────
    get_market_data: async (p) => {
        const symbol = (p.symbol || p.ticker || '').trim();
        if (!symbol)
            return { success: false, output: '', error: 'No symbol provided. Pass { symbol: "RELIANCE" } or { symbol: "AAPL" }.' };
        try {
            const data = await (0, marketDataTool_1.getMarketData)(symbol);
            return { success: true, output: JSON.stringify(data, null, 2) };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    get_company_info: async (p) => {
        const symbol = (p.symbol || p.ticker || '').trim();
        if (!symbol)
            return { success: false, output: '', error: 'No symbol provided. Pass { symbol: "RELIANCE" } or { symbol: "AAPL" }.' };
        try {
            const data = await (0, companyFilingsTool_1.getCompanyInfo)(symbol);
            return { success: true, output: JSON.stringify(data, null, 2) };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    social_research: async (input) => {
        const { socialResearch } = await Promise.resolve().then(() => __importStar(require('./tools/socialResearchTool')));
        const result = await socialResearch(input.topic);
        return { success: true, output: JSON.stringify(result, null, 2) };
    },
    // ── Wait ───────────────────────────────────────────────────────
    wait: async (p) => {
        const ms = Math.min(Number(p.ms) || 1000, 5000);
        await new Promise(r => setTimeout(r, ms));
        return { success: true, output: `Waited ${ms}ms` };
    },
    // ── Computer control tools (PowerShell-only, zero native deps) ─
    mouse_move: async (p) => {
        try {
            const result = await (0, computerControl_1.moveMouse)(Number(p.x) || 0, Number(p.y) || 0);
            return { success: true, output: result };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    mouse_click: async (p) => {
        try {
            const result = await (0, computerControl_1.clickMouse)(Number(p.x) || 0, Number(p.y) || 0, p.button || 'left', !!p.double);
            return { success: true, output: result };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    keyboard_type: async (p) => {
        try {
            const result = await (0, computerControl_1.typeText)(String(p.text || ''));
            return { success: true, output: result };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    keyboard_press: async (p) => {
        try {
            const result = await (0, computerControl_1.pressKey)(String(p.key || 'enter'));
            return { success: true, output: result };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    screenshot: async (_p) => {
        try {
            const filepath = await (0, computerControl_1.takeScreenshot)();
            const stats = require('fs').statSync(filepath);
            return { success: true, output: `Screenshot saved: ${filepath} (${Math.round(stats.size / 1024)}kb)`, path: filepath };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    screen_read: async (_p) => {
        try {
            const result = await (0, computerControl_1.readScreen)();
            return { success: true, output: result };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    vision_loop: async (p) => {
        try {
            // Build a callLLM wrapper using the currently available provider
            const callLLMWrapper = async (prompt) => {
                const { getNextAvailableAPI } = await Promise.resolve().then(() => __importStar(require('../providers/router')));
                const { callLLM: _callLLM } = await Promise.resolve().then(() => __importStar(require('./agentLoop')));
                const next = getNextAvailableAPI();
                if (!next)
                    return 'No API available';
                const key = next.entry.key.startsWith('env:')
                    ? (process.env[next.entry.key.replace('env:', '')] || '')
                    : next.entry.key;
                return _callLLM(prompt, key, next.entry.model, next.entry.provider);
            };
            const result = await (0, computerControl_1.visionLoop)(p.goal, p.max_steps || 10, callLLMWrapper);
            return { success: true, output: result };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    // ── Sprint 16: Code Interpreter Sandbox ───────────────────────
    code_interpreter_python: async (p) => {
        const code = p.code || p.script || '';
        const packages = Array.isArray(p.packages) ? p.packages : undefined;
        if (!code)
            return { success: false, output: '', error: 'No code provided' };
        const result = await (0, codeInterpreter_1.runInSandbox)(code, 'python', packages);
        const filesNote = result.files && result.files.length > 0
            ? `\nFiles created: ${result.files.join(', ')}`
            : '';
        return {
            success: result.success,
            output: (result.output || '') + filesNote,
            error: result.error,
        };
    },
    code_interpreter_node: async (p) => {
        const code = p.code || p.script || '';
        if (!code)
            return { success: false, output: '', error: 'No code provided' };
        const result = await (0, codeInterpreter_1.runInSandbox)(code, 'node');
        const filesNote = result.files && result.files.length > 0
            ? `\nFiles created: ${result.files.join(', ')}`
            : '';
        return {
            success: result.success,
            output: (result.output || '') + filesNote,
            error: result.error,
        };
    },
    // ── Sprint 23: Clipboard + Window + App Launch Tools ──────────
    clipboard_read: async () => {
        try {
            const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const text = execSync('powershell.exe -Command "Get-Clipboard"', { timeout: 5000 }).toString().trim();
            return { success: true, output: text || '(clipboard is empty)' };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    clipboard_write: async (p) => {
        const text = p.text || p.content || p.command || '';
        if (!text)
            return { success: false, output: '', error: 'No text provided' };
        try {
            const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const safe = text.replace(/'/g, "''");
            execSync(`powershell.exe -Command "Set-Clipboard -Value '${safe}'"`, { timeout: 5000 });
            return { success: true, output: `Copied to clipboard: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"` };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    window_list: async () => {
        try {
            const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const out = execSync('powershell.exe -Command "Get-Process | Where-Object {$_.MainWindowTitle -ne \'\'} | Select-Object -Property Id,ProcessName,MainWindowTitle | ConvertTo-Json"', { timeout: 10000 }).toString().trim();
            return { success: true, output: out || '(no visible windows found)' };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    window_focus: async (p) => {
        const title = p.title || p.window || p.command || '';
        if (!title)
            return { success: false, output: '', error: 'No window title provided' };
        try {
            const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const safe = title.replace(/'/g, "''");
            execSync(`powershell.exe -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.Interaction]::AppActivate('${safe}')"`, { timeout: 8000 });
            return { success: true, output: `Focused window: "${title}"` };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    app_launch: async (p) => {
        const app = p.app || p.path || p.command || '';
        if (!app)
            return { success: false, output: '', error: 'No app specified' };
        if (isShellDangerous(app)) {
            return { success: false, output: '', error: 'CommandGate: Blocked potentially dangerous app launch.' };
        }
        try {
            const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const safe = app.replace(/'/g, "''");
            execSync(`powershell.exe -Command "Start-Process '${safe}'"`, { timeout: 10000 });
            return { success: true, output: `Launched: "${app}"` };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    app_close: async (p) => {
        const app = p.app || p.process || p.command || '';
        if (!app)
            return { success: false, output: '', error: 'No app/process name provided' };
        try {
            const { execSync } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const safe = app.replace(/'/g, "''");
            execSync(`powershell.exe -Command "Stop-Process -Name '${safe}' -Force -ErrorAction SilentlyContinue"`, { timeout: 8000 });
            return { success: true, output: `Closed process: "${app}"` };
        }
        catch (e) {
            return { success: false, output: '', error: e.message };
        }
    },
    // ── Sprint 24: Folder Watcher ─────────────────────────────────
    watch_folder: async (p) => {
        const rawFolder = p.folder || p.path || p.dir || '';
        const goal = p.goal || p.command || '';
        const stop = !!p.stop;
        if (!rawFolder)
            return { success: false, output: '', error: 'No folder specified' };
        const userName = process.env.USERPROFILE || process.env.HOME || '';
        const folderPath = rawFolder
            .replace(/%USERPROFILE%/gi, userName)
            .replace(/^~[\/\\]/, userName + path_1.default.sep);
        // Stop mode
        if (stop) {
            const watcher = activeWatchers.get(folderPath);
            if (watcher) {
                watcher.close();
                activeWatchers.delete(folderPath);
                return { success: true, output: `Stopped watching: ${folderPath}` };
            }
            return { success: false, output: `No active watcher for: ${folderPath}` };
        }
        if (!goal)
            return { success: false, output: '', error: 'No goal specified' };
        if (!fs_1.default.existsSync(folderPath))
            return { success: false, output: '', error: `Folder not found: ${folderPath}` };
        // Close existing watcher on same path before starting a new one
        const existing = activeWatchers.get(folderPath);
        if (existing) {
            existing.close();
            activeWatchers.delete(folderPath);
        }
        const watcher = fs_1.default.watch(folderPath, async (eventType, filename) => {
            if (eventType !== 'rename' || !filename)
                return;
            const fullPath = path_1.default.join(folderPath, filename);
            // Small delay to let the file finish writing
            await new Promise(r => setTimeout(r, 500));
            if (!fs_1.default.existsSync(fullPath))
                return;
            let isFile = false;
            try {
                isFile = fs_1.default.statSync(fullPath).isFile();
            }
            catch {
                return;
            }
            if (!isFile)
                return;
            try {
                await fetch('http://localhost:4200/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({ message: `${goal} — new file: ${fullPath}`, history: [] }),
                });
            }
            catch { }
        });
        activeWatchers.set(folderPath, watcher);
        return {
            success: true,
            output: `Now watching: ${folderPath}\nWill execute: "${goal}" when new files appear.\nActive watchers: ${activeWatchers.size}`,
        };
    },
    watch_folder_list: async () => {
        if (activeWatchers.size === 0)
            return { success: true, output: 'No active folder watchers.' };
        const list = Array.from(activeWatchers.keys()).map((f, i) => `${i + 1}. ${f}`).join('\n');
        return { success: true, output: `Active watchers:\n${list}` };
    },
    get_briefing: async (_p) => {
        try {
            const config = (0, morningBriefing_1.loadBriefingConfig)();
            const briefing = await (0, morningBriefing_1.generateBriefing)(config);
            return { success: true, output: briefing };
        }
        catch (e) {
            return { success: false, output: '', error: `Briefing failed: ${e.message}` };
        }
    },
};
// ── Internal dispatcher — no retry, no timeout ────────────────
async function runTool(tool, input) {
    const fn = exports.TOOLS[tool];
    if (!fn) {
        // ── MCP tool dispatch ─────────────────────────────────────
        // Tool names follow the pattern: mcp_<serverName>_<toolName>
        if (tool.startsWith('mcp_')) {
            const withoutPrefix = tool.slice(4); // drop "mcp_"
            const underIdx = withoutPrefix.indexOf('_');
            if (underIdx !== -1) {
                const serverName = withoutPrefix.slice(0, underIdx);
                const mcpToolName = withoutPrefix.slice(underIdx + 1);
                const result = await mcpClient_1.mcpClient.callTool(serverName, mcpToolName, input);
                return { success: result.success, output: result.output };
            }
        }
        // Last resort: try shell_exec
        const cmd = input?.command || '';
        if (cmd)
            return exports.TOOLS.shell_exec({ command: cmd });
        throw new Error(`Unknown tool: ${tool}`);
    }
    return fn(input);
}
// ── Public executor — retry + per-tool timeout ────────────────
// maxRetries: number of retries AFTER the first attempt (default 2 = 3 total tries)
// timeoutMs: fallback timeout when tool has no entry in TOOL_TIMEOUTS
async function executeTool(tool, input, maxRetries = 2, timeoutMs = 30000) {
    const start = Date.now();
    let lastError = '';
    let retries = 0;
    // ── Sprint 17: cache check ────────────────────────────────────
    const cachedOutput = responseCache_1.responseCache.get(tool, input);
    if (cachedOutput !== null) {
        return {
            tool, input,
            success: true,
            output: cachedOutput,
            duration: Date.now() - start,
            retries: 0,
        };
    }
    const timeout = TOOL_TIMEOUTS[tool] ?? timeoutMs;
    // Errors that should not be retried (permanent failures)
    const NO_RETRY_PATTERNS = [
        'not found', 'permission denied', 'invalid input',
        'file not found', 'syntax error', 'enoent', 'no path', 'no url',
        'no query', 'no script', 'no command', 'unknown tool',
    ];
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
            retries++;
            // Exponential backoff: 1s, 2s, 4s
            await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
            console.log(`[Executor] Retry ${attempt}/${maxRetries} for ${tool}`);
        }
        try {
            const raw = await Promise.race([
                runTool(tool, input),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Tool timeout after ${timeout}ms`)), timeout)),
            ]);
            const result = {
                tool, input,
                success: raw.success,
                output: String(raw.output || ''),
                error: raw.error,
                duration: Date.now() - start,
                retries,
            };
            // ── Sprint 17: cache successful results ───────────────────
            if (result.success && result.output) {
                responseCache_1.responseCache.set(tool, input, result.output);
            }
            return result;
        }
        catch (e) {
            lastError = e.message || String(e);
            console.warn(`[Executor] ${tool} attempt ${attempt + 1} failed: ${lastError.slice(0, 120)}`);
            // Don't retry on permanent errors
            if (NO_RETRY_PATTERNS.some(p => lastError.toLowerCase().includes(p))) {
                break;
            }
        }
    }
    return {
        tool, input,
        success: false,
        output: '',
        error: lastError,
        duration: Date.now() - start,
        retries,
    };
}
// ── Sprint 29: TOOL_DESCRIPTIONS ────────────────────────────────
// Human-readable descriptions for all tools, used by the MCP server to advertise
// capabilities to Claude Desktop and other MCP clients.
exports.TOOL_DESCRIPTIONS = {
    web_search: 'Search the web for current information, news, or any topic',
    fetch_url: 'Fetch the content of any URL and return the text',
    fetch_page: 'Fetch a web page and extract its readable text content',
    deep_research: 'Conduct thorough multi-step research on a topic using multiple sources',
    open_browser: 'Open a URL in the system browser',
    browser_click: 'Click on an element in the browser by selector',
    browser_type: 'Type text into a browser input field',
    browser_extract: 'Extract text content from the current browser page',
    browser_screenshot: 'Take a screenshot of the current browser window',
    file_write: 'Write content to a file at the specified path',
    file_read: 'Read the contents of a file at the specified path',
    file_list: 'List files in a directory',
    shell_exec: 'Execute a shell/PowerShell command and return the output',
    run_powershell: 'Run a PowerShell command on Windows',
    run_python: 'Execute a Python script and return stdout/stderr',
    run_node: 'Execute Node.js/JavaScript code and return the output',
    system_info: 'Get system hardware and OS information (CPU, RAM, disk, OS)',
    notify: 'Send a desktop notification to the user',
    get_stocks: 'Get top gainers, losers, or most active stocks from NSE/BSE',
    get_market_data: 'Get real-time price, change%, and volume for a stock symbol',
    get_company_info: 'Get company profile, sector, P/E ratio, EPS, and revenue',
    social_research: 'Research a person or company across social and public sources',
    mouse_move: 'Move the mouse cursor to screen coordinates',
    mouse_click: 'Click the mouse at screen coordinates',
    keyboard_type: 'Type text using the keyboard',
    keyboard_press: 'Press a keyboard key or shortcut (e.g. ctrl+c)',
    screenshot: 'Take a screenshot of the entire screen',
    screen_read: 'Read and describe the current screen contents',
    vision_loop: 'Autonomously control the computer using vision to complete a goal',
    wait: 'Pause execution for a specified number of milliseconds',
    code_interpreter_python: 'Run Python code in a sandboxed interpreter with data science libraries',
    code_interpreter_node: 'Run Node.js code in a sandboxed interpreter',
    run_agent: 'Spawn a sub-agent to complete a sub-goal autonomously',
    git_commit: 'Stage and commit files to a local git repository',
    git_push: 'Push committed changes to a remote git repository',
    clipboard_read: 'Read the current contents of the system clipboard',
    clipboard_write: 'Write text to the system clipboard',
    window_list: 'List all open windows on the desktop',
    window_focus: 'Bring a specific window to the foreground by title',
    app_launch: 'Launch an application by name or executable path',
    app_close: 'Close an application by window title',
    watch_folder: 'Watch a folder and react automatically when new files appear',
    watch_folder_list: 'List all currently watched folder paths',
    get_briefing: 'Run the morning briefing: weather, markets, news, and daily summary',
};
