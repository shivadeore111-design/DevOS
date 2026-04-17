---
name: nse-fii-dii
description: Fetch FII and DII daily buying/selling activity from NSE to gauge institutional flow into Indian equity markets
category: india
version: 1.0.0
tags: fii, dii, institutional, flow, nse, india, equity, market, foreign
license: Apache-2.0
---

# NSE FII/DII Flow

Track FII (Foreign Institutional Investors) and DII (Domestic Institutional Investors) daily net buying and selling activity on NSE — a leading indicator of market sentiment.

## When to Use

- User asks "are FIIs buying or selling today?"
- User wants to know net institutional flow for a specific date or week
- User asks about DII activity offsetting FII outflows
- User wants a historical view of FII/DII trends
- User is trying to gauge smart money positioning

## How to Use

### Get today's FII/DII data
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$resp = Invoke-RestMethod `
  -Uri "https://www.nseindia.com/api/fiidiiTradeReact" `
  -Headers $headers -WebSession $nse
$resp | Select-Object date,
  @{N='FII_Buy';E={$_.buyValue}}, @{N='FII_Sell';E={$_.sellValue}},
  @{N='FII_Net';E={$_.netValue}} |
  Select-Object -First 1
```

### Get last 10 trading days of FII/DII activity
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$resp = Invoke-RestMethod `
  -Uri "https://www.nseindia.com/api/fiidiiTradeReact" `
  -Headers $headers -WebSession $nse
$resp | Select-Object -First 10 | ForEach-Object {
  [PSCustomObject]@{
    Date     = $_.date
    FII_Net  = [math]::Round($_.fiinet, 2)
    DII_Net  = [math]::Round($_.diinet, 2)
    FII_Buy  = [math]::Round($_.fiibuy, 2)
    FII_Sell = [math]::Round($_.fiisell, 2)
    DII_Buy  = [math]::Round($_.diibuy, 2)
    DII_Sell = [math]::Round($_.diisell, 2)
  }
} | Format-Table -AutoSize
```

### Calculate cumulative FII flow over past N days
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$resp = Invoke-RestMethod `
  -Uri "https://www.nseindia.com/api/fiidiiTradeReact" `
  -Headers $headers -WebSession $nse
$n = 20
$cumFII = ($resp | Select-Object -First $n | ForEach-Object { $_.fiinet } | Measure-Object -Sum).Sum
$cumDII = ($resp | Select-Object -First $n | ForEach-Object { $_.diinet } | Measure-Object -Sum).Sum
Write-Host "Last $n days cumulative:"
Write-Host "FII Net: ₹$([math]::Round($cumFII,2)) Cr"
Write-Host "DII Net: ₹$([math]::Round($cumDII,2)) Cr"
```

### Detect consecutive FII buying/selling streaks
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$resp = Invoke-RestMethod -Uri "https://www.nseindia.com/api/fiidiiTradeReact" -Headers $headers -WebSession $nse
$streak = 0; $direction = ""
foreach ($day in $resp) {
  if ($day.fiinet -gt 0) { $d = "BUY" } else { $d = "SELL" }
  if ($d -eq $direction) { $streak++ } else { $direction = $d; $streak = 1 }
  break
}
Write-Host "FII currently on $streak-day $direction streak"
```

## Examples

**"Are FIIs buying or selling this week?"**
→ Fetch last 5 days of FII data, sum net values, display buying/selling trend.

**"What was FII activity over the past month?"**
→ Fetch 20 records from the API and calculate cumulative FII net flow.

**"Show FII vs DII activity for the last 10 sessions"**
→ Tabulate both FII_Net and DII_Net for the 10 most recent trading days.

## Cautions

- FII/DII data is published after market close — not available in real time during trading hours
- NSE API requires a session cookie; always initialize with a visit to `https://www.nseindia.com` first
- Values are in crores (₹ Cr) — multiply by 10 million for absolute rupee amounts
- FII/DII flow is one factor among many; don't use it as a sole buy/sell signal
