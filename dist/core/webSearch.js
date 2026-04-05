"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.reliableWebSearch = reliableWebSearch;
exports.deepResearch = deepResearch;
exports.checkSearxNG = checkSearxNG;
// ── Constants ─────────────────────────────────────────────────
const SEARXNG_URL = process.env.SEARXNG_URL || 'http://localhost:8888';
const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';
const SEARCH_TIMEOUT = 10000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
// ── METHOD 1: SearxNG ──────────────────────────────────────────
async function searchViaSearxNG(query) {
    try {
        const url = `${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json&language=en&categories=general`;
        const res = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(SEARCH_TIMEOUT),
        });
        if (!res.ok) {
            console.warn(`[webSearch] SearxNG returned ${res.status}`);
            return null;
        }
        const data = await res.json();
        const results = (data.results || []).slice(0, 10).map((r) => ({
            title: r.title || '',
            url: r.url || '',
            snippet: r.content || '',
            source: 'searxng',
        }));
        if (results.length === 0)
            return null;
        const lines = results.map(r => `**${r.title}**\n${r.snippet}\n${r.url}`);
        const output = `[SearxNG Results for "${query}"]\n\n${lines.join('\n\n')}`;
        console.log(`[webSearch] SearxNG: ${results.length} results`);
        return { success: true, output, method: 'searxng', results };
    }
    catch (e) {
        console.warn(`[webSearch] SearxNG failed: ${e.message}`);
        return null;
    }
}
// ── METHOD 2: Brave Search API ────────────────────────────────
async function searchViaBrave(query) {
    if (!BRAVE_API_KEY)
        return null;
    try {
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
        const res = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': BRAVE_API_KEY,
            },
            signal: AbortSignal.timeout(SEARCH_TIMEOUT),
        });
        if (!res.ok) {
            console.warn(`[webSearch] Brave API returned ${res.status}`);
            return null;
        }
        const data = await res.json();
        const webHits = data?.web?.results || [];
        if (webHits.length === 0)
            return null;
        const results = webHits.map(r => ({
            title: r.title || '',
            url: r.url || '',
            snippet: r.description || '',
            source: 'brave',
        }));
        const lines = results.map(r => `**${r.title}**\n${r.snippet}\n${r.url}`);
        const output = `[Brave Search Results for "${query}"]\n\n${lines.join('\n\n')}`;
        console.log(`[webSearch] Brave: ${results.length} results`);
        return { success: true, output, method: 'brave', results };
    }
    catch (e) {
        console.warn(`[webSearch] Brave failed: ${e.message}`);
        return null;
    }
}
// ── METHOD 3: DuckDuckGo (Instant API + HTML scrape) ──────────
async function searchViaDDG(query) {
    const parts = [];
    // DDG Instant Answer API
    try {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const ddgRes = await fetch(ddgUrl, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(8000),
        });
        const ddgData = await ddgRes.json();
        if (ddgData.Answer)
            parts.push(`Answer: ${ddgData.Answer}`);
        if (ddgData.Abstract)
            parts.push(`Summary: ${ddgData.Abstract}`);
        if (ddgData.AbstractText && !ddgData.Abstract)
            parts.push(ddgData.AbstractText);
        if (ddgData.RelatedTopics?.length) {
            const topics = ddgData.RelatedTopics
                .slice(0, 6)
                .map(t => t.Text || t.Result || '')
                .filter(Boolean);
            if (topics.length)
                parts.push(`Related: ${topics.join('. ')}`);
        }
    }
    catch (e) {
        console.warn(`[webSearch] DDG Instant failed: ${e.message}`);
    }
    // DDG HTML scrape — get snippet text + page content
    try {
        const htmlRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(10000),
        });
        const html = await htmlRes.text();
        // Extract snippets
        const snippetMatches = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)];
        const snippets = snippetMatches
            .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
            .filter(s => s.length > 30)
            .slice(0, 5);
        if (snippets.length > 0) {
            parts.push(`Search Snippets:\n${snippets.join('\n')}`);
        }
        // Fetch top 2 result pages
        const urlMatches = [...html.matchAll(/uddg=(https?[^&"]+)/g)];
        const urls = urlMatches
            .map(m => decodeURIComponent(m[1]))
            .filter(u => !u.includes('duckduckgo.com') && !u.includes('youtube.com') && u.startsWith('https'))
            .filter((u, i, arr) => arr.indexOf(u) === i)
            .slice(0, 2);
        const pageTexts = await Promise.all(urls.map(async (url) => {
            try {
                const r = await fetch(url, {
                    headers: { 'User-Agent': USER_AGENT },
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
                return `[${url}]\n${clean.slice(0, 1500)}`;
            }
            catch {
                return null;
            }
        }));
        const validPages = pageTexts.filter(Boolean);
        if (validPages.length > 0)
            parts.push(...validPages);
    }
    catch (e) {
        console.warn(`[webSearch] DDG HTML scrape failed: ${e.message}`);
    }
    if (parts.length === 0)
        return null;
    const output = `[DuckDuckGo Results for "${query}"]\n\n${parts.join('\n\n')}`;
    console.log(`[webSearch] DDG: ${parts.length} sections`);
    return { success: true, output, method: 'ddg' };
}
// ── METHOD 4: Wikipedia ───────────────────────────────────────
async function searchViaWikipedia(query) {
    try {
        const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&origin=*`, { signal: AbortSignal.timeout(6000) });
        const searchData = await searchRes.json();
        const hits = searchData?.query?.search || [];
        if (hits.length === 0)
            return null;
        const topTitle = hits[0].title;
        const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`, { signal: AbortSignal.timeout(6000) });
        if (!summaryRes.ok)
            return null;
        const wiki = await summaryRes.json();
        if (!wiki.extract || wiki.extract.length < 50)
            return null;
        const snippets = hits
            .slice(1, 4)
            .map(h => h.snippet?.replace(/<[^>]+>/g, '') || '')
            .filter(s => s.length > 20);
        const extra = snippets.length > 0 ? `\n\nRelated: ${snippets.join(' | ')}` : '';
        const output = `[Wikipedia: ${wiki.title}]\n${wiki.extract.slice(0, 1500)}${extra}`;
        console.log(`[webSearch] Wikipedia: ${wiki.extract.length} chars for "${wiki.title}"`);
        return { success: true, output, method: 'wikipedia' };
    }
    catch (e) {
        console.warn(`[webSearch] Wikipedia failed: ${e.message}`);
        return null;
    }
}
// ── Weather shortcut ──────────────────────────────────────────
async function fetchWeather(query) {
    const city = query
        .replace(/what(?:'s| is) the weather/gi, '')
        .replace(/\b(weather|forecast|today|current|temperature|rain|snow|sunny|cloudy|humidity|wind|in|for)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim() || 'auto';
    try {
        const wr = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { signal: AbortSignal.timeout(8000) });
        const data = await wr.json();
        const cc = data.current_condition?.[0];
        const area = data.nearest_area?.[0];
        if (!cc || !area)
            return null;
        const location = [area.areaName?.[0]?.value, area.country?.[0]?.value].filter(Boolean).join(', ');
        const desc = cc.weatherDesc?.[0]?.value || '';
        let out = `Weather for ${location || city}:\n`;
        out += `Condition: ${desc}\n`;
        out += `Temperature: ${cc.temp_C}°C / ${cc.temp_F}°F (feels like ${cc.FeelsLikeC}°C)\n`;
        out += `Humidity: ${cc.humidity}% | Wind: ${cc.windspeedKmph} km/h ${cc.winddir16Point} | Visibility: ${cc.visibility} km | UV: ${cc.uvIndex}\n`;
        const forecasts = (data.weather || []).slice(0, 3);
        if (forecasts.length) {
            out += '\n3-Day Forecast:\n';
            for (const day of forecasts) {
                const mid = day.hourly?.[4]?.weatherDesc?.[0]?.value || '';
                out += `  ${day.date}: High ${day.maxtempC}°C / Low ${day.mintempC}°C${mid ? ' — ' + mid : ''}\n`;
            }
        }
        console.log(`[webSearch] Weather: retrieved for "${city}"`);
        return { success: true, output: out.trim(), method: 'wttr.in' };
    }
    catch (e) {
        console.warn(`[webSearch] Weather failed: ${e.message}`);
        return null;
    }
}
// ── Main exported function ────────────────────────────────────
async function reliableWebSearch(query) {
    if (!query?.trim())
        return { success: false, output: '', error: 'No query provided' };
    console.log(`[webSearch] Query: "${query}"`);
    // Weather shortcut
    if (/weather|temperature|forecast|rain|snow|sunny|cloudy|humidity|wind/i.test(query)) {
        const weather = await fetchWeather(query);
        if (weather)
            return { success: true, output: weather.output };
    }
    // Method 1 — SearxNG
    const searxResult = await searchViaSearxNG(query);
    if (searxResult) {
        console.log(`[webSearch] ✓ SearxNG succeeded`);
        return { success: true, output: searxResult.output.slice(0, 10000) };
    }
    // Method 2 — Brave
    const braveResult = await searchViaBrave(query);
    if (braveResult) {
        console.log(`[webSearch] ✓ Brave succeeded`);
        return { success: true, output: braveResult.output.slice(0, 10000) };
    }
    // Method 3 — DDG
    const ddgResult = await searchViaDDG(query);
    if (ddgResult) {
        console.log(`[webSearch] ✓ DDG succeeded`);
        return { success: true, output: ddgResult.output.slice(0, 10000) };
    }
    // Method 4 — Wikipedia
    const wikiResult = await searchViaWikipedia(query);
    if (wikiResult) {
        console.log(`[webSearch] ✓ Wikipedia fallback`);
        return { success: true, output: wikiResult.output };
    }
    console.warn(`[webSearch] All methods failed for: "${query}"`);
    return {
        success: false,
        output: '',
        error: `Web search failed for "${query}" — all 4 methods exhausted (SearxNG, Brave, DuckDuckGo, Wikipedia). Try starting SearxNG: .\\scripts\\start-searxng.ps1`,
    };
}
// ── Deep research — 3-pass synthesis ─────────────────────────
async function deepResearch(topic) {
    if (!topic?.trim())
        return { success: false, output: '', error: 'No topic provided' };
    console.log(`[deepResearch] Topic: "${topic}"`);
    const parts = [];
    // Pass 1: Broad
    console.log(`[deepResearch] Pass 1: broad`);
    const broad = await reliableWebSearch(topic);
    if (broad.success && broad.output.length > 100) {
        parts.push(`=== PASS 1: BROAD RESEARCH ===\n${broad.output}`);
    }
    // Pass 2: Latest 2026
    const latestQ = `${topic} 2026 latest`;
    console.log(`[deepResearch] Pass 2: latest — "${latestQ}"`);
    const latest = await reliableWebSearch(latestQ);
    if (latest.success && latest.output.length > 100) {
        parts.push(`=== PASS 2: LATEST (2026) ===\n${latest.output}`);
    }
    // Pass 3: Comparison / review
    const compareQ = `best top ${topic} comparison review`;
    console.log(`[deepResearch] Pass 3: comparison — "${compareQ}"`);
    const compare = await reliableWebSearch(compareQ);
    if (compare.success && compare.output.length > 100) {
        parts.push(`=== PASS 3: COMPARISON & REVIEWS ===\n${compare.output}`);
    }
    if (parts.length === 0) {
        return { success: false, output: '', error: `No research results found for: ${topic}` };
    }
    const combined = parts.join('\n\n');
    console.log(`[deepResearch] Complete: ${combined.length} chars across ${parts.length} passes`);
    return { success: true, output: combined.slice(0, 15000) };
}
// ── SearxNG health check ──────────────────────────────────────
async function checkSearxNG() {
    try {
        const res = await fetch(`${SEARXNG_URL}/search?q=test&format=json`, {
            signal: AbortSignal.timeout(3000),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
