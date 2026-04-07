"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketData = getMarketData;
// ── Symbol normalisation ───────────────────────────────────────
// If the symbol has no exchange suffix, try to infer one.
function normaliseSymbol(raw) {
    const upper = raw.trim().toUpperCase();
    // Already has a suffix — use as-is
    if (upper.includes('.'))
        return upper;
    // Common NSE-listed large-caps — tag with .NS
    const NSE_HINTS = ['RELIANCE', 'TCS', 'INFY', 'WIPRO', 'HDFCBANK', 'ICICIBANK',
        'SBIN', 'BAJFINANCE', 'MARUTI', 'TATAMOTORS', 'TATASTEEL', 'ADANIENT',
        'ADANIPORTS', 'HINDUNILVR', 'NESTLEIND', 'LT', 'ITC', 'SUNPHARMA',
        'POWERGRID', 'NTPC', 'COALINDIA', 'ONGC', 'JSWSTEEL', 'AXISBANK',
        'KOTAKBANK', 'ULTRACEMCO', 'GRASIM', 'DRREDDY', 'CIPLA', 'TECHM',
        'HCLTECH', 'APOLLOHOSP', 'TITAN', 'BPCL', 'IOC', 'BHARTIARTL'];
    if (NSE_HINTS.includes(upper))
        return `${upper}.NS`;
    // Known US symbols (short, no digits)
    const US_HINTS = ['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META',
        'NVDA', 'AMD', 'NFLX', 'INTC', 'QCOM', 'AVGO', 'CRM', 'ORCL',
        'IBM', 'ADBE', 'PYPL', 'SQ', 'UBER', 'LYFT', 'SNAP', 'TWTR',
        'SPY', 'QQQ', 'IWM', 'DIA', 'GLD', 'SLV', 'USO', 'BTC-USD', 'ETH-USD'];
    if (US_HINTS.includes(upper))
        return upper;
    // Default: assume NSE
    return `${upper}.NS`;
}
// ── Fetch helper with timeout ─────────────────────────────────
async function fetchJson(url, timeoutMs = 12000) {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
}
// ── Main export ───────────────────────────────────────────────
async function getMarketData(symbol) {
    const sym = normaliseSymbol(symbol);
    // Method 1: Yahoo Finance v8 chart API (most reliable)
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
        const data = await fetchJson(url);
        const result = data?.chart?.result?.[0];
        if (!result)
            throw new Error('No result in chart response');
        const meta = result.meta;
        const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
        const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
        const change = parseFloat((price - prevClose).toFixed(4));
        const changePct = prevClose !== 0 ? parseFloat(((change / prevClose) * 100).toFixed(4)) : 0;
        return {
            symbol: sym,
            price,
            change,
            changePercent: changePct,
            volume: meta.regularMarketVolume ?? 0,
            marketCap: meta.marketCap,
            high52w: meta.fiftyTwoWeekHigh,
            low52w: meta.fiftyTwoWeekLow,
            dayHigh: meta.regularMarketDayHigh,
            dayLow: meta.regularMarketDayLow,
            currency: meta.currency ?? 'USD',
            shortName: meta.shortName ?? meta.longName,
            source: 'Yahoo Finance (chart)',
        };
    }
    catch (e1) {
        console.warn(`[getMarketData] Chart API failed for ${sym}: ${e1.message}`);
    }
    // Method 2: Yahoo Finance v7 quote API fallback
    try {
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(sym)}`;
        const data = await fetchJson(url);
        const quote = data?.quoteResponse?.result?.[0];
        if (!quote)
            throw new Error('No quote result');
        const price = quote.regularMarketPrice ?? 0;
        const prevClose = quote.regularMarketPreviousClose ?? price;
        const change = parseFloat((price - prevClose).toFixed(4));
        const changePct = prevClose !== 0 ? parseFloat(((change / prevClose) * 100).toFixed(4)) : 0;
        return {
            symbol: sym,
            price,
            change,
            changePercent: changePct,
            volume: quote.regularMarketVolume ?? 0,
            marketCap: quote.marketCap,
            high52w: quote.fiftyTwoWeekHigh,
            low52w: quote.fiftyTwoWeekLow,
            dayHigh: quote.regularMarketDayHigh,
            dayLow: quote.regularMarketDayLow,
            currency: quote.currency ?? 'USD',
            shortName: quote.shortName ?? quote.longName,
            source: 'Yahoo Finance (quote)',
        };
    }
    catch (e2) {
        console.warn(`[getMarketData] Quote API failed for ${sym}: ${e2.message}`);
    }
    // Method 3: Yahoo Finance v6 insights fallback
    try {
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`;
        const data = await fetchJson(url, 8000);
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta)
            throw new Error('No meta in query2 response');
        const price = meta.regularMarketPrice ?? 0;
        const change = meta.regularMarketChange ?? 0;
        return {
            symbol: sym,
            price,
            change,
            changePercent: meta.regularMarketChangePercent ?? 0,
            volume: meta.regularMarketVolume ?? 0,
            currency: meta.currency ?? 'USD',
            shortName: meta.shortName,
            source: 'Yahoo Finance (query2)',
        };
    }
    catch (e3) {
        console.warn(`[getMarketData] query2 also failed for ${sym}: ${e3.message}`);
        throw new Error(`Unable to fetch market data for "${symbol}" (tried 3 sources). The market may be closed or the symbol invalid.`);
    }
}
