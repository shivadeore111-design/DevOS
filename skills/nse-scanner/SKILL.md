---
name: nse-scanner
description: Scan NSE (National Stock Exchange India) for top gainers, losers, volume surges, and 52-week highs/lows using NSE public APIs
category: india
version: 1.0.0
tags: nse, stock, india, scanner, gainers, losers, equity, market, screener
license: Apache-2.0
---

# NSE Scanner

Scan the NSE equity market for top movers, volume spikes, and price extremes using NSE's publicly accessible JSON APIs — no API key required.

## When to Use

- User asks for today's top gainers or losers on NSE
- User wants stocks hitting 52-week highs or lows
- User asks for unusual volume activity or surge stocks
- User wants a quick market overview (advances vs declines)
- User asks "which Nifty 50 stocks are up/down today?"

## How to Use

### Top gainers on NSE today
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
$session = Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers
$resp = Invoke-RestMethod -Uri "https://www.nseindia.com/api/live-analysis-variations?index=gainers" `
  -Headers $headers -WebSession $nse
$resp.NIFTY.data | Sort-Object pChange -Descending | Select-Object -First 10 |
  Select-Object symbol, ltp, netPrice, pChange
```

### Top losers on NSE today
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
$session = Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers
$resp = Invoke-RestMethod -Uri "https://www.nseindia.com/api/live-analysis-variations?index=losers" `
  -Headers $headers -WebSession $nse
$resp.NIFTY.data | Sort-Object pChange | Select-Object -First 10 |
  Select-Object symbol, ltp, netPrice, pChange
```

### 52-week highs
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
$session = Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers
$resp = Invoke-RestMethod -Uri "https://www.nseindia.com/api/live-analysis-variations?index=high52" `
  -Headers $headers -WebSession $nse
$resp.data | Select-Object symbol, ltp, pChange | Select-Object -First 20
```

### Nifty 50 snapshot
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
$session = Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers
$resp = Invoke-RestMethod -Uri "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050" `
  -Headers $headers -WebSession $nse
$resp.data | Select-Object symbol, lastPrice, pChange, totalTradedVolume |
  Sort-Object pChange -Descending
```

### Market breadth (advances vs declines)
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
$session = Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers
$resp = Invoke-RestMethod -Uri "https://www.nseindia.com/api/market-data-pre-open?key=ALL" `
  -Headers $headers -WebSession $nse
$resp.data | Group-Object { if ($_.metadata.pChange -gt 0) { "Advances" } else { "Declines" } } |
  Select-Object Name, Count
```

## Examples

**"Show me today's top 5 Nifty gainers"**
→ Fetch gainers API, filter NIFTY data, sort by `pChange` descending, display top 5 with symbol, LTP, and % change.

**"Any stocks hitting 52-week highs today?"**
→ Fetch `high52` endpoint and list symbols with their current price and % change.

**"How is the overall market today — more advances or declines?"**
→ Fetch pre-open market data, group by positive/negative pChange, show counts.

## Cautions

- NSE APIs require a session cookie obtained by first visiting `https://www.nseindia.com` — always initialize the session before API calls
- NSE may rate-limit or block automated requests; add a small delay between calls if running bulk scans
- Market data is available only during trading hours (Mon–Fri, 9:15 AM – 3:30 PM IST)
- API endpoints and response structure may change — verify against NSE website if calls fail
