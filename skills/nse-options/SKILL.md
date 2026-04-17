---
name: nse-options
description: Fetch NSE options chain data, analyze OI buildup, PCR ratio, max pain, and IV for Nifty and BankNifty
category: india
version: 1.0.0
tags: nse, options, derivatives, oi, pcr, maxpain, nifty, banknifty, iv, chain
license: Apache-2.0
---

# NSE Options

Analyze NSE options chain for Nifty and BankNifty — open interest buildup, put-call ratio, max pain level, and implied volatility — using NSE's public JSON API.

## When to Use

- User asks for Nifty or BankNifty options chain
- User wants to know the PCR (put-call ratio) for an index
- User asks for max pain or peak OI strikes
- User wants to see OI change at specific strike prices
- User asks about ITM/OTM options or IV skew

## How to Use

### Fetch options chain for Nifty
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$chain = Invoke-RestMethod -Uri "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY" `
  -Headers $headers -WebSession $nse
$chain.records.data | Select-Object strikePrice,
  @{N='CE_OI';E={$_.CE.openInterest}}, @{N='CE_IV';E={$_.CE.impliedVolatility}},
  @{N='PE_OI';E={$_.PE.openInterest}}, @{N='PE_IV';E={$_.PE.impliedVolatility}} |
  Where-Object { $_.CE_OI -or $_.PE_OI } |
  Sort-Object strikePrice
```

### Calculate PCR (Put-Call Ratio)
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$chain = Invoke-RestMethod -Uri "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY" `
  -Headers $headers -WebSession $nse
$totalCE_OI = ($chain.records.data | ForEach-Object { $_.CE.openInterest } | Measure-Object -Sum).Sum
$totalPE_OI = ($chain.records.data | ForEach-Object { $_.PE.openInterest } | Measure-Object -Sum).Sum
$pcr = [math]::Round($totalPE_OI / $totalCE_OI, 2)
Write-Host "Nifty PCR: $pcr  (CE OI: $totalCE_OI | PE OI: $totalPE_OI)"
```

### Find max pain strike
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$chain = Invoke-RestMethod -Uri "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY" `
  -Headers $headers -WebSession $nse
$strikes = $chain.records.data | Select-Object strikePrice,
  @{N='CE_OI';E={$_.CE.openInterest}},
  @{N='PE_OI';E={$_.PE.openInterest}} |
  Where-Object { $_.strikePrice }

# Max pain = strike where total dollar loss for option holders is maximum
$maxPainStrike = $strikes | ForEach-Object {
  $s = $_.strikePrice
  $pain = ($strikes | ForEach-Object {
    $ceVal = [math]::Max(0, $s - $_.strikePrice) * $_.CE_OI
    $peVal = [math]::Max(0, $_.strikePrice - $s) * $_.PE_OI
    $ceVal + $peVal
  } | Measure-Object -Sum).Sum
  [PSCustomObject]@{ Strike = $s; TotalPain = $pain }
} | Sort-Object TotalPain | Select-Object -First 1
Write-Host "Max Pain Strike: $($maxPainStrike.Strike)"
```

### Top CE OI strikes (resistance levels)
```powershell
$chain.records.data |
  Where-Object { $_.CE.openInterest -gt 0 } |
  Sort-Object { $_.CE.openInterest } -Descending |
  Select-Object -First 5 strikePrice, @{N='CE_OI';E={$_.CE.openInterest}}, @{N='CE_OI_Change';E={$_.CE.changeinOpenInterest}}
```

### Top PE OI strikes (support levels)
```powershell
$chain.records.data |
  Where-Object { $_.PE.openInterest -gt 0 } |
  Sort-Object { $_.PE.openInterest } -Descending |
  Select-Object -First 5 strikePrice, @{N='PE_OI';E={$_.PE.openInterest}}, @{N='PE_OI_Change';E={$_.PE.changeinOpenInterest}}
```

## Examples

**"What is the current Nifty PCR?"**
→ Fetch chain, sum all CE and PE OI, divide PE by CE — PCR > 1.2 is bullish, < 0.8 is bearish.

**"Where is max pain for this week's expiry?"**
→ Run the max pain calculation across all strikes and return the strike with minimum total option holder loss.

**"Show me the top 5 CE and PE OI strikes for BankNifty"**
→ Change URL to `symbol=BANKNIFTY` and sort by OI descending.

## Cautions

- Options chain data is updated every few minutes during market hours — not tick-level real-time
- PCR and max pain are sentiment indicators, not trading signals — use alongside price action
- Always initialize the NSE session cookie before API calls or you will get 401/403 errors
- Near expiry, IV can spike significantly — raw IV numbers are comparable only within the same expiry
