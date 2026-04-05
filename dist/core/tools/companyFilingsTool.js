"use strict";
// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompanyInfo = getCompanyInfo;
// ── Fetch helper ──────────────────────────────────────────────
async function fetchJson(url, timeoutMs = 15000) {
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
// ── Symbol normalisation (mirrors marketDataTool) ─────────────
function normaliseSymbol(raw) {
    const upper = raw.trim().toUpperCase();
    if (upper.includes('.'))
        return upper;
    const NSE_HINTS = ['RELIANCE', 'TCS', 'INFY', 'WIPRO', 'HDFCBANK', 'ICICIBANK',
        'SBIN', 'BAJFINANCE', 'MARUTI', 'TATAMOTORS', 'TATASTEEL', 'ADANIENT',
        'ADANIPORTS', 'HINDUNILVR', 'NESTLEIND', 'LT', 'ITC', 'SUNPHARMA',
        'POWERGRID', 'NTPC', 'COALINDIA', 'ONGC', 'JSWSTEEL', 'AXISBANK',
        'KOTAKBANK', 'ULTRACEMCO', 'GRASIM', 'DRREDDY', 'CIPLA', 'TECHM',
        'HCLTECH', 'APOLLOHOSP', 'TITAN', 'BPCL', 'IOC', 'BHARTIARTL'];
    if (NSE_HINTS.includes(upper))
        return `${upper}.NS`;
    const US_HINTS = ['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META',
        'NVDA', 'AMD', 'NFLX', 'INTC', 'QCOM', 'AVGO', 'CRM', 'ORCL', 'IBM'];
    if (US_HINTS.includes(upper))
        return upper;
    return `${upper}.NS`;
}
// ── Safe number extractor ─────────────────────────────────────
function safeNum(obj, key) {
    const v = obj?.[key]?.raw ?? obj?.[key];
    return typeof v === 'number' && isFinite(v) ? v : undefined;
}
// ── Main export ───────────────────────────────────────────────
async function getCompanyInfo(symbol) {
    const sym = normaliseSymbol(symbol);
    const modules = ['assetProfile', 'defaultKeyStatistics', 'financialData'].join(',');
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${modules}`;
    let data;
    try {
        data = await fetchJson(url);
    }
    catch (e1) {
        // Try query2 fallback
        try {
            const url2 = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${modules}`;
            data = await fetchJson(url2);
        }
        catch (e2) {
            throw new Error(`Unable to fetch company info for "${symbol}": ${e2.message}`);
        }
    }
    const summary = data?.quoteSummary?.result?.[0];
    if (!summary) {
        const err = data?.quoteSummary?.error?.description ?? 'No data returned';
        throw new Error(`Yahoo Finance quoteSummary error for "${sym}": ${err}`);
    }
    const profile = summary.assetProfile ?? {};
    const keyStats = summary.defaultKeyStatistics ?? {};
    const finData = summary.financialData ?? {};
    // Description: cap at 600 chars for planner context efficiency
    const rawDesc = (profile.longBusinessSummary ?? '');
    const description = rawDesc.slice(0, 600) + (rawDesc.length > 600 ? '…' : '');
    return {
        symbol,
        name: finData.targetHighPrice?.fmt ? sym : (keyStats.sharesOutstanding?.fmt ? sym : sym),
        sector: profile.sector ?? 'Unknown',
        industry: profile.industry ?? 'Unknown',
        description: description || 'No description available.',
        country: profile.country,
        website: profile.website,
        employees: safeNum(profile, 'fullTimeEmployees') ?? profile.fullTimeEmployees,
        // Key statistics
        marketCap: safeNum(keyStats, 'enterpriseValue') ?? safeNum(keyStats, 'marketCap'),
        peRatio: safeNum(keyStats, 'trailingPE') ?? safeNum(keyStats, 'forwardPE'),
        eps: safeNum(keyStats, 'trailingEps'),
        beta: safeNum(keyStats, 'beta'),
        bookValue: safeNum(keyStats, 'bookValue'),
        // Financial data (TTM)
        revenue: safeNum(finData, 'totalRevenue'),
        grossProfit: safeNum(finData, 'grossProfits'),
        ebitda: safeNum(finData, 'ebitda'),
        profitMargin: safeNum(finData, 'profitMargins'),
        revenueGrowth: safeNum(finData, 'revenueGrowth'),
        source: 'Yahoo Finance (quoteSummary)',
    };
}
