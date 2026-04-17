---
name: indian-tax-calc
description: Calculate Indian income tax, capital gains tax (STCG/LTCG), advance tax, and TDS for FY 2025-26 under old and new regimes
category: india
version: 1.0.0
tags: tax, india, income-tax, capital-gains, stcg, ltcg, itr, advance-tax, tds, fy2526
---

# Indian Tax Calculator

Calculate Indian income tax liability, STCG/LTCG on equity and F&O trades, advance tax installments, and TDS for FY 2025-26 — under both old and new tax regimes.

## When to Use

- User asks "how much tax do I owe on my salary / income?"
- User wants to calculate STCG or LTCG on stock or mutual fund gains
- User asks about tax on F&O profits
- User wants to compare old regime vs new regime tax
- User needs advance tax calculation or TDS estimation

## How to Use

### New regime tax slab (FY 2025-26)
```powershell
function Get-TaxNewRegime {
  param([double]$Income)
  # FY 2025-26 new regime slabs (post Budget 2025)
  $slabs = @(
    @{UpTo=400000;  Rate=0},
    @{UpTo=800000;  Rate=0.05},
    @{UpTo=1200000; Rate=0.10},
    @{UpTo=1600000; Rate=0.15},
    @{UpTo=2000000; Rate=0.20},
    @{UpTo=2400000; Rate=0.25},
    @{UpTo=[double]::MaxValue; Rate=0.30}
  )
  $tax = 0; $prev = 0
  foreach ($slab in $slabs) {
    if ($Income -le $prev) { break }
    $taxable = [math]::Min($Income, $slab.UpTo) - $prev
    $tax += $taxable * $slab.Rate
    $prev = $slab.UpTo
  }
  # Rebate u/s 87A: nil tax if income <= 12,00,000
  if ($Income -le 1200000) { $tax = 0 }
  $cess = $tax * 0.04
  return [PSCustomObject]@{ Tax=$tax; Cess=$cess; Total=[math]::Round($tax+$cess,2) }
}

Get-TaxNewRegime -Income 1500000
```

### Old regime tax slab (FY 2025-26)
```powershell
function Get-TaxOldRegime {
  param([double]$Income, [double]$Deductions = 0)
  $taxableIncome = $Income - $Deductions
  $slabs = @(
    @{UpTo=250000;  Rate=0},
    @{UpTo=500000;  Rate=0.05},
    @{UpTo=1000000; Rate=0.20},
    @{UpTo=[double]::MaxValue; Rate=0.30}
  )
  $tax = 0; $prev = 0
  foreach ($slab in $slabs) {
    if ($taxableIncome -le $prev) { break }
    $taxable = [math]::Min($taxableIncome, $slab.UpTo) - $prev
    $tax += $taxable * $slab.Rate
    $prev = $slab.UpTo
  }
  if ($taxableIncome -le 500000) { $tax = [math]::Min($tax, 12500) }
  $cess = $tax * 0.04
  return [PSCustomObject]@{ TaxableIncome=$taxableIncome; Tax=$tax; Cess=$cess; Total=[math]::Round($tax+$cess,2) }
}

Get-TaxOldRegime -Income 1500000 -Deductions 150000  # 80C deduction
```

### STCG tax on equity (held < 12 months)
```powershell
function Get-STCG {
  param([double]$BuyPrice, [double]$SellPrice, [int]$Qty)
  $gain = ($SellPrice - $BuyPrice) * $Qty
  $tax  = if ($gain -gt 0) { $gain * 0.20 } else { 0 }   # 20% STCG from FY25-26
  return [PSCustomObject]@{ Gain=$gain; STCGTax=[math]::Round($tax,2) }
}
Get-STCG -BuyPrice 500 -SellPrice 750 -Qty 100
```

### LTCG tax on equity (held > 12 months)
```powershell
function Get-LTCG {
  param([double]$BuyPrice, [double]$SellPrice, [int]$Qty)
  $gain   = ($SellPrice - $BuyPrice) * $Qty
  $exempt = 125000   # ₹1.25 lakh LTCG exemption per FY (FY25-26)
  $taxable = [math]::Max(0, $gain - $exempt)
  $tax    = $taxable * 0.125   # 12.5% LTCG from FY25-26
  return [PSCustomObject]@{ Gain=$gain; TaxableGain=$taxable; LTCGTax=[math]::Round($tax,2) }
}
Get-LTCG -BuyPrice 200 -SellPrice 400 -Qty 1000
```

### F&O tax (treated as business income)
```powershell
# F&O profits/losses are added to regular income and taxed at slab rate
# No special rate — it's ordinary business income
function Get-FnOTax {
  param([double]$FnOProfit, [double]$OtherIncome = 0)
  $totalIncome = $FnOProfit + $OtherIncome
  $tax = Get-TaxNewRegime -Income $totalIncome
  return [PSCustomObject]@{
    FnOProfit    = $FnOProfit
    TotalIncome  = $totalIncome
    TaxLiability = $tax.Total
    Note         = "F&O taxed at slab rate; maintain books; ITR-3 required"
  }
}
Get-FnOTax -FnOProfit 200000 -OtherIncome 800000
```

## Examples

**"How much tax do I pay on ₹15 lakh salary under new regime?"**
→ `Get-TaxNewRegime -Income 1500000` — returns tax, cess, and total liability.

**"I bought 500 shares at ₹200 and sold at ₹350 after 8 months. What's my STCG tax?"**
→ `Get-STCG -BuyPrice 200 -SellPrice 350 -Qty 500` — 20% on gain.

**"Compare old vs new regime for ₹12 lakh income with ₹1.5 lakh 80C deductions"**
→ Run both functions and display side-by-side.

## Cautions

- Tax rates shown are for FY 2025-26 based on Budget 2025 announcements — verify against official IT Act before filing
- LTCG exemption limit and STCG rate changed in Union Budget 2024 (effective FY25) — double-check the current year's rates
- F&O losses can be carried forward for 8 years but only offset against business income, not salary
- This calculator is for estimation only — always consult a CA for official tax filing
- Surcharge applies for income > ₹50 lakh (10%) and > ₹1 crore (15%) — not included in base calculation
