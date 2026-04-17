---
name: india-economic-calendar
description: Track upcoming Indian economic events — RBI policy dates, CPI/WPI releases, GDP data, Union Budget, and expiry calendar for NSE derivatives
category: india
version: 1.0.0
tags: india, rbi, economic, calendar, cpi, gdp, budget, expiry, monetary, policy
---

# India Economic Calendar

Track key Indian macroeconomic events — RBI monetary policy, inflation data (CPI/WPI), GDP releases, Union Budget dates, and NSE F&O expiry schedule — to plan around market-moving events.

## When to Use

- User asks "when is the next RBI policy meeting?"
- User wants to know upcoming CPI or GDP data release dates
- User asks about NSE F&O expiry dates (weekly/monthly)
- User wants to check if any major events are this week
- User asks about Union Budget or advance tax payment dates

## How to Use

### NSE F&O expiry calendar (current month)
```powershell
# NSE monthly expiry = last Thursday of each month
# NSE weekly expiry = every Thursday (Nifty Bank weekly, Nifty weekly alternate)
function Get-NseMonthlyExpiry {
  param([int]$Year = (Get-Date).Year, [int]$Month = (Get-Date).Month)
  $lastDay = [DateTime]::new($Year, $Month, [DateTime]::DaysInMonth($Year, $Month))
  while ($lastDay.DayOfWeek -ne [DayOfWeek]::Thursday) {
    $lastDay = $lastDay.AddDays(-1)
  }
  return $lastDay
}

$currentExpiry = Get-NseMonthlyExpiry
$nextExpiry    = Get-NseMonthlyExpiry -Month ((Get-Date).Month % 12 + 1)
Write-Host "Current month expiry: $($currentExpiry.ToString('dd-MMM-yyyy'))"
Write-Host "Next month expiry:    $($nextExpiry.ToString('dd-MMM-yyyy'))"
Write-Host "Days to expiry: $( ($currentExpiry - (Get-Date)).Days )"
```

### Key RBI 2025-26 MPC dates (hardcoded calendar)
```powershell
$rbiMPC2526 = @(
  [DateTime]"2025-04-09",
  [DateTime]"2025-06-06",
  [DateTime]"2025-08-06",
  [DateTime]"2025-10-01",
  [DateTime]"2025-12-05",
  [DateTime]"2026-02-06"
)
$today = Get-Date
$upcoming = $rbiMPC2526 | Where-Object { $_ -ge $today } | Select-Object -First 3
Write-Host "Upcoming RBI MPC meetings:"
$upcoming | ForEach-Object { Write-Host "  $_  (in $(($_ - $today).Days) days)" }
```

### Advance tax payment dates (FY 2025-26)
```powershell
$advanceTax = @(
  [PSCustomObject]@{ Date="15-Jun-2025"; Installment="1st (15%)"; Cumulative="15%" }
  [PSCustomObject]@{ Date="15-Sep-2025"; Installment="2nd (45%)"; Cumulative="45%" }
  [PSCustomObject]@{ Date="15-Dec-2025"; Installment="3rd (75%)"; Cumulative="75%" }
  [PSCustomObject]@{ Date="15-Mar-2026"; Installment="4th (100%)"; Cumulative="100%" }
)
$today = Get-Date
$advanceTax | Where-Object { [DateTime]$_.Date -ge $today } | Format-Table -AutoSize
```

### Indian financial year dates
```powershell
$fy = if ((Get-Date).Month -ge 4) { (Get-Date).Year } else { (Get-Date).Year - 1 }
[PSCustomObject]@{
  FY_Start      = "01-Apr-$fy"
  FY_End        = "31-Mar-$($fy+1)"
  ITR_Deadline  = "31-Jul-$($fy+1)"
  Audit_Deadline = "30-Sep-$($fy+1)"
}
```

### Upcoming NSE weekly expiries (next 4 Thursdays)
```powershell
$today = Get-Date
$nextThursday = $today.AddDays((4 - [int]$today.DayOfWeek + 7) % 7)
if ($nextThursday -eq $today) { $nextThursday = $nextThursday.AddDays(7) }
1..4 | ForEach-Object {
  $expiry = $nextThursday.AddDays(($_ - 1) * 7)
  Write-Host "Week $_ expiry: $($expiry.ToString('dd-MMM-yyyy ddd'))"
}
```

## Examples

**"When is the next RBI policy announcement?"**
→ Compare today's date against the hardcoded MPC calendar and return the nearest future date with days remaining.

**"How many days to this month's F&O expiry?"**
→ Calculate last Thursday of current month and subtract today's date.

**"When is the next advance tax installment due?"**
→ Filter advance tax table for dates >= today and return the next entry.

## Cautions

- RBI MPC dates are announced quarterly by the RBI — update the hardcoded list from `https://www.rbi.org.in` each fiscal year
- NSE switches the weekly expiry index periodically (Nifty, BankNifty, FinNifty rotation) — verify the current week's index on NSE website
- If Thursday is a market holiday, expiry moves to the previous trading day — check NSE holiday calendar
- CPI and WPI data are released by MOSPI around the 12th–14th of each month — check `https://mospi.gov.in` for exact dates
