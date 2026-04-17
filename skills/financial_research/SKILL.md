---
name: financial_research
description: Research stocks, companies, and market data using real-time financial APIs
version: 1.0.0
tags: finance, stocks, market, investment, NSE, BSE, equity, company
---

# Financial Research

When performing financial research:
1. Use get_market_data first to get the live price, change %, and volume for any symbol
2. Use get_company_info to fetch sector, industry, P/E ratio, EPS, revenue, and profit margins
3. Use web_search to find recent news, analyst upgrades/downgrades, and earnings updates
4. Synthesise all three into a structured summary: price snapshot → company profile → recent news → outlook
5. For NSE stocks: symbol is the ticker only (e.g. RELIANCE, TCS) — tool auto-appends .NS
6. For BSE stocks: append .BO manually (e.g. RELIANCE.BO) if the user specifies BSE
7. For US stocks: use the bare symbol (e.g. AAPL, TSLA, NVDA)
8. Always state the data source and note that prices are delayed/indicative if market is closed
9. When comparing multiple stocks: build a table with symbol, price, change%, P/E, sector
10. Never give buy/sell advice — present data and let the user decide
