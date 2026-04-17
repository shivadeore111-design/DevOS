---
name: zerodha-kite
description: Interact with Zerodha Kite Connect API — fetch holdings, positions, place/modify orders, and get live quotes
category: india
version: 1.0.0
tags: zerodha, kite, broker, india, trading, orders, holdings, positions, equity, portfolio
---

# Zerodha Kite

Access your Zerodha account via the Kite Connect REST API — fetch portfolio, live quotes, place orders, and check order history. Requires a Kite Connect API subscription.

## When to Use

- User wants to see their Zerodha holdings or current positions
- User asks for a live quote on an NSE/BSE stock
- User wants to place, modify, or cancel an order
- User asks about today's P&L or order history
- User wants to check available margin or funds

## How to Use

### Set up API credentials
```powershell
$env:KITE_API_KEY    = "your_api_key"
$env:KITE_ACCESS_TOKEN = "your_access_token"  # Obtained after daily login flow
$baseUrl = "https://api.kite.trade"
$headers = @{
  "X-Kite-Version" = "3"
  "Authorization"  = "token $($env:KITE_API_KEY):$($env:KITE_ACCESS_TOKEN)"
}
```

### Get holdings (long-term portfolio)
```powershell
$holdings = Invoke-RestMethod -Uri "$baseUrl/portfolio/holdings" -Headers $headers
$holdings.data | Select-Object tradingsymbol, quantity, average_price, last_price,
  @{N='PnL';E={[math]::Round(($_.last_price - $_.average_price) * $_.quantity, 2)}}
```

### Get today's positions (intraday / F&O)
```powershell
$positions = Invoke-RestMethod -Uri "$baseUrl/portfolio/positions" -Headers $headers
$positions.data.net | Select-Object tradingsymbol, quantity, average_price, last_price, pnl
```

### Get live quote
```powershell
$symbols = "NSE:RELIANCE,NSE:INFY,NSE:TCS"
$quote = Invoke-RestMethod -Uri "$baseUrl/quote?i=$symbols" -Headers $headers
$quote.data.PSObject.Properties | ForEach-Object {
  [PSCustomObject]@{
    Symbol = $_.Name
    LTP    = $_.Value.last_price
    Change = $_.Value.net_change
    Volume = $_.Value.volume
  }
}
```

### Get available funds/margin
```powershell
$margins = Invoke-RestMethod -Uri "$baseUrl/user/margins" -Headers $headers
$margins.data.equity | Select-Object available, utilised, net
```

### Place a market order
```powershell
$orderBody = @{
  tradingsymbol = "RELIANCE"
  exchange      = "NSE"
  transaction_type = "BUY"
  order_type    = "MARKET"
  quantity      = 1
  product       = "CNC"   # CNC = delivery, MIS = intraday, NRML = F&O
}
$resp = Invoke-RestMethod -Uri "$baseUrl/orders/regular" `
  -Method POST -Headers $headers -Body $orderBody
Write-Host "Order ID: $($resp.data.order_id)"
```

### Get order history
```powershell
$orders = Invoke-RestMethod -Uri "$baseUrl/orders" -Headers $headers
$orders.data | Select-Object order_id, tradingsymbol, transaction_type,
  quantity, price, status, order_timestamp |
  Sort-Object order_timestamp -Descending
```

## Examples

**"Show me my Zerodha portfolio with current P&L"**
→ Fetch `/portfolio/holdings`, calculate P&L per position, sum for total portfolio gain/loss.

**"What's the current price of HDFC Bank?"**
→ `GET /quote?i=NSE:HDFCBANK` — returns LTP, OHLC, volume, and circuit limits.

**"Place a buy order for 1 share of Infosys at market price"**
→ POST to `/orders/regular` with `INFY`, `NSE`, `BUY`, `MARKET`, qty 1, product `CNC`.

## Cautions

- Kite Connect requires a paid API subscription (₹2000/month) — confirm with the user before attempting API calls
- The access token expires daily and must be regenerated via the login flow each morning
- Always confirm order details with the user before placing — orders execute immediately at market price
- Use `product: CNC` for delivery equity trades, `MIS` for intraday, `NRML` for F&O overnight positions
- Paper-trade or test with small quantities before automating larger orders
