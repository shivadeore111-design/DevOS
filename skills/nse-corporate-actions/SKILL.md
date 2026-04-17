---
name: nse-corporate-actions
description: Fetch NSE corporate actions — dividends, bonus issues, stock splits, rights issues, and buybacks for any listed stock
category: india
version: 1.0.0
tags: nse, corporate-actions, dividend, bonus, split, rights, buyback, india, equity
---

# NSE Corporate Actions

Fetch upcoming and recent corporate actions for NSE-listed stocks — dividends, bonus issues, stock splits, rights issues, and buybacks — using NSE's public API.

## When to Use

- User asks "when is the next dividend for Infosys?"
- User wants to know about upcoming bonus issues or stock splits
- User asks about ex-dates, record dates, or payment dates for dividends
- User wants to check if a stock has an upcoming buyback offer
- User asks for a company's full corporate action history

## How to Use

### Get corporate actions for a specific stock
```powershell
$symbol = "INFY"
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$resp = Invoke-RestMethod `
  -Uri "https://www.nseindia.com/api/corporates-corporateActions?index=equities&symbol=$symbol" `
  -Headers $headers -WebSession $nse
$resp | Select-Object subject, exDate, recordDate, bcStartDate, bcEndDate, series |
  Sort-Object exDate -Descending | Select-Object -First 10
```

### Get upcoming dividends across the market
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$today = (Get-Date).ToString("dd-MM-yyyy")
$resp = Invoke-RestMethod `
  -Uri "https://www.nseindia.com/api/corporates-corporateActions?index=equities&from_date=$today&category=dividend" `
  -Headers $headers -WebSession $nse
$resp | Select-Object symbol, subject, exDate, series |
  Sort-Object exDate | Select-Object -First 20
```

### Get upcoming bonus issues
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$resp = Invoke-RestMethod `
  -Uri "https://www.nseindia.com/api/corporates-corporateActions?index=equities&category=bonus" `
  -Headers $headers -WebSession $nse
$resp | Select-Object symbol, subject, exDate, bcStartDate | Sort-Object exDate
```

### Get upcoming stock splits
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$resp = Invoke-RestMethod `
  -Uri "https://www.nseindia.com/api/corporates-corporateActions?index=equities&category=splits" `
  -Headers $headers -WebSession $nse
$resp | Select-Object symbol, subject, exDate | Sort-Object exDate
```

### Check if a stock's ex-date has passed (for dividend eligibility)
```powershell
$symbol = "TCS"
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$resp = Invoke-RestMethod `
  -Uri "https://www.nseindia.com/api/corporates-corporateActions?index=equities&symbol=$symbol" `
  -Headers $headers -WebSession $nse
$latest = $resp | Where-Object { $_.subject -match "dividend" } |
  Sort-Object exDate -Descending | Select-Object -First 1
if ($latest) {
  $exDate = [DateTime]::ParseExact($latest.exDate, "dd-MMM-yyyy", $null)
  $status = if ($exDate -gt (Get-Date)) { "UPCOMING (buy before $($latest.exDate))" } else { "PAST (ex-date was $($latest.exDate))" }
  Write-Host "$symbol dividend: $($latest.subject) | Ex-date: $status"
}
```

## Examples

**"When is TCS next dividend and what is the ex-date?"**
→ Fetch corporate actions for TCS filtered by `dividend`, sort by exDate, display the most recent upcoming entry.

**"Are there any bonus issues this month?"**
→ Fetch bonus category from corporate actions API, filter by exDate within current month.

**"Has Wipro announced a stock split?"**
→ Fetch splits category for WIPRO and check if any entries exist.

## Cautions

- You must hold the stock before the ex-date to be eligible for dividends — buying on ex-date does not qualify
- Corporate action data from NSE is updated periodically — always cross-check with the company's official BSE/NSE filings for critical decisions
- Bonus shares and splits do not add value — they only change the face value and share count proportionally
- NSE session cookie required — always initialize session before API calls
- Rights issue applications require demat account access and ASBA — Aiden can fetch info but cannot apply on the user's behalf
