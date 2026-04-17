---
name: upstox
description: Interact with Upstox API v2 — fetch portfolio, live market data, place orders, and check P&L for Indian equity and F&O markets
category: india
version: 1.0.0
tags: upstox, broker, india, trading, orders, portfolio, equity, fno, market
license: Apache-2.0
---

# Upstox

Access your Upstox brokerage account via the Upstox API v2 — live quotes, holdings, positions, order placement, and margin data. Requires Upstox API credentials.

## When to Use

- User wants to check Upstox portfolio holdings or positions
- User asks for live market quotes on NSE/BSE instruments
- User wants to place, modify, or cancel an Upstox order
- User asks about today's P&L, order book, or trade history
- User wants margin or funds information

## How to Use

### Set up credentials
```powershell
$env:UPSTOX_TOKEN = "your_access_token"   # Bearer token from OAuth flow
$baseUrl = "https://api.upstox.com/v2"
$headers = @{
  "Authorization" = "Bearer $env:UPSTOX_TOKEN"
  "Accept"        = "application/json"
}
```

### Get holdings
```powershell
$resp = Invoke-RestMethod -Uri "$baseUrl/portfolio/long-term-holdings" -Headers $headers
$resp.data | Select-Object tradingsymbol, quantity, average_price, last_price,
  @{N='PnL';E={[math]::Round(($_.last_price - $_.average_price)*$_.quantity,2)}}
```

### Get short-term positions (intraday / F&O)
```powershell
$resp = Invoke-RestMethod -Uri "$baseUrl/portfolio/short-term-positions" -Headers $headers
$resp.data | Select-Object tradingsymbol, quantity, average_price, last_price, pnl, product
```

### Get live market quote
```powershell
$instrument = "NSE_EQ|INE009A01021"   # INFOSYS ISIN-based instrument key
$resp = Invoke-RestMethod -Uri "$baseUrl/market-quote/quotes?instrument_key=$instrument" -Headers $headers
$resp.data | Select-Object last_price, net_change, volume, ohlc
```

### Get funds and margin
```powershell
$resp = Invoke-RestMethod -Uri "$baseUrl/user/get-funds-and-margin" -Headers $headers
$resp.data | Select-Object equity
```

### Place a market order
```powershell
$order = @{
  quantity         = 1
  product          = "D"        # D = delivery, I = intraday
  validity         = "DAY"
  price            = 0
  tag              = "aiden"
  instrument_token = "NSE_EQ|INE009A01021"
  order_type       = "MARKET"
  transaction_type = "BUY"
  disclosed_quantity = 0
  trigger_price    = 0
  is_amo           = $false
} | ConvertTo-Json

$resp = Invoke-RestMethod -Uri "$baseUrl/order/place" -Method POST `
  -Headers ($headers + @{"Content-Type"="application/json"}) -Body $order
Write-Host "Order ID: $($resp.data.order_id)"
```

### Get order book
```powershell
$resp = Invoke-RestMethod -Uri "$baseUrl/order/retrieve-all" -Headers $headers
$resp.data | Select-Object order_id, tradingsymbol, transaction_type,
  quantity, price, status, order_timestamp |
  Sort-Object order_timestamp -Descending
```

## Examples

**"Show my Upstox portfolio"**
→ Fetch long-term holdings, calculate unrealized P&L per position, sum total.

**"What's the live price of Reliance?"**
→ Use instrument key `NSE_EQ|INE002A01018` and fetch `/market-quote/quotes`.

**"Place a buy order for 5 shares of TCS"**
→ POST to `/order/place` with instrument key for TCS, qty 5, product D, order_type MARKET — confirm first.

## Cautions

- Access tokens expire after 24 hours — regenerate via Upstox OAuth flow each trading day
- Instrument keys use the format `EXCHANGE|ISIN` — look up via Upstox instruments CSV download
- Always confirm order parameters with the user before calling the place order endpoint
- Use product `I` (intraday) only if you intend to square off before 3:20 PM IST — auto square-off applies
- F&O instruments require appropriate margin — check funds before placing F&O orders
