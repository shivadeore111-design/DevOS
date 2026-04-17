---
name: nse-delivery
description: Fetch NSE delivery percentage data to identify stocks with high delivery volume — a signal of genuine buying interest vs intraday noise
category: india
version: 1.0.0
tags: nse, delivery, volume, equity, india, stock, delhivery, bulk, block
---

# NSE Delivery

Analyze NSE delivery percentage data to find stocks with high genuine buying (delivery trades vs total traded volume), bulk deals, and block deals — filters intraday noise from real accumulation.

## When to Use

- User asks which stocks have high delivery percentage today
- User wants to spot genuine accumulation vs intraday speculation
- User asks about bulk deals or block deals on NSE
- User wants to filter high-volume stocks by delivery quality
- User asks "are institutions accumulating this stock?"

## How to Use

### Get delivery data for a specific stock
```powershell
$symbol = "RELIANCE"
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$resp = Invoke-RestMethod `
  -Uri "https://www.nseindia.com/api/quote-equity?symbol=$symbol" `
  -Headers $headers -WebSession $nse
[PSCustomObject]@{
  Symbol          = $symbol
  TotalVolume     = $resp.securityWiseDP.quantityTraded
  DeliveryVolume  = $resp.securityWiseDP.deliveryQuantity
  DeliveryPercent = $resp.securityWiseDP.deliveryToTradedQuantity
}
```

### Scan Nifty 50 for stocks with delivery > 60%
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null

$nifty50 = (Invoke-RestMethod `
  -Uri "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050" `
  -Headers $headers -WebSession $nse).data.symbol

$results = foreach ($sym in $nifty50) {
  Start-Sleep -Milliseconds 300   # Throttle to avoid rate limits
  try {
    $q = Invoke-RestMethod `
      -Uri "https://www.nseindia.com/api/quote-equity?symbol=$sym" `
      -Headers $headers -WebSession $nse
    $dp = $q.securityWiseDP.deliveryToTradedQuantity
    if ($dp -gt 60) {
      [PSCustomObject]@{ Symbol = $sym; DeliveryPct = $dp }
    }
  } catch {}
}
$results | Sort-Object DeliveryPercent -Descending
```

### Get bulk deals for today
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$resp = Invoke-RestMethod `
  -Uri "https://www.nseindia.com/api/bulk-deal-archives?number=10&series=EQ&from=&to=&symbol=&csv=false" `
  -Headers $headers -WebSession $nse
$resp.data | Select-Object symbol, clientName, buyOrSellFlag, quantityTraded, tradePrice, date
```

### Get block deals for today
```powershell
$headers = @{ "User-Agent" = "Mozilla/5.0"; "Referer" = "https://www.nseindia.com" }
Invoke-WebRequest -Uri "https://www.nseindia.com" -SessionVariable nse -Headers $headers | Out-Null
$resp = Invoke-RestMethod `
  -Uri "https://www.nseindia.com/api/block-deal-archives?number=10&series=EQ&from=&to=&symbol=&csv=false" `
  -Headers $headers -WebSession $nse
$resp.data | Select-Object symbol, clientName, buyOrSellFlag, quantityTraded, tradePrice, date
```

## Examples

**"What is the delivery percentage for HDFC Bank today?"**
→ Fetch quote for `HDFCBANK`, extract `deliveryToTradedQuantity` — above 50% is considered healthy delivery.

**"Which Nifty 50 stocks have delivery above 60% today?"**
→ Iterate over Nifty 50 symbols, fetch each quote, filter by delivery percentage threshold.

**"Were there any bulk deals in IT stocks today?"**
→ Fetch bulk deals archive and filter by sector or symbol name containing "INFY", "TCS", "WIPRO".

## Cautions

- Delivery data is updated once after market close — not available intraday
- High delivery percentage alone is not sufficient for a buy signal — check price trend and volumes together
- The Nifty 50 scan loop makes ~50 API calls; add a `Start-Sleep` delay to avoid NSE rate limiting
- Bulk deal threshold is ≥ 0.5% of listed shares; block deal threshold is ≥ 5 lakh shares or ₹5 Cr value
