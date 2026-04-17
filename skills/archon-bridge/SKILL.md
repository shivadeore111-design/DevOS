---
name: archon-bridge
description: Bridge between Aiden and Indian broker platforms (Zerodha, Upstox, Angel One) for unified portfolio aggregation and order routing
category: india
version: 1.0.0
tags: archon, broker, portfolio, aggregation, zerodha, upstox, angel, india, trading, unified
---

# Archon Bridge

Unified broker bridge that aggregates portfolio data and normalizes order routing across multiple Indian brokers — Zerodha Kite, Upstox, and Angel One — into a single consistent interface.

## When to Use

- User has accounts on multiple Indian brokers and wants a unified view
- User asks "what's my total portfolio across all brokers?"
- User wants to compare holdings or P&L across Zerodha and Upstox
- User needs a normalized order format regardless of which broker to use
- User asks Aiden to route an order to the broker with better margin or execution

## How to Use

### Aggregate portfolio from multiple brokers
```powershell
# Requires env vars: KITE_API_KEY, KITE_ACCESS_TOKEN, UPSTOX_TOKEN
function Get-KiteHoldings {
  $h = @{ "X-Kite-Version"="3"; "Authorization"="token $env:KITE_API_KEY:$env:KITE_ACCESS_TOKEN" }
  (Invoke-RestMethod -Uri "https://api.kite.trade/portfolio/holdings" -Headers $h).data |
    Select-Object @{N='symbol';E={$_.tradingsymbol}},
                  @{N='qty';E={$_.quantity}},
                  @{N='avg';E={$_.average_price}},
                  @{N='ltp';E={$_.last_price}},
                  @{N='broker';E={'Zerodha'}}
}

function Get-UpstoxHoldings {
  $h = @{ "Authorization"="Bearer $env:UPSTOX_TOKEN"; "Accept"="application/json" }
  (Invoke-RestMethod -Uri "https://api.upstox.com/v2/portfolio/long-term-holdings" -Headers $h).data |
    Select-Object @{N='symbol';E={$_.tradingsymbol}},
                  @{N='qty';E={$_.quantity}},
                  @{N='avg';E={$_.average_price}},
                  @{N='ltp';E={$_.last_price}},
                  @{N='broker';E={'Upstox'}}
}

$all = @(Get-KiteHoldings) + @(Get-UpstoxHoldings)
$all | Sort-Object symbol | Format-Table -AutoSize
```

### Calculate total portfolio value across brokers
```powershell
$all = @(Get-KiteHoldings) + @(Get-UpstoxHoldings)
$total = ($all | ForEach-Object { $_.ltp * $_.qty } | Measure-Object -Sum).Sum
$cost  = ($all | ForEach-Object { $_.avg * $_.qty }  | Measure-Object -Sum).Sum
$pnl   = $total - $cost
Write-Host "Total Value: ₹$([math]::Round($total,2))"
Write-Host "Total Cost:  ₹$([math]::Round($cost,2))"
Write-Host "Total P&L:   ₹$([math]::Round($pnl,2)) ($([math]::Round($pnl/$cost*100,2))%)"
```

### Find duplicate holdings across brokers
```powershell
$all = @(Get-KiteHoldings) + @(Get-UpstoxHoldings)
$all | Group-Object symbol | Where-Object Count -gt 1 |
  ForEach-Object {
    Write-Host "=== $($_.Name) ==="
    $_.Group | Format-Table broker, qty, avg, ltp -AutoSize
  }
```

### Normalize order parameters across brokers
```powershell
function New-ArchonOrder {
  param(
    [string]$Symbol,
    [string]$Side,       # BUY or SELL
    [int]$Qty,
    [string]$OrderType,  # MARKET or LIMIT
    [double]$Price = 0,
    [string]$Broker      # Zerodha or Upstox
  )

  if ($Broker -eq "Zerodha") {
    return @{
      tradingsymbol    = $Symbol
      exchange         = "NSE"
      transaction_type = $Side
      order_type       = $OrderType
      quantity         = $Qty
      price            = $Price
      product          = "CNC"
    }
  } elseif ($Broker -eq "Upstox") {
    return @{
      instrument_token = "NSE_EQ|$Symbol"
      transaction_type = $Side
      order_type       = $OrderType
      quantity         = $Qty
      price            = $Price
      product          = "D"
      validity         = "DAY"
    }
  }
}
```

## Examples

**"Show my total equity portfolio across Zerodha and Upstox"**
→ Call both broker APIs, merge holdings, calculate combined value and P&L.

**"Do I hold Reliance in more than one broker?"**
→ Aggregate all holdings, group by symbol, find symbols present in multiple broker accounts.

**"Create a normalized order for buying 10 shares of HDFC Bank via Upstox"**
→ Call `New-ArchonOrder -Symbol "HDFCBANK" -Side "BUY" -Qty 10 -OrderType "MARKET" -Broker "Upstox"`.

## Cautions

- Each broker's access token must be refreshed daily — check token validity before aggregation calls
- Broker APIs may use different symbol formats (e.g., NIFTY vs NIFTY50) — normalize symbols before cross-referencing
- Never auto-route orders across brokers without explicit user confirmation of the target broker
- P&L calculations use last traded price — may differ slightly from official broker statements due to corporate actions
